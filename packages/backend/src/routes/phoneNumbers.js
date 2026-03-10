/**
 * Phone Number Routes
 * Manage Twilio phone numbers – search, provision, configure, release
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, authorize } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import {
  searchAvailableNumbers,
  searchTollFreeNumbers,
  provisionNumber,
  releaseNumber,
  updateNumberConfig,
  setupBYON,
  confirmBYONForwarding,
} from '../services/twilio.js';

const router = Router();

/**
 * GET /api/phone-numbers/available
 * Search for available phone numbers to purchase
 */
router.get('/available',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const {
      country = 'US',
      areaCode,
      contains,
      type = 'local',
      limit = 20,
    } = req.query;

    let numbers;
    if (type === 'tollFree') {
      numbers = await searchTollFreeNumbers({
        country,
        contains,
        limit: parseInt(limit, 10),
      });
    } else {
      numbers = await searchAvailableNumbers({
        country,
        areaCode,
        contains,
        limit: parseInt(limit, 10),
      });
    }

    res.json({
      success: true,
      data: numbers,
    });
  })
);

/**
 * GET /api/phone-numbers
 * List all phone numbers for the tenant
 */
router.get('/',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const { status } = req.query;

    const where = {
      tenantId: req.tenantId,
      ...(status && { status }),
    };

    const phoneNumbers = await db.phoneNumber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    res.json({
      success: true,
      data: phoneNumbers,
    });
  })
);

/**
 * GET /api/phone-numbers/:id
 * Get a specific phone number
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const phoneNumber = await db.phoneNumber.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!phoneNumber) {
      throw ApiError.notFound('Phone number not found');
    }

    res.json({
      success: true,
      data: phoneNumber,
    });
  })
);

/**
 * POST /api/phone-numbers
 * Provision (purchase) a new phone number
 */
router.post('/',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'SUPER_ADMIN'),
  body('phoneNumber')
    .isString()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +15551234567)'),
  asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;
    const db = getDatabase();

    // Check plan limits for phone numbers
    const existingCount = await db.phoneNumber.count({
      where: { tenantId: req.tenantId, status: 'ACTIVE' },
    });

    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
    });

    const planLimits = {
      BASIC: 1,
      PRO: 5,
      ENTERPRISE: -1, // unlimited
    };

    const maxNumbers = planLimits[tenant.planId] || 1;
    if (maxNumbers !== -1 && existingCount >= maxNumbers) {
      throw ApiError.forbidden(
        `Your ${tenant.planId} plan allows a maximum of ${maxNumbers} phone number(s). Please upgrade to add more.`
      );
    }

    const phoneRecord = await provisionNumber(phoneNumber, req.tenantId);

    logger.info('Phone number provisioned via API', {
      phoneNumber,
      tenantId: req.tenantId,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: phoneRecord,
    });
  })
);

/**
 * POST /api/phone-numbers/byon
 * Bring Your Own Number — register your existing mobile/landline
 * Provisions a Twilio number behind the scenes and returns forwarding instructions
 */
router.post('/byon',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'SUPER_ADMIN'),
  body('businessNumber')
    .isString()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +15551234567)'),
  body('country').optional().isString().default('US'),
  body('areaCode').optional().isString(),
  asyncHandler(async (req, res) => {
    const { businessNumber, country, areaCode } = req.body;
    const db = getDatabase();

    // Check plan limits
    const existingCount = await db.phoneNumber.count({
      where: { tenantId: req.tenantId, status: 'ACTIVE' },
    });

    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
    });

    const planLimits = { BASIC: 1, PRO: 5, ENTERPRISE: -1 };
    const maxNumbers = planLimits[tenant.planId] || 1;
    if (maxNumbers !== -1 && existingCount >= maxNumbers) {
      throw ApiError.forbidden(
        `Your ${tenant.planId} plan allows a maximum of ${maxNumbers} phone number(s). Please upgrade to add more.`
      );
    }

    // Check if this business number is already registered
    const existing = await db.phoneNumber.findFirst({
      where: { businessNumber, tenantId: req.tenantId, status: 'ACTIVE' },
    });
    if (existing) {
      throw ApiError.conflict('This phone number is already registered.');
    }

    const result = await setupBYON(businessNumber, req.tenantId, { country, areaCode });

    logger.info('BYON number set up via API', {
      businessNumber,
      twilioNumber: result.phoneNumber,
      tenantId: req.tenantId,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

/**
 * PUT /api/phone-numbers/:id/confirm-forwarding
 * Tenant confirms they set up call forwarding
 */
router.put('/:id/confirm-forwarding',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'SUPER_ADMIN'),
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const updated = await confirmBYONForwarding(req.params.id, req.tenantId);
    res.json({ success: true, data: updated });
  })
);

/**
 * GET /api/phone-numbers/:id/forwarding-instructions
 * Get forwarding instructions for a BYON number
 */
router.get('/:id/forwarding-instructions',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const phoneNumber = await db.phoneNumber.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });

    if (!phoneNumber) {
      throw ApiError.notFound('Phone number not found');
    }

    if (phoneNumber.numberType !== 'byon') {
      throw ApiError.badRequest('This is not a BYON number');
    }

    // Re-import and call the builder
    const { default: twilioService } = await import('../services/twilio.js');
    // We can reconstruct instructions from the stored data
    const dialNumber = phoneNumber.phoneNumber.replace('+', '');
    const forwardingInstructions = {
      twilioNumber: phoneNumber.phoneNumber,
      businessNumber: phoneNumber.businessNumber,
      summary: `Forward calls from ${phoneNumber.businessNumber} to ${phoneNumber.phoneNumber}`,
      confirmed: phoneNumber.forwardingSetup,
      methods: [
        {
          name: 'Unconditional Forwarding (All Calls)',
          description: 'All incoming calls go to AI receptionist',
          steps: [
            'Open the Phone app on your mobile',
            `Dial *72${dialNumber} and press Call`,
            'Wait for confirmation tone, then hang up',
            `All calls to ${phoneNumber.businessNumber} will now go to your AI receptionist`,
          ],
        },
        {
          name: 'Conditional Forwarding (Unanswered/Busy)',
          description: 'Only forwards when you don\'t answer or are busy',
          steps: [
            'Open the Phone app on your mobile',
            `Dial *71${dialNumber} and press Call (for no-answer)`,
            `Or dial *67${dialNumber} and press Call (for busy)`,
            'Calls you miss will go to your AI receptionist',
          ],
        },
        {
          name: 'iPhone Settings',
          steps: [
            'Go to Settings → Phone → Call Forwarding',
            'Toggle Call Forwarding ON',
            `Enter the number: ${phoneNumber.phoneNumber}`,
            'Go back — forwarding is now active',
          ],
        },
        {
          name: 'Android Settings',
          steps: [
            'Open Phone app → tap ⋮ menu → Settings',
            'Tap "Supplementary services" or "Call forwarding"',
            'Select "Always forward" or "Forward when unanswered"',
            `Enter the number: ${phoneNumber.phoneNumber}`,
            'Tap Enable / Turn On',
          ],
        },
      ],
    };

    res.json({ success: true, data: forwardingInstructions });
  })
);

/**
 * PUT /api/phone-numbers/:id
 * Update phone number configuration
 */
router.put('/:id',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'SUPER_ADMIN'),
  param('id').isUUID(),
  body('friendlyName').optional().isString().trim(),
  body('forwardingNumber').optional({ nullable: true })
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Forwarding number must be in E.164 format'),
  body('voicemailEnabled').optional().isBoolean(),
  body('smsEnabled').optional().isBoolean(),
  asyncHandler(async (req, res) => {
    const { friendlyName, forwardingNumber, voicemailEnabled, smsEnabled } = req.body;

    const updated = await updateNumberConfig(req.params.id, req.tenantId, {
      friendlyName,
      forwardingNumber,
      voicemailEnabled,
      smsEnabled,
    });

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * DELETE /api/phone-numbers/:id
 * Release (cancel) a phone number
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'SUPER_ADMIN'),
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    await releaseNumber(req.params.id, req.tenantId);

    logger.info('Phone number released via API', {
      phoneNumberId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
    });

    res.json({
      success: true,
      message: 'Phone number released successfully',
    });
  })
);

export default router;
