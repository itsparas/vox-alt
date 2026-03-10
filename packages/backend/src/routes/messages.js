/**
 * Messages Routes
 * SMS messaging – send, list, search
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { sendSMS } from '../services/twilio.js';

const router = Router();

/**
 * GET /api/messages
 * List messages with filtering and pagination
 */
router.get('/',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 50,
      direction,
      phoneNumberId,
      search,
      startDate,
      endDate,
    } = req.query;
    const db = getDatabase();
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = {
      tenantId: req.tenantId,
      ...(direction && { direction }),
      ...(phoneNumberId && { phoneNumberId }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
      ...(search && {
        OR: [
          { body: { contains: search, mode: 'insensitive' } },
          { from: { contains: search } },
          { to: { contains: search } },
        ],
      }),
    };

    const [messages, total] = await Promise.all([
      db.message.findMany({
        where,
        skip,
        take: parseInt(limit, 10),
        orderBy: { createdAt: 'desc' },
        include: {
          phoneNumber: {
            select: { phoneNumber: true, friendlyName: true },
          },
        },
      }),
      db.message.count({ where }),
    ]);

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  })
);

/**
 * GET /api/messages/conversations
 * Get conversations grouped by phone number (unique from/to pairs)
 */
router.get('/conversations',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    // Get the latest message for each unique conversation thread
    const messages = await db.message.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        phoneNumber: {
          select: { phoneNumber: true, friendlyName: true },
        },
      },
    });

    // Group by external number (the non-tenant number)
    const conversations = new Map();
    for (const msg of messages) {
      const externalNumber = msg.direction === 'INBOUND' ? msg.from : msg.to;
      if (!conversations.has(externalNumber)) {
        conversations.set(externalNumber, {
          externalNumber,
          lastMessage: msg,
          messageCount: 1,
          unreadCount: msg.direction === 'INBOUND' ? 1 : 0,
        });
      } else {
        const conv = conversations.get(externalNumber);
        conv.messageCount++;
        if (msg.direction === 'INBOUND') conv.unreadCount++;
      }
    }

    res.json({
      success: true,
      data: Array.from(conversations.values()),
    });
  })
);

/**
 * GET /api/messages/thread/:phoneNumber
 * Get a conversation thread with a specific phone number
 */
router.get('/thread/:phoneNumber',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const externalNumber = decodeURIComponent(req.params.phoneNumber);
    const { page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const messages = await db.message.findMany({
      where: {
        tenantId: req.tenantId,
        OR: [
          { from: externalNumber },
          { to: externalNumber },
        ],
      },
      skip,
      take: parseInt(limit, 10),
      orderBy: { createdAt: 'asc' }, // Chronological for threads
      include: {
        phoneNumber: {
          select: { phoneNumber: true, friendlyName: true },
        },
      },
    });

    res.json({
      success: true,
      data: messages,
    });
  })
);

/**
 * GET /api/messages/:id
 * Get a specific message
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const message = await db.message.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        phoneNumber: {
          select: { phoneNumber: true, friendlyName: true },
        },
        call: {
          select: { id: true, callerName: true, status: true },
        },
      },
    });

    if (!message) {
      throw ApiError.notFound('Message not found');
    }

    res.json({
      success: true,
      data: message,
    });
  })
);

/**
 * POST /api/messages
 * Send an SMS message
 */
router.post('/',
  authenticate,
  tenantIsolation,
  body('to')
    .isString()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Destination must be in E.164 format'),
  body('body')
    .isString()
    .isLength({ min: 1, max: 1600 })
    .withMessage('Message body must be 1-1600 characters'),
  body('phoneNumberId')
    .isUUID()
    .withMessage('phoneNumberId must be a valid UUID'),
  asyncHandler(async (req, res) => {
    const { to, body: messageBody, phoneNumberId, metadata } = req.body;

    const message = await sendSMS({
      to,
      body: messageBody,
      phoneNumberId,
      tenantId: req.tenantId,
      metadata,
    });

    logger.info('SMS sent via API', {
      messageId: message.id,
      to,
      tenantId: req.tenantId,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: message,
    });
  })
);

/**
 * GET /api/messages/stats/summary
 * Get SMS statistics
 */
router.get('/stats/summary',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const [totalSent, totalReceived, totalFailed] = await Promise.all([
      db.message.count({
        where: {
          tenantId: req.tenantId,
          direction: 'OUTBOUND',
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        },
      }),
      db.message.count({
        where: {
          tenantId: req.tenantId,
          direction: 'INBOUND',
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        },
      }),
      db.message.count({
        where: {
          tenantId: req.tenantId,
          status: 'FAILED',
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalSent,
        totalReceived,
        totalFailed,
        total: totalSent + totalReceived,
      },
    });
  })
);

export default router;
