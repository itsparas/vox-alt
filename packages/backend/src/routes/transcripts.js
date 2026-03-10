/**
 * Transcript Routes
 * Transcript management and search
 */

import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, authorize } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/transcripts
 * List transcripts with search
 */
router.get('/',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      search,
      language,
      startDate,
      endDate,
    } = req.query;

    const db = getDatabase();

    const where = {
      tenantId: req.tenantId,
      ...(language && { language }),
      ...(startDate && { createdAt: { gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { lte: new Date(endDate) } }),
      ...(search && {
        fullText: { contains: search, mode: 'insensitive' },
      }),
    };

    const [transcripts, total] = await Promise.all([
      db.transcript.findMany({
        where,
        include: {
          call: {
            select: {
              id: true,
              callerName: true,
              status: true,
              durationSeconds: true,
              primaryIntent: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      db.transcript.count({ where }),
    ]);

    res.json({
      success: true,
      data: transcripts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

/**
 * GET /api/transcripts/:id
 * Get transcript details
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const transcript = await db.transcript.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
      include: {
        call: {
          select: {
            id: true,
            callerName: true,
            callerEmail: true,
            status: true,
            durationSeconds: true,
            intents: true,
            primaryIntent: true,
            startedAt: true,
            endedAt: true,
          },
        },
      },
    });

    if (!transcript) {
      throw ApiError.notFound('Transcript not found');
    }

    res.json({
      success: true,
      data: transcript,
    });
  })
);

/**
 * PUT /api/transcripts/:id
 * Update transcript (for manual corrections)
 */
router.put('/:id',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN', 'AGENT'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { segments, fullText } = req.body;
    const db = getDatabase();

    const existingTranscript = await db.transcript.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existingTranscript) {
      throw ApiError.notFound('Transcript not found');
    }

    const transcript = await db.transcript.update({
      where: { id },
      data: {
        ...(segments && { segments }),
        ...(fullText && { fullText }),
      },
    });

    // Log update
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'transcript.updated',
        resourceType: 'transcript',
        resourceId: id,
      },
    });

    logger.info('Transcript updated', { transcriptId: id });

    res.json({
      success: true,
      data: transcript,
    });
  })
);

/**
 * POST /api/transcripts/:id/segments
 * Add segment to transcript (real-time updates)
 */
router.post('/:id/segments',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { segment } = req.body;
    const db = getDatabase();

    const transcript = await db.transcript.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!transcript) {
      throw ApiError.notFound('Transcript not found');
    }

    const segments = Array.isArray(transcript.segments)
      ? [...transcript.segments, segment]
      : [segment];

    // Update full text
    const fullText = segments.map(s => s.text).join(' ');

    const updatedTranscript = await db.transcript.update({
      where: { id },
      data: {
        segments,
        fullText,
      },
    });

    res.json({
      success: true,
      data: updatedTranscript,
    });
  })
);

/**
 * GET /api/transcripts/search
 * Full-text search across transcripts
 */
router.get('/search/text',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { q, limit = 50 } = req.query;

    if (!q || q.length < 2) {
      throw ApiError.badRequest('Search query must be at least 2 characters');
    }

    const db = getDatabase();

    const transcripts = await db.transcript.findMany({
      where: {
        tenantId: req.tenantId,
        fullText: {
          contains: q,
          mode: 'insensitive',
        },
      },
      include: {
        call: {
          select: {
            id: true,
            callerName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    // Highlight matching text
    const results = transcripts.map(t => {
      const regex = new RegExp(`(.{0,50})(${q})(.{0,50})`, 'gi');
      const matches = [];
      let match;
      
      while ((match = regex.exec(t.fullText)) !== null) {
        matches.push({
          before: match[1],
          match: match[2],
          after: match[3],
        });
      }

      return {
        id: t.id,
        callId: t.callId,
        call: t.call,
        language: t.language,
        matches: matches.slice(0, 3), // First 3 matches
        createdAt: t.createdAt,
      };
    });

    res.json({
      success: true,
      data: results,
      query: q,
      count: results.length,
    });
  })
);

/**
 * DELETE /api/transcripts/:id
 * Delete transcript
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    await db.transcript.delete({ where: { id } });

    logger.info('Transcript deleted', { transcriptId: id });

    res.json({
      success: true,
      message: 'Transcript deleted successfully',
    });
  })
);

/**
 * POST /api/transcripts/:id/export
 * Export transcript
 */
router.post('/:id/export',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { format = 'txt' } = req.body;
    const db = getDatabase();

    const transcript = await db.transcript.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        call: {
          select: {
            callerName: true,
            startedAt: true,
            endedAt: true,
          },
        },
      },
    });

    if (!transcript) {
      throw ApiError.notFound('Transcript not found');
    }

    let content;
    let contentType;
    let filename;

    switch (format) {
      case 'json':
        content = JSON.stringify(transcript, null, 2);
        contentType = 'application/json';
        filename = `transcript-${id}.json`;
        break;

      case 'srt':
        // SRT subtitle format
        content = transcript.segments.map((seg, i) => {
          const startTime = formatSrtTime(seg.start);
          const endTime = formatSrtTime(seg.end);
          return `${i + 1}\n${startTime} --> ${endTime}\n${seg.speaker}: ${seg.text}\n`;
        }).join('\n');
        contentType = 'text/srt';
        filename = `transcript-${id}.srt`;
        break;

      case 'txt':
      default:
        content = `Call Transcript\n`;
        content += `==================\n`;
        content += `Caller: ${transcript.call?.callerName || 'Unknown'}\n`;
        content += `Date: ${transcript.call?.startedAt || transcript.createdAt}\n`;
        content += `Language: ${transcript.language}\n\n`;
        content += transcript.segments.map(seg =>
          `[${formatTime(seg.start)}] ${seg.speaker}: ${seg.text}`
        ).join('\n');
        contentType = 'text/plain';
        filename = `transcript-${id}.txt`;
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  })
);

// Helper functions
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSrtTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

export default router;
