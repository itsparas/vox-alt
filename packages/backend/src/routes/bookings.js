/**
 * Booking Routes
 * Booking/appointment management
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { bookingsTotal } from '../lib/metrics.js';
import { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from '../services/googleCalendar.js';

const router = Router();

/**
 * POST /api/bookings
 * Create a new booking
 */
router.post('/',
  authenticate,
  tenantIsolation,
  [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('scheduledAt').isISO8601(),
    body('durationMinutes').optional().isInt({ min: 5, max: 480 }),
    body('contactName').trim().isLength({ min: 1, max: 200 }),
    body('contactEmail').optional().isEmail(),
    body('contactPhone').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Validation failed', errors.array());
    }

    const {
      title,
      description,
      scheduledAt,
      durationMinutes = 30,
      timezone = 'UTC',
      contactName,
      contactEmail,
      contactPhone,
      callId,
      metadata,
    } = req.body;

    const db = getDatabase();

    // Get tenant config for Google Calendar integration
    const tenantConfig = await db.tenantConfig.findUnique({
      where: { tenantId: req.tenantId },
    });

    let googleEventId = null;

    // Create Google Calendar event if enabled
    if (tenantConfig?.googleCalendarEnabled && tenantConfig?.googleCalendarId) {
      try {
        const event = await createGoogleCalendarEvent(tenantConfig, {
          title,
          description,
          startTime: new Date(scheduledAt),
          durationMinutes,
          attendeeEmail: contactEmail,
          attendeeName: contactName,
        });
        googleEventId = event.id;
      } catch (error) {
        logger.warn('Failed to create Google Calendar event', { error: error.message });
        // Continue without calendar event
      }
    }

    const booking = await db.booking.create({
      data: {
        tenantId: req.tenantId,
        callId,
        userId: req.user.id,
        title,
        description,
        status: 'PENDING',
        scheduledAt: new Date(scheduledAt),
        durationMinutes,
        timezone,
        contactName,
        contactEmail,
        contactPhone,
        googleEventId,
        metadata,
      },
    });

    // Update metrics
    bookingsTotal.inc({ tenant_id: req.tenantId, status: 'created' });

    // Log booking creation
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'booking.created',
        resourceType: 'booking',
        resourceId: booking.id,
      },
    });

    logger.info('Booking created', { bookingId: booking.id, scheduledAt });

    res.status(201).json({
      success: true,
      data: booking,
    });
  })
);

/**
 * GET /api/bookings
 * List bookings with filtering
 */
router.get('/',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    const db = getDatabase();

    const where = {
      tenantId: req.tenantId,
      ...(status && { status }),
      ...(startDate && { scheduledAt: { gte: new Date(startDate) } }),
      ...(endDate && { scheduledAt: { lte: new Date(endDate) } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
          { contactEmail: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        include: {
          user: {
            select: { id: true, displayName: true },
          },
          call: {
            select: { id: true, livekitRoom: true, status: true },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      db.booking.count({ where }),
    ]);

    res.json({
      success: true,
      data: bookings,
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
 * GET /api/bookings/upcoming
 * List upcoming bookings
 */
router.get('/upcoming',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;
    const db = getDatabase();

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));

    const bookings = await db.booking.findMany({
      where: {
        tenantId: req.tenantId,
        scheduledAt: {
          gte: new Date(),
          lte: endDate,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    res.json({
      success: true,
      data: bookings,
    });
  })
);

/**
 * GET /api/bookings/:id
 * Get booking details
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const booking = await db.booking.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
        call: {
          select: { id: true, livekitRoom: true, status: true, callerName: true },
        },
      },
    });

    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    res.json({
      success: true,
      data: booking,
    });
  })
);

/**
 * PUT /api/bookings/:id
 * Update booking
 */
router.put('/:id',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      title,
      description,
      scheduledAt,
      durationMinutes,
      status,
      contactName,
      contactEmail,
      contactPhone,
    } = req.body;

    const db = getDatabase();

    const existingBooking = await db.booking.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existingBooking) {
      throw ApiError.notFound('Booking not found');
    }

    const updateData = {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      ...(durationMinutes && { durationMinutes }),
      ...(status && { status }),
      ...(contactName && { contactName }),
      ...(contactEmail && { contactEmail }),
      ...(contactPhone !== undefined && { contactPhone }),
    };

    // Update Google Calendar event if exists
    if (existingBooking.googleEventId) {
      const tenantConfig = await db.tenantConfig.findUnique({
        where: { tenantId: req.tenantId },
      });

      if (tenantConfig?.googleCalendarEnabled) {
        try {
          await updateGoogleCalendarEvent(tenantConfig, existingBooking.googleEventId, {
            title: updateData.title || existingBooking.title,
            description: updateData.description ?? existingBooking.description,
            startTime: updateData.scheduledAt || existingBooking.scheduledAt,
            durationMinutes: updateData.durationMinutes || existingBooking.durationMinutes,
          });
        } catch (error) {
          logger.warn('Failed to update Google Calendar event', { error: error.message });
        }
      }
    }

    const booking = await db.booking.update({
      where: { id },
      data: updateData,
    });

    // Log update
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'booking.updated',
        resourceType: 'booking',
        resourceId: id,
        metadata: { updatedFields: Object.keys(updateData) },
      },
    });

    logger.info('Booking updated', { bookingId: id });

    res.json({
      success: true,
      data: booking,
    });
  })
);

/**
 * POST /api/bookings/:id/confirm
 * Confirm booking
 */
router.post('/:id/confirm',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const booking = await db.booking.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });

    bookingsTotal.inc({ tenant_id: req.tenantId, status: 'confirmed' });

    res.json({
      success: true,
      data: booking,
    });
  })
);

/**
 * POST /api/bookings/:id/cancel
 * Cancel booking
 */
router.post('/:id/cancel',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const db = getDatabase();

    const existingBooking = await db.booking.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existingBooking) {
      throw ApiError.notFound('Booking not found');
    }

    // Delete Google Calendar event if exists
    if (existingBooking.googleEventId) {
      const tenantConfig = await db.tenantConfig.findUnique({
        where: { tenantId: req.tenantId },
      });

      if (tenantConfig?.googleCalendarEnabled) {
        try {
          await deleteGoogleCalendarEvent(tenantConfig, existingBooking.googleEventId);
        } catch (error) {
          logger.warn('Failed to delete Google Calendar event', { error: error.message });
        }
      }
    }

    const booking = await db.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...existingBooking.metadata,
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    bookingsTotal.inc({ tenant_id: req.tenantId, status: 'cancelled' });

    // Log cancellation
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'booking.cancelled',
        resourceType: 'booking',
        resourceId: id,
        metadata: { reason },
      },
    });

    res.json({
      success: true,
      data: booking,
    });
  })
);

/**
 * DELETE /api/bookings/:id
 * Delete booking
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const booking = await db.booking.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    // Delete Google Calendar event if exists
    if (booking.googleEventId) {
      const tenantConfig = await db.tenantConfig.findUnique({
        where: { tenantId: req.tenantId },
      });

      if (tenantConfig?.googleCalendarEnabled) {
        try {
          await deleteGoogleCalendarEvent(tenantConfig, booking.googleEventId);
        } catch (error) {
          logger.warn('Failed to delete Google Calendar event', { error: error.message });
        }
      }
    }

    await db.booking.delete({ where: { id } });

    logger.info('Booking deleted', { bookingId: id });

    res.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  })
);

export default router;
