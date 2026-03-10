/**
 * Voicemail Service
 * Handles voicemail creation, storage, transcription, and management
 */

import { getDatabase } from '../db/index.js';
import { uploadFile, getDownloadUrl, getFileStream, deleteFile } from './storage.js';
import { emitToTenant } from '../websocket/index.js';
import { logger } from '../lib/logger.js';
import config from '../config/index.js';

const log = logger.child({ service: 'voicemail' });

/**
 * Create a new voicemail
 * @param {string} tenantId - Tenant ID
 * @param {Object} data - Voicemail metadata
 * @param {Buffer} audioBuffer - Raw audio data
 * @returns {Promise<Object>} Created voicemail record
 */
export async function createVoicemail(tenantId, data, audioBuffer) {
  const db = getDatabase();

  const key = `voicemails/${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webm`;
  const bucket = config.s3?.bucket || 'local';
  const mimeType = data.mimeType || 'audio/webm';

  // Upload audio file
  await uploadFile(audioBuffer, key, mimeType);
  log.info('Voicemail audio uploaded', { key, bucket, tenantId });

  // Calculate retention expiry
  const tenantConfig = await db.tenantConfig.findUnique({ where: { tenantId } });
  const retentionDays = tenantConfig?.retentionDays || 90;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  // Create DB record
  const voicemail = await db.voicemail.create({
    data: {
      tenantId,
      callId: data.callId || null,
      phoneNumberId: data.phoneNumberId || null,
      callerName: data.callerName || null,
      callerPhone: data.callerPhone || null,
      s3Key: key,
      s3Bucket: bucket,
      fileSize: audioBuffer.length,
      mimeType,
      durationMs: data.durationMs || null,
      transcript: data.transcript || null,
      isUrgent: data.isUrgent || false,
      expiresAt,
    },
  });

  log.info('Voicemail created', { voicemailId: voicemail.id, tenantId });

  // If linked to a call, update the call disposition
  if (data.callId) {
    await db.call.update({
      where: { id: data.callId },
      data: {
        disposition: 'VOICEMAIL',
        outcome: 'VOICEMAIL',
      },
    }).catch(err => log.warn('Failed to update call disposition for voicemail', { error: err.message }));
  }

  // Notify via WebSocket
  emitToTenant(tenantId, 'voicemail:new', {
    id: voicemail.id,
    callerName: voicemail.callerName,
    callerPhone: voicemail.callerPhone,
    durationMs: voicemail.durationMs,
    isUrgent: voicemail.isUrgent,
    createdAt: voicemail.createdAt,
  });

  // Trigger async transcription if no transcript provided
  if (!data.transcript) {
    transcribeVoicemail(voicemail.id).catch(err => {
      log.warn('Background voicemail transcription failed', { error: err.message, voicemailId: voicemail.id });
    });
  }

  return voicemail;
}

/**
 * List voicemails with filtering and pagination
 */
export async function getVoicemails(tenantId, filters = {}) {
  const db = getDatabase();
  const {
    page = 1,
    limit = 20,
    isRead,
    isArchived = false,
    isUrgent,
    search,
    startDate,
    endDate,
  } = filters;

  const where = {
    tenantId,
    isArchived,
    ...(typeof isRead === 'boolean' && { isRead }),
    ...(typeof isUrgent === 'boolean' && { isUrgent }),
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { ...((startDate ? { gte: new Date(startDate) } : {})), lte: new Date(endDate) } }),
    ...(search && {
      OR: [
        { callerName: { contains: search, mode: 'insensitive' } },
        { callerPhone: { contains: search } },
        { transcript: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [voicemails, total, unreadCount] = await Promise.all([
    db.voicemail.findMany({
      where,
      orderBy: [{ isUrgent: 'desc' }, { createdAt: 'desc' }],
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: {
        phoneNumber: { select: { phoneNumber: true, friendlyName: true } },
        call: { select: { id: true, livekitRoom: true, status: true } },
      },
    }),
    db.voicemail.count({ where }),
    db.voicemail.count({ where: { tenantId, isRead: false, isArchived: false } }),
  ]);

  return {
    voicemails,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
    unreadCount,
  };
}

/**
 * Get a single voicemail by ID with a signed download URL
 */
export async function getVoicemailById(id, tenantId) {
  const db = getDatabase();

  const voicemail = await db.voicemail.findFirst({
    where: { id, tenantId },
    include: {
      phoneNumber: { select: { phoneNumber: true, friendlyName: true } },
      call: {
        select: {
          id: true,
          livekitRoom: true,
          status: true,
          callerName: true,
          callerPhone: true,
          durationSeconds: true,
        },
      },
    },
  });

  if (!voicemail) return null;

  // Generate a signed download URL (valid for 1 hour)
  const audioUrl = await getDownloadUrl(voicemail.s3Key, voicemail.s3Bucket, 3600);

  return { ...voicemail, audioUrl };
}

/**
 * Mark a voicemail as read
 */
export async function markAsRead(id, tenantId) {
  const db = getDatabase();
  return db.voicemail.updateMany({
    where: { id, tenantId },
    data: { isRead: true },
  });
}

/**
 * Mark a voicemail as unread
 */
export async function markAsUnread(id, tenantId) {
  const db = getDatabase();
  return db.voicemail.updateMany({
    where: { id, tenantId },
    data: { isRead: false },
  });
}

/**
 * Archive a voicemail
 */
export async function archiveVoicemail(id, tenantId) {
  const db = getDatabase();
  return db.voicemail.updateMany({
    where: { id, tenantId },
    data: { isArchived: true },
  });
}

/**
 * Unarchive a voicemail
 */
export async function unarchiveVoicemail(id, tenantId) {
  const db = getDatabase();
  return db.voicemail.updateMany({
    where: { id, tenantId },
    data: { isArchived: false },
  });
}

/**
 * Delete a voicemail (removes audio file + DB record)
 */
export async function deleteVoicemail(id, tenantId) {
  const db = getDatabase();

  const voicemail = await db.voicemail.findFirst({ where: { id, tenantId } });
  if (!voicemail) return null;

  // Delete audio file from storage
  try {
    await deleteFile(voicemail.s3Key, voicemail.s3Bucket);
  } catch (err) {
    log.warn('Failed to delete voicemail audio file', { error: err.message, key: voicemail.s3Key });
  }

  // Delete DB record
  await db.voicemail.delete({ where: { id } });
  log.info('Voicemail deleted', { voicemailId: id, tenantId });

  return voicemail;
}

/**
 * Transcribe a voicemail using ASR
 */
export async function transcribeVoicemail(id) {
  const db = getDatabase();

  const voicemail = await db.voicemail.findUnique({ where: { id } });
  if (!voicemail) {
    log.warn('Voicemail not found for transcription', { id });
    return null;
  }

  try {
    // Get the audio stream
    const audioStream = await getFileStream(voicemail.s3Key, voicemail.s3Bucket);

    // Collect stream into buffer
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    // Use Deepgram for transcription (same as ASR service)
    const deepgramKey = config.asr?.deepgramApiKey || process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      log.warn('No Deepgram API key configured, skipping voicemail transcription');
      return null;
    }

    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${deepgramKey}`,
        'Content-Type': voicemail.mimeType,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const durationMs = Math.round((result.metadata?.duration || 0) * 1000);

    // Update voicemail with transcript and duration
    await db.voicemail.update({
      where: { id },
      data: {
        transcript,
        ...(durationMs > 0 && { durationMs }),
      },
    });

    log.info('Voicemail transcribed', { voicemailId: id, transcriptLength: transcript.length });

    // Notify via WebSocket
    emitToTenant(voicemail.tenantId, 'voicemail:transcribed', {
      id: voicemail.id,
      transcript,
    });

    return transcript;
  } catch (error) {
    log.error('Voicemail transcription error', { error: error.message, voicemailId: id });
    return null;
  }
}

/**
 * Bulk mark voicemails as read
 */
export async function bulkMarkAsRead(ids, tenantId) {
  const db = getDatabase();
  return db.voicemail.updateMany({
    where: { id: { in: ids }, tenantId },
    data: { isRead: true },
  });
}

/**
 * Get voicemail stats for a tenant
 */
export async function getVoicemailStats(tenantId) {
  const db = getDatabase();

  const [total, unread, urgent, today] = await Promise.all([
    db.voicemail.count({ where: { tenantId, isArchived: false } }),
    db.voicemail.count({ where: { tenantId, isRead: false, isArchived: false } }),
    db.voicemail.count({ where: { tenantId, isUrgent: true, isArchived: false, isRead: false } }),
    db.voicemail.count({
      where: {
        tenantId,
        isArchived: false,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  return { total, unread, urgent, today };
}

export default {
  createVoicemail,
  getVoicemails,
  getVoicemailById,
  markAsRead,
  markAsUnread,
  archiveVoicemail,
  unarchiveVoicemail,
  deleteVoicemail,
  transcribeVoicemail,
  bulkMarkAsRead,
  getVoicemailStats,
};
