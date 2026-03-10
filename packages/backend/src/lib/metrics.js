/**
 * Prometheus Metrics
 * Application monitoring and metrics collection
 */

import client from 'prom-client';
import { Router } from 'express';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'voxreception_',
});

// Custom metrics

// HTTP request metrics
export const httpRequestsTotal = new client.Counter({
  name: 'voxreception_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'voxreception_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Call metrics
export const activeCallsGauge = new client.Gauge({
  name: 'voxreception_active_calls',
  help: 'Number of active calls',
  labelNames: ['tenant_id'],
  registers: [register],
});

export const callDuration = new client.Histogram({
  name: 'voxreception_call_duration_seconds',
  help: 'Duration of calls in seconds',
  labelNames: ['tenant_id', 'status'],
  buckets: [10, 30, 60, 120, 300, 600, 1800, 3600],
  registers: [register],
});

export const callsTotal = new client.Counter({
  name: 'voxreception_calls_total',
  help: 'Total number of calls',
  labelNames: ['tenant_id', 'status', 'intent'],
  registers: [register],
});

// ASR/TTS metrics
export const asrRequestsTotal = new client.Counter({
  name: 'voxreception_asr_requests_total',
  help: 'Total number of ASR requests',
  labelNames: ['provider', 'status'],
  registers: [register],
});

export const asrLatency = new client.Histogram({
  name: 'voxreception_asr_latency_seconds',
  help: 'ASR processing latency',
  labelNames: ['provider'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

export const ttsRequestsTotal = new client.Counter({
  name: 'voxreception_tts_requests_total',
  help: 'Total number of TTS requests',
  labelNames: ['provider', 'status'],
  registers: [register],
});

export const ttsLatency = new client.Histogram({
  name: 'voxreception_tts_latency_seconds',
  help: 'TTS processing latency',
  labelNames: ['provider'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// LLM metrics
export const llmRequestsTotal = new client.Counter({
  name: 'voxreception_llm_requests_total',
  help: 'Total number of LLM requests',
  labelNames: ['provider', 'status'],
  registers: [register],
});

export const llmLatency = new client.Histogram({
  name: 'voxreception_llm_latency_seconds',
  help: 'LLM processing latency',
  labelNames: ['provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// WebSocket metrics
export const wsConnectionsGauge = new client.Gauge({
  name: 'voxreception_ws_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const wsMessagesTotal = new client.Counter({
  name: 'voxreception_ws_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type', 'direction'],
  registers: [register],
});

// Booking metrics
export const bookingsTotal = new client.Counter({
  name: 'voxreception_bookings_total',
  help: 'Total number of bookings',
  labelNames: ['tenant_id', 'status'],
  registers: [register],
});

// Tenant metrics
export const tenantsGauge = new client.Gauge({
  name: 'voxreception_tenants_total',
  help: 'Total number of tenants',
  labelNames: ['plan'],
  registers: [register],
});

/**
 * Metrics middleware for Express
 */
export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route: route,
      status: res.statusCode,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
}

/**
 * Metrics endpoint
 */
export const metricsEndpoint = Router();

metricsEndpoint.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
});

export { register };
