/**
 * Google Calendar Service
 * Create, update, delete calendar events
 */

import { google } from 'googleapis';
import config from '../config/index.js';
import { logger } from '../lib/logger.js';

// Create OAuth2 client
function getOAuth2Client(refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    config.googleCalendar.clientId,
    config.googleCalendar.clientSecret,
    config.googleCalendar.redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Create a Google Calendar event
 */
export async function createGoogleCalendarEvent(tenantConfig, eventData) {
  if (!tenantConfig.googleRefreshToken || !tenantConfig.googleCalendarId) {
    throw new Error('Google Calendar not configured');
  }

  const auth = getOAuth2Client(tenantConfig.googleRefreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const endTime = new Date(eventData.startTime);
  endTime.setMinutes(endTime.getMinutes() + eventData.durationMinutes);

  const event = {
    summary: eventData.title,
    description: eventData.description,
    start: {
      dateTime: eventData.startTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'UTC',
    },
    attendees: eventData.attendeeEmail
      ? [{ email: eventData.attendeeEmail, displayName: eventData.attendeeName }]
      : [],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: tenantConfig.googleCalendarId,
      resource: event,
      sendUpdates: 'all',
    });

    logger.info('Google Calendar event created', { eventId: response.data.id });

    return response.data;
  } catch (error) {
    logger.error('Failed to create Google Calendar event', { error: error.message });
    throw error;
  }
}

/**
 * Update a Google Calendar event
 */
export async function updateGoogleCalendarEvent(tenantConfig, eventId, eventData) {
  if (!tenantConfig.googleRefreshToken || !tenantConfig.googleCalendarId) {
    throw new Error('Google Calendar not configured');
  }

  const auth = getOAuth2Client(tenantConfig.googleRefreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const updateData = {};

  if (eventData.title) {
    updateData.summary = eventData.title;
  }

  if (eventData.description !== undefined) {
    updateData.description = eventData.description;
  }

  if (eventData.startTime) {
    const endTime = new Date(eventData.startTime);
    endTime.setMinutes(endTime.getMinutes() + (eventData.durationMinutes || 30));

    updateData.start = {
      dateTime: eventData.startTime.toISOString(),
      timeZone: 'UTC',
    };
    updateData.end = {
      dateTime: endTime.toISOString(),
      timeZone: 'UTC',
    };
  }

  try {
    const response = await calendar.events.patch({
      calendarId: tenantConfig.googleCalendarId,
      eventId,
      resource: updateData,
      sendUpdates: 'all',
    });

    logger.info('Google Calendar event updated', { eventId });

    return response.data;
  } catch (error) {
    logger.error('Failed to update Google Calendar event', { error: error.message });
    throw error;
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteGoogleCalendarEvent(tenantConfig, eventId) {
  if (!tenantConfig.googleRefreshToken || !tenantConfig.googleCalendarId) {
    throw new Error('Google Calendar not configured');
  }

  const auth = getOAuth2Client(tenantConfig.googleRefreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    await calendar.events.delete({
      calendarId: tenantConfig.googleCalendarId,
      eventId,
      sendUpdates: 'all',
    });

    logger.info('Google Calendar event deleted', { eventId });
  } catch (error) {
    logger.error('Failed to delete Google Calendar event', { error: error.message });
    throw error;
  }
}

/**
 * Get available time slots from calendar
 */
export async function getAvailableSlots(tenantConfig, date, durationMinutes = 30) {
  if (!tenantConfig.googleRefreshToken || !tenantConfig.googleCalendarId) {
    throw new Error('Google Calendar not configured');
  }

  const auth = getOAuth2Client(tenantConfig.googleRefreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const response = await calendar.freebusy.query({
      resource: {
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        items: [{ id: tenantConfig.googleCalendarId }],
      },
    });

    const busySlots = response.data.calendars[tenantConfig.googleCalendarId]?.busy || [];

    // Generate available slots (assuming 9 AM - 5 PM business hours)
    const slots = [];
    const businessStart = 9; // 9 AM
    const businessEnd = 17; // 5 PM

    for (let hour = businessStart; hour < businessEnd; hour++) {
      for (let minute = 0; minute < 60; minute += durationMinutes) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

        // Check if slot conflicts with busy times
        const isAvailable = !busySlots.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        if (isAvailable && slotStart > new Date()) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
        }
      }
    }

    return slots;
  } catch (error) {
    logger.error('Failed to get available slots', { error: error.message });
    throw error;
  }
}

export default {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getAvailableSlots,
};
