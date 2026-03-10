/**
 * Voicemail Routes
 * CRUD + audio playback for voicemails
 */

import { Router } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, authorize } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  getVoicemails,
  getVoicemailById,
  createVoicemail,
  markAsRead,
  markAsUnread,
  archiveVoicemail,
  unarchiveVoicemail,
  deleteVoicemail,
  bulkMarkAsRead,
  getVoicemailStats,
} from '../services/voicemail.js';
import { getFileStream } from '../services/storage.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/voicemails
 * List voicemails with filtering and pagination
 */
router.get('/',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { page, limit, isRead, isArchived, isUrgent, search, startDate, endDate } = req.query;

    const filters = {
      page,
      limit,
      search,
      startDate,
      endDate,
    };

    // Parse boolean filters
    if (isRead !== undefined) filters.isRead = isRead === 'true';
    if (isArchived !== undefined) filters.isArchived = isArchived === 'true';
    if (isUrgent !== undefined) filters.isUrgent = isUrgent === 'true';

    const result = await getVoicemails(req.tenantId, filters);

    res.json({
      success: true,
      data: result.voicemails,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  })
);

/**
 * GET /api/voicemails/stats
 * Get voicemail statistics
 */
router.get('/stats',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const stats = await getVoicemailStats(req.tenantId);
    res.json({ success: true, data: stats });
  })
);

/**
 * GET /api/voicemails/:id
 * Get a single voicemail with signed audio URL
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid voicemail ID');
    }

    const voicemail = await getVoicemailById(req.params.id, req.tenantId);
    if (!voicemail) {
      throw ApiError.notFound('Voicemail not found');
    }

    res.json({ success: true, data: voicemail });
  })
);

/**
 * GET /api/voicemails/:id/audio
 * Stream voicemail audio
 */
router.get('/:id/audio',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid voicemail ID');
    }

    const db = getDatabase();
    const voicemail = await db.voicemail.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!voicemail) {
      throw ApiError.notFound('Voicemail not found');
    }

    const stream = await getFileStream(voicemail.s3Key, voicemail.s3Bucket);

    res.setHeader('Content-Type', voicemail.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="voicemail-${voicemail.id}.webm"`);
    if (voicemail.fileSize) {
      res.setHeader('Content-Length', voicemail.fileSize);
    }

    stream.pipe(res);
  })
);

/**
 * PUT /api/voicemails/:id/read
 * Mark voicemail as read
 */
router.put('/:id/read',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid voicemail ID');
    }

    await markAsRead(req.params.id, req.tenantId);
    res.json({ success: true, message: 'Voicemail marked as read' });
  })
);

/**
 * PUT /api/voicemails/:id/unread
 * Mark voicemail as unread
 */
router.put('/:id/unread',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid voicemail ID');
    }

    await markAsUnread(req.params.id, req.tenantId);
    res.json({ success: true, message: 'Voicemail marked as unread' });
  })
);

/**
 * PUT /api/voicemails/:id/archive
 * Archive a voicemail
 */
router.put('/:id/archive',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid voicemail ID');
    }

    await archiveVoicemail(req.params.id, req.tenantId);
    res.json({ success: true, message: 'Voicemail archived' });
  })
);

/**
 * PUT /api/voicemails/:id/unarchive
 * Unarchive a voicemail
 */
router.put('/:id/unarchive',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid voicemail ID');
    }

    await unarchiveVoicemail(req.params.id, req.tenantId);
    res.json({ success: true, message: 'Voicemail unarchived' });
  })
);

/**
 * DELETE /api/voicemails/:id
 * Delete a voicemail
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'AGENT'),
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid voicemail ID');
    }

    const deleted = await deleteVoicemail(req.params.id, req.tenantId);
    if (!deleted) {
      throw ApiError.notFound('Voicemail not found');
    }

    res.json({ success: true, message: 'Voicemail deleted' });
  })
);

/**
 * POST /api/voicemails/bulk/read
 * Bulk mark voicemails as read
 */
router.post('/bulk/read',
  authenticate,
  tenantIsolation,
  body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid request body');
    }

    const result = await bulkMarkAsRead(req.body.ids, req.tenantId);
    res.json({ success: true, message: `${result.count} voicemails marked as read` });
  })
);

export default router;
