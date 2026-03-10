/**
 * WebSocket Server
 * Real-time communication for calls, transcripts, and events
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { logger, createLogger } from '../lib/logger.js';
import { wsConnectionsGauge, wsMessagesTotal } from '../lib/metrics.js';
import { getDatabase } from '../db/index.js';

const log = createLogger('websocket');

let io = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      socket.user = {
        id: decoded.userId,
        tenantId: decoded.tenantId,
        role: decoded.role,
      };

      next();
    } catch (error) {
      log.warn('WebSocket authentication failed', { error: error.message });
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const { user } = socket;
    
    log.info('WebSocket client connected', {
      userId: user.id,
      tenantId: user.tenantId,
    });

    wsConnectionsGauge.inc();

    // Join tenant room for broadcasts
    socket.join(`tenant:${user.tenantId}`);

    // Join user-specific room
    socket.join(`user:${user.id}`);

    // Handle joining call room
    socket.on('call:join', async (data) => {
      try {
        const { callId } = data;
        const db = getDatabase();

        // Verify call belongs to tenant
        const call = await db.call.findFirst({
          where: {
            id: callId,
            tenantId: user.tenantId,
          },
        });

        if (!call) {
          socket.emit('error', { message: 'Call not found' });
          return;
        }

        socket.join(`call:${callId}`);
        log.debug('User joined call room', { userId: user.id, callId });

        socket.emit('call:joined', { callId });
        wsMessagesTotal.inc({ type: 'call:join', direction: 'in' });
      } catch (error) {
        log.error('Error joining call', { error: error.message });
        socket.emit('error', { message: 'Failed to join call' });
      }
    });

    // Handle leaving call room
    socket.on('call:leave', (data) => {
      const { callId } = data;
      socket.leave(`call:${callId}`);
      log.debug('User left call room', { userId: user.id, callId });
      wsMessagesTotal.inc({ type: 'call:leave', direction: 'in' });
    });

    // Handle transcript update (from receptionist service)
    socket.on('transcript:segment', async (data) => {
      const { callId, segment } = data;

      // Broadcast to all users in the call room
      io.to(`call:${callId}`).emit('transcript:segment', {
        callId,
        segment,
      });

      wsMessagesTotal.inc({ type: 'transcript:segment', direction: 'in' });
    });

    // Handle call status update
    socket.on('call:status', async (data) => {
      const { callId, status } = data;

      // Broadcast to call room and tenant room
      io.to(`call:${callId}`).emit('call:status', { callId, status });
      io.to(`tenant:${user.tenantId}`).emit('call:status_changed', { callId, status });

      wsMessagesTotal.inc({ type: 'call:status', direction: 'in' });
    });

    // Handle agent takeover request
    socket.on('call:takeover', async (data) => {
      try {
        const { callId } = data;
        const db = getDatabase();

        // Update call with agent
        await db.call.update({
          where: { id: callId },
          data: { agentId: user.id },
        });

        io.to(`call:${callId}`).emit('call:takeover', {
          callId,
          agentId: user.id,
        });

        log.info('Agent took over call', { agentId: user.id, callId });
        wsMessagesTotal.inc({ type: 'call:takeover', direction: 'in' });
      } catch (error) {
        log.error('Error during call takeover', { error: error.message });
        socket.emit('error', { message: 'Failed to take over call' });
      }
    });

    // Handle booking created notification
    socket.on('booking:created', (data) => {
      io.to(`tenant:${user.tenantId}`).emit('booking:created', data);
      wsMessagesTotal.inc({ type: 'booking:created', direction: 'in' });
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      log.info('WebSocket client disconnected', {
        userId: user.id,
        reason,
      });
      wsConnectionsGauge.dec();
    });

    // Error handler
    socket.on('error', (error) => {
      log.error('WebSocket error', {
        userId: user.id,
        error: error.message,
      });
    });
  });

  log.info('WebSocket server initialized');

  return io;
}

/**
 * Get Socket.IO instance
 */
export function getIO() {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
}

/**
 * Emit event to specific call room
 */
export function emitToCall(callId, event, data) {
  if (io) {
    io.to(`call:${callId}`).emit(event, data);
    wsMessagesTotal.inc({ type: event, direction: 'out' });
  }
}

/**
 * Emit event to tenant
 */
export function emitToTenant(tenantId, event, data) {
  if (io) {
    io.to(`tenant:${tenantId}`).emit(event, data);
    wsMessagesTotal.inc({ type: event, direction: 'out' });
  }
}

/**
 * Emit event to specific user
 */
export function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
    wsMessagesTotal.inc({ type: event, direction: 'out' });
  }
}

/**
 * Broadcast transcript segment
 */
export function broadcastTranscriptSegment(callId, segment) {
  emitToCall(callId, 'transcript:segment', { callId, segment });
}

/**
 * Broadcast call status change
 */
export function broadcastCallStatus(callId, tenantId, status, details = {}) {
  emitToCall(callId, 'call:status', { callId, status, ...details });
  emitToTenant(tenantId, 'call:status_changed', { callId, status, ...details });
}

/**
 * Notify new booking
 */
export function notifyNewBooking(tenantId, booking) {
  emitToTenant(tenantId, 'booking:created', booking);
}

/**
 * Notify call requires attention
 */
export function notifyCallAttention(tenantId, callId, reason) {
  emitToTenant(tenantId, 'call:attention', { callId, reason });
}

export default {
  initializeWebSocket,
  getIO,
  emitToCall,
  emitToTenant,
  emitToUser,
  broadcastTranscriptSegment,
  broadcastCallStatus,
  notifyNewBooking,
  notifyCallAttention,
};
