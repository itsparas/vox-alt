/**
 * VoxReception Backend Entry Point
 * AI Receptionist SaaS - Main Server
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { initializeWebSocket } from './websocket/index.js';
import { initializeTwilioStreamUpgrade } from './websocket/twilioStream.js';
import { initializeDatabase } from './db/index.js';
import { initializeRedis } from './lib/redis.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { metricsMiddleware, metricsEndpoint } from './lib/metrics.js';

// Import routes
import authRoutes from './routes/auth.js';
import tenantRoutes from './routes/tenants.js';
import userRoutes from './routes/users.js';
import callRoutes from './routes/calls.js';
import livekitRoutes from './routes/livekit.js';
import bookingRoutes from './routes/bookings.js';
import transcriptRoutes from './routes/transcripts.js';
import billingRoutes from './routes/billing.js';
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';
import integrationsRoutes from './routes/integrations.js';
import healthRoutes from './routes/health.js';
import phoneNumberRoutes from './routes/phoneNumbers.js';
import messageRoutes from './routes/messages.js';
import analyticsRoutes from './routes/analytics.js';
import voicemailRoutes from './routes/voicemails.js';
import knowledgeRoutes from './routes/knowledge.js';

const app = express();
const httpServer = createServer(app);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", process.env.LIVEKIT_URL || 'ws://localhost:7880'],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Metrics middleware
app.use(metricsMiddleware);

// Logging middleware
app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) },
}));

// Body parsing - raw for webhooks, JSON for everything else
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use('/api/livekit/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check routes (no auth required)
app.use('/health', healthRoutes);
app.use('/metrics', metricsEndpoint);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/livekit', livekitRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/transcripts', transcriptRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/phone-numbers', phoneNumberRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/voicemails', voicemailRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis connected successfully');

    // Initialize WebSocket server
    initializeWebSocket(httpServer);
    logger.info('WebSocket server initialized');

    // Initialize Twilio Media Stream WebSocket upgrade handler
    initializeTwilioStreamUpgrade(httpServer);
    logger.info('Twilio stream handler initialized');

    // Start background job scheduler
    startScheduler();
    logger.info('Job scheduler started');

    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      logger.info(`🚀 VoxReception API Server running on port ${PORT}`);
      logger.info(`📊 Metrics available at /metrics`);
      logger.info(`💚 Health check at /health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  stopScheduler();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  stopScheduler();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

startServer();

export { app, httpServer };
