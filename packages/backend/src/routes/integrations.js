/**
 * Integration Routes
 * External service integrations (Google Calendar, etc.)
 */

import { Router } from 'express';
import { google } from 'googleapis';
import config from '../config/index.js';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, authorize } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  config.googleCalendar.clientId,
  config.googleCalendar.clientSecret,
  config.googleCalendar.redirectUri
);

/**
 * GET /api/integrations/google/auth-url
 * Get Google OAuth2 authorization URL
 */
router.get('/google/auth-url',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    if (!config.googleCalendar.clientId) {
      throw ApiError.badRequest('Google Calendar integration not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.tenantId, // Pass tenant ID for callback
      prompt: 'consent',
    });

    res.json({
      success: true,
      data: { url },
    });
  })
);

/**
 * GET /api/integrations/google/callback
 * Handle Google OAuth2 callback
 */
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, state: tenantId } = req.query;

  if (!code || !tenantId) {
    throw ApiError.badRequest('Missing authorization code or tenant');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const db = getDatabase();

    // Store refresh token
    await db.tenantConfig.update({
      where: { tenantId },
      data: {
        googleCalendarEnabled: true,
        googleRefreshToken: tokens.refresh_token,
      },
    });

    logger.info('Google Calendar connected', { tenantId });

    // Redirect to frontend
    res.redirect(`${config.frontendUrl}/settings/integrations?google=success`);
  } catch (error) {
    logger.error('Google OAuth callback error', { error: error.message });
    res.redirect(`${config.frontendUrl}/settings/integrations?google=error`);
  }
}));

/**
 * POST /api/integrations/google/disconnect
 * Disconnect Google Calendar
 */
router.post('/google/disconnect',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    await db.tenantConfig.update({
      where: { tenantId: req.tenantId },
      data: {
        googleCalendarEnabled: false,
        googleRefreshToken: null,
        googleCalendarId: null,
      },
    });

    logger.info('Google Calendar disconnected', { tenantId: req.tenantId });

    res.json({
      success: true,
      message: 'Google Calendar disconnected',
    });
  })
);

/**
 * GET /api/integrations/google/calendars
 * List available Google calendars
 */
router.get('/google/calendars',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const tenantConfig = await db.tenantConfig.findUnique({
      where: { tenantId: req.tenantId },
    });

    if (!tenantConfig?.googleRefreshToken) {
      throw ApiError.badRequest('Google Calendar not connected');
    }

    oauth2Client.setCredentials({
      refresh_token: tenantConfig.googleRefreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.calendarList.list();
    
    res.json({
      success: true,
      data: response.data.items?.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary,
        accessRole: cal.accessRole,
      })) || [],
    });
  })
);

/**
 * POST /api/integrations/google/calendars/select
 * Select calendar for bookings
 */
router.post('/google/calendars/select',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const { calendarId } = req.body;
    const db = getDatabase();

    await db.tenantConfig.update({
      where: { tenantId: req.tenantId },
      data: { googleCalendarId: calendarId },
    });

    res.json({
      success: true,
      message: 'Calendar selected',
    });
  })
);

/**
 * GET /api/integrations/status
 * Get integration status
 */
router.get('/status',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const tenantConfig = await db.tenantConfig.findUnique({
      where: { tenantId: req.tenantId },
    });

    res.json({
      success: true,
      data: {
        googleCalendar: {
          connected: !!tenantConfig?.googleRefreshToken,
          enabled: tenantConfig?.googleCalendarEnabled,
          calendarId: tenantConfig?.googleCalendarId,
        },
        // Add more integrations here
      },
    });
  })
);

/**
 * POST /api/integrations/test-webhook
 * Test webhook endpoint
 */
router.post('/test-webhook',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { url, payload } = req.body;

    if (!url) {
      throw ApiError.badRequest('Webhook URL required');
    }

    try {
      const axios = (await import('axios')).default;
      const response = await axios.post(url, payload || { test: true }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-VoxReception-Webhook': 'test',
        },
      });

      res.json({
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
        },
      });
    } catch (error) {
      throw ApiError.badRequest(`Webhook test failed: ${error.message}`);
    }
  })
);

export default router;
