/**
 * Twilio Media Stream WebSocket Upgrade Handler
 * 
 * Intercepts HTTP upgrade requests for the path /api/webhooks/twilio/stream
 * and hands them off to the TwilioStreamHandler for audio processing.
 */

import { WebSocketServer } from 'ws';
import { parse as parseUrl } from 'url';
import { getDatabase } from '../db/index.js';
import { handleTwilioStream, getActiveStreamCount } from '../services/twilioStreamHandler.js';
import { logger as log } from '../lib/logger.js';

let wss = null;

/**
 * Initialize the WebSocket upgrade handler for Twilio Media Streams.
 * Must be called after the HTTP server is created but before listening.
 * 
 * @param {import('http').Server} httpServer
 */
export function initializeTwilioStreamUpgrade(httpServer) {
  // Create a standalone WSS with noServer so we manually handle upgrades
  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const { pathname } = parseUrl(request.url);

    // Only handle Twilio stream path — let Socket.IO handle everything else
    if (pathname === '/api/webhooks/twilio/stream') {
      log.info('Twilio stream WebSocket upgrade request', {
        path: pathname,
        remoteAddress: request.socket.remoteAddress,
      });

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // All other upgrade requests are handled by Socket.IO (already attached)
  });

  wss.on('connection', async (ws, request) => {
    log.info('New Twilio stream WebSocket connection', {
      activeStreams: getActiveStreamCount(),
    });

    try {
      // We need to find which call this stream belongs to.
      // The 'start' event from Twilio will tell us the callSid,
      // but we need the call record to instantiate the handler.
      // Strategy: wait for the 'start' message, then look up the call.
      
      let initTimeout = null;
      let initialized = false;

      const onMessage = async (raw) => {
        if (initialized) return; // Already handed off

        try {
          const msg = JSON.parse(raw);

          if (msg.event === 'connected') {
            // Twilio connected, waiting for 'start'
            log.info('Twilio stream connected, waiting for start event');
            return;
          }

          if (msg.event === 'start') {
            initialized = true;
            clearTimeout(initTimeout);
            ws.removeListener('message', onMessage);

            const { callSid, streamSid, tracks, customParameters } = msg.start;
            log.info('Twilio stream start received', { callSid, streamSid, tracks });

            const db = getDatabase();

            // Find the call record by Twilio CallSid in metadata
            const calls = await db.call.findMany({
              where: {
                metadata: {
                  path: ['twilioCallSid'],
                  equals: callSid,
                },
              },
              include: {
                tenant: {
                  include: { config: true },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            });

            if (calls.length === 0) {
              log.error('No call record found for Twilio CallSid', { callSid });
              ws.close(1008, 'Call not found');
              return;
            }

            const callRecord = calls[0];
            const tenant = callRecord.tenant;
            const tenantConfig = tenant.config || {};

            // Merge tenant config into a flat object for the handler
            const mergedTenant = {
              ...tenant,
              config: {
                ...tenantConfig,
                businessName: tenant.name,
              },
            };

            log.info('Starting TwilioStreamHandler', {
              callId: callRecord.id,
              tenantId: tenant.id,
              callSid,
              streamSid,
            });

            // Hand off to TwilioStreamHandler
            // Re-dispatch the 'start' message since the handler missed it
            const handler = handleTwilioStream(ws, callRecord, mergedTenant);

            // Re-process the start message in the handler
            handler.handleMessage(raw);
          }
        } catch (err) {
          log.error('Error during Twilio stream init', { error: err.message });
          ws.close(1011, 'Init error');
        }
      };

      ws.on('message', onMessage);

      // Timeout: if no 'start' event within 30s, close
      initTimeout = setTimeout(() => {
        if (!initialized) {
          log.warn('Twilio stream init timeout — no start event received');
          ws.close(1000, 'Timeout');
        }
      }, 30000);

    } catch (err) {
      log.error('Failed to handle Twilio stream connection', { error: err.message });
      ws.close(1011, 'Server error');
    }
  });

  log.info('Twilio stream WebSocket upgrade handler registered');
}

export default { initializeTwilioStreamUpgrade };
