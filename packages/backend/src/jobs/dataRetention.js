/**
 * Data Retention Job
 * Periodically cleans up old data based on tenant retention policies
 */

import { getDatabase } from '../db/index.js';
import { deleteFile } from '../services/storage.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ service: 'data-retention' });

// Default retention periods (in days)
const DEFAULT_RETENTION = {
  calls: 365,        // 1 year
  recordings: 90,    // 90 days
  transcripts: 365,  // 1 year
  bookings: 730,     // 2 years (for audit purposes)
};

/**
 * Run data retention cleanup for all tenants
 */
export async function runDataRetention() {
  log.info('Starting data retention job');
  const startTime = Date.now();
  
  try {
    const db = getDatabase();
    
    // Get all tenants with their retention settings
    const tenants = await db.tenant.findMany({
      where: { deletedAt: null },
      include: { config: true },
    });

    let totalDeleted = {
      recordings: 0,
      calls: 0,
      transcripts: 0,
    };

    for (const tenant of tenants) {
      try {
        const result = await cleanupTenantData(db, tenant);
        totalDeleted.recordings += result.recordings;
        totalDeleted.calls += result.calls;
        totalDeleted.transcripts += result.transcripts;
      } catch (error) {
        log.error('Error cleaning up tenant data', { 
          tenantId: tenant.id, 
          error: error.message 
        });
      }
    }

    const duration = Date.now() - startTime;
    log.info('Data retention job completed', { 
      duration,
      totalDeleted,
    });

    return totalDeleted;
  } catch (error) {
    log.error('Data retention job failed', { error: error.message });
    throw error;
  }
}

/**
 * Clean up data for a specific tenant
 */
async function cleanupTenantData(db, tenant) {
  const retention = {
    calls: tenant.config?.dataRetentionDays || DEFAULT_RETENTION.calls,
    recordings: tenant.config?.recordingRetentionDays || DEFAULT_RETENTION.recordings,
    transcripts: tenant.config?.transcriptRetentionDays || DEFAULT_RETENTION.transcripts,
  };

  log.debug('Cleaning up tenant data', { 
    tenantId: tenant.id, 
    retention 
  });

  let deleted = {
    recordings: 0,
    calls: 0,
    transcripts: 0,
  };

  // Delete expired recordings
  const recordingCutoff = new Date();
  recordingCutoff.setDate(recordingCutoff.getDate() - retention.recordings);

  const expiredRecordings = await db.recording.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { expiresAt: { lte: new Date() } },
        { createdAt: { lte: recordingCutoff } },
      ],
    },
  });

  for (const recording of expiredRecordings) {
    try {
      // Delete from storage
      await deleteFile(recording.s3Key, recording.s3Bucket);
      
      // Delete from database
      await db.recording.delete({ where: { id: recording.id } });
      deleted.recordings++;
    } catch (error) {
      log.error('Failed to delete recording', { 
        recordingId: recording.id, 
        error: error.message 
      });
    }
  }

  // Delete old transcripts (keep the call record, just remove transcript content)
  const transcriptCutoff = new Date();
  transcriptCutoff.setDate(transcriptCutoff.getDate() - retention.transcripts);

  const oldTranscripts = await db.transcript.updateMany({
    where: {
      tenantId: tenant.id,
      createdAt: { lte: transcriptCutoff },
      fullText: { not: null },
    },
    data: {
      segments: [],
      fullText: '[Data removed per retention policy]',
    },
  });
  deleted.transcripts = oldTranscripts.count;

  // Mark very old calls as archived (don't delete, keep metadata)
  const callCutoff = new Date();
  callCutoff.setDate(callCutoff.getDate() - retention.calls);

  // Delete calls older than retention period that have no bookings
  const deletedCalls = await db.call.deleteMany({
    where: {
      tenantId: tenant.id,
      createdAt: { lte: callCutoff },
      bookings: { none: {} },
    },
  });
  deleted.calls = deletedCalls.count;

  log.info('Tenant data cleanup completed', { 
    tenantId: tenant.id, 
    deleted 
  });

  return deleted;
}

/**
 * Clean up unprocessed/orphaned data
 */
export async function cleanupOrphanedData() {
  log.info('Starting orphaned data cleanup');
  
  try {
    const db = getDatabase();

    // Delete calls that have been in PENDING status for more than 24 hours
    const staleCallsCutoff = new Date();
    staleCallsCutoff.setHours(staleCallsCutoff.getHours() - 24);

    const staleCalls = await db.call.deleteMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: staleCallsCutoff },
      },
    });

    // Note: orphaned transcripts are auto-cleaned by onDelete: Cascade on the Call relation

    log.info('Orphaned data cleanup completed', {
      staleCalls: staleCalls.count,
    });

    return {
      staleCalls: staleCalls.count,
    };
  } catch (error) {
    log.error('Orphaned data cleanup failed', { error: error.message });
    throw error;
  }
}

/**
 * Get storage usage statistics for a tenant
 */
export async function getTenantStorageUsage(tenantId) {
  const db = getDatabase();

  const recordings = await db.recording.aggregate({
    where: { tenantId },
    _sum: { fileSize: true },
    _count: true,
  });

  const transcripts = await db.transcript.count({
    where: { tenantId },
  });

  const calls = await db.call.count({
    where: { tenantId },
  });

  return {
    recordingsCount: recordings._count,
    recordingsSize: recordings._sum.fileSize || 0,
    transcriptsCount: transcripts,
    callsCount: calls,
  };
}

export default {
  runDataRetention,
  cleanupOrphanedData,
  getTenantStorageUsage,
};
