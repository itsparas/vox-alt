/**
 * Analytics Routes
 * Call analytics, volume metrics, peak hours, and performance data
 */

import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, authorize } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { getCallCapacityStats } from '../services/callQueue.js';

const router = Router();

/**
 * GET /api/analytics/overview
 * Get analytics overview: total calls, avg duration, completion rate, etc.
 */
router.get('/overview',
  authenticate,
  tenantIsolation,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Validation failed', errors.array());
    }

    const db = getDatabase();
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const where = {
      tenantId: req.tenantId,
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    // Parallel queries for overview stats
    const [
      totalCalls,
      completedCalls,
      missedCalls,
      failedCalls,
      cancelledCalls,
      activeCalls,
      allCalls,
      totalBookings,
    ] = await Promise.all([
      db.call.count({ where }),
      db.call.count({ where: { ...where, status: 'COMPLETED' } }),
      db.call.count({ where: { ...where, status: 'MISSED' } }),
      db.call.count({ where: { ...where, status: 'FAILED' } }),
      db.call.count({ where: { ...where, status: 'CANCELLED' } }),
      db.call.count({ where: { ...where, status: 'ACTIVE' } }),
      db.call.findMany({
        where: { ...where, status: 'COMPLETED', startedAt: { not: null }, endedAt: { not: null } },
        select: { startedAt: true, endedAt: true },
      }),
      db.booking.count({ where: { tenantId: req.tenantId, ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }) } }),
    ]);

    // Calculate average duration
    let avgDuration = 0;
    if (allCalls.length > 0) {
      const totalDuration = allCalls.reduce((sum, call) => {
        return sum + (call.endedAt.getTime() - call.startedAt.getTime());
      }, 0);
      avgDuration = Math.round(totalDuration / allCalls.length / 1000); // seconds
    }

    // Completion rate
    const completionRate = totalCalls > 0
      ? Math.round((completedCalls / totalCalls) * 100)
      : 0;

    // Get capacity stats
    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
      select: { planId: true },
    });
    const capacity = await getCallCapacityStats(req.tenantId, tenant.planId);

    res.json({
      success: true,
      data: {
        totalCalls,
        completedCalls,
        missedCalls,
        failedCalls,
        cancelledCalls,
        activeCalls,
        avgDuration,
        completionRate,
        totalBookings,
        capacity,
      },
    });
  })
);

/**
 * GET /api/analytics/volume
 * Get call volume over time (grouped by day/hour)
 */
router.get('/volume',
  authenticate,
  tenantIsolation,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('groupBy').optional().isIn(['hour', 'day', 'week', 'month']),
  ],
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
      groupBy = 'day',
    } = req.query;

    const calls = await db.call.findMany({
      where: {
        tenantId: req.tenantId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group calls by time period
    const volumeMap = new Map();

    for (const call of calls) {
      let key;
      const d = call.createdAt;

      switch (groupBy) {
        case 'hour':
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`;
          break;
        case 'week': {
          const weekStart = new Date(d);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        }
        case 'month':
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          break;
        default: // day
          key = d.toISOString().split('T')[0];
      }

      if (!volumeMap.has(key)) {
        volumeMap.set(key, { period: key, total: 0, completed: 0, missed: 0, failed: 0 });
      }
      const entry = volumeMap.get(key);
      entry.total++;
      if (call.status === 'COMPLETED') entry.completed++;
      else if (call.status === 'MISSED') entry.missed++;
      else if (call.status === 'FAILED') entry.failed++;
    }

    res.json({
      success: true,
      data: Array.from(volumeMap.values()),
    });
  })
);

/**
 * GET /api/analytics/peak-hours
 * Get call distribution by hour of day
 */
router.get('/peak-hours',
  authenticate,
  tenantIsolation,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
    } = req.query;

    const calls = await db.call.findMany({
      where: {
        tenantId: req.tenantId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: { createdAt: true },
    });

    // Distribute by hour (0-23)
    const hourDistribution = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      count: 0,
    }));

    for (const call of calls) {
      hourDistribution[call.createdAt.getHours()].count++;
    }

    // Find peak hour
    const peakHour = hourDistribution.reduce((max, h) => h.count > max.count ? h : max, hourDistribution[0]);

    res.json({
      success: true,
      data: {
        distribution: hourDistribution,
        peakHour: peakHour.label,
        peakCount: peakHour.count,
      },
    });
  })
);

/**
 * GET /api/analytics/outcomes
 * Get call outcome distribution
 */
router.get('/outcomes',
  authenticate,
  tenantIsolation,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const where = {
      tenantId: req.tenantId,
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    const [completed, missed, failed, cancelled, escalated] = await Promise.all([
      db.call.count({ where: { ...where, status: 'COMPLETED' } }),
      db.call.count({ where: { ...where, status: 'MISSED' } }),
      db.call.count({ where: { ...where, status: 'FAILED' } }),
      db.call.count({ where: { ...where, status: 'CANCELLED' } }),
      db.call.count({ where: { ...where, escalatedAt: { not: null } } }),
    ]);

    const total = completed + missed + failed + cancelled;

    res.json({
      success: true,
      data: {
        outcomes: [
          { status: 'completed', count: completed, percentage: total ? Math.round((completed / total) * 100) : 0 },
          { status: 'missed', count: missed, percentage: total ? Math.round((missed / total) * 100) : 0 },
          { status: 'failed', count: failed, percentage: total ? Math.round((failed / total) * 100) : 0 },
          { status: 'cancelled', count: cancelled, percentage: total ? Math.round((cancelled / total) * 100) : 0 },
        ],
        escalatedCalls: escalated,
        total,
      },
    });
  })
);

/**
 * GET /api/analytics/duration
 * Get average call duration stats
 */
router.get('/duration',
  authenticate,
  tenantIsolation,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const where = {
      tenantId: req.tenantId,
      status: 'COMPLETED',
      startedAt: { not: null },
      endedAt: { not: null },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    const calls = await db.call.findMany({
      where,
      select: { startedAt: true, endedAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    if (calls.length === 0) {
      return res.json({
        success: true,
        data: {
          avgDuration: 0,
          minDuration: 0,
          maxDuration: 0,
          medianDuration: 0,
          totalCalls: 0,
          durationBuckets: [],
        },
      });
    }

    const durations = calls.map(c => Math.round((c.endedAt.getTime() - c.startedAt.getTime()) / 1000));
    durations.sort((a, b) => a - b);

    const avgDuration = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];
    const medianDuration = durations[Math.floor(durations.length / 2)];

    // Duration buckets: <30s, 30s-1m, 1-2m, 2-5m, 5-10m, 10m+
    const buckets = [
      { label: '<30s', min: 0, max: 30, count: 0 },
      { label: '30s-1m', min: 30, max: 60, count: 0 },
      { label: '1-2m', min: 60, max: 120, count: 0 },
      { label: '2-5m', min: 120, max: 300, count: 0 },
      { label: '5-10m', min: 300, max: 600, count: 0 },
      { label: '10m+', min: 600, max: Infinity, count: 0 },
    ];

    for (const d of durations) {
      const bucket = buckets.find(b => d >= b.min && d < b.max);
      if (bucket) bucket.count++;
    }

    res.json({
      success: true,
      data: {
        avgDuration,
        minDuration,
        maxDuration,
        medianDuration,
        totalCalls: calls.length,
        durationBuckets: buckets.map(({ label, count }) => ({ label, count })),
      },
    });
  })
);

/**
 * GET /api/analytics/trends
 * Get call trends comparing current vs previous period
 */
router.get('/trends',
  authenticate,
  tenantIsolation,
  [
    query('days').optional().isInt({ min: 1, max: 365 }),
  ],
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const days = parseInt(req.query.days) || 30;

    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

    const [currentCalls, previousCalls, currentCompleted, previousCompleted] = await Promise.all([
      db.call.count({
        where: { tenantId: req.tenantId, createdAt: { gte: currentStart, lte: now } },
      }),
      db.call.count({
        where: { tenantId: req.tenantId, createdAt: { gte: previousStart, lt: currentStart } },
      }),
      db.call.count({
        where: { tenantId: req.tenantId, status: 'COMPLETED', createdAt: { gte: currentStart, lte: now } },
      }),
      db.call.count({
        where: { tenantId: req.tenantId, status: 'COMPLETED', createdAt: { gte: previousStart, lt: currentStart } },
      }),
    ]);

    const calcChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    res.json({
      success: true,
      data: {
        period: { days, start: currentStart, end: now },
        metrics: {
          totalCalls: {
            current: currentCalls,
            previous: previousCalls,
            change: calcChange(currentCalls, previousCalls),
          },
          completedCalls: {
            current: currentCompleted,
            previous: previousCompleted,
            change: calcChange(currentCompleted, previousCompleted),
          },
          completionRate: {
            current: currentCalls ? Math.round((currentCompleted / currentCalls) * 100) : 0,
            previous: previousCalls ? Math.round((previousCompleted / previousCalls) * 100) : 0,
          },
        },
      },
    });
  })
);

export default router;
