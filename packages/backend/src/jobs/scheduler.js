/**
 * Job Scheduler
 * Manages periodic background tasks
 */

import { runDataRetention, cleanupOrphanedData } from './dataRetention.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ service: 'scheduler' });

// Job definitions
const jobs = {
  dataRetention: {
    handler: runDataRetention,
    interval: 24 * 60 * 60 * 1000, // Run daily
    lastRun: null,
    running: false,
  },
  orphanedDataCleanup: {
    handler: cleanupOrphanedData,
    interval: 6 * 60 * 60 * 1000, // Run every 6 hours
    lastRun: null,
    running: false,
  },
};

// Active interval IDs
const intervals = {};

/**
 * Run a job with error handling
 */
async function runJob(name) {
  const job = jobs[name];
  if (!job) {
    log.error('Unknown job', { name });
    return;
  }

  if (job.running) {
    log.warn('Job already running, skipping', { name });
    return;
  }

  job.running = true;
  const startTime = Date.now();

  try {
    log.info('Starting job', { name });
    const result = await job.handler();
    job.lastRun = new Date();
    
    log.info('Job completed', { 
      name, 
      duration: Date.now() - startTime,
      result,
    });
  } catch (error) {
    log.error('Job failed', { 
      name, 
      error: error.message,
      stack: error.stack,
    });
  } finally {
    job.running = false;
  }
}

/**
 * Start all scheduled jobs
 */
export function startScheduler() {
  log.info('Starting job scheduler');

  for (const [name, job] of Object.entries(jobs)) {
    // Run immediately on startup (after a short delay)
    setTimeout(() => runJob(name), 5000);

    // Schedule periodic runs
    intervals[name] = setInterval(() => runJob(name), job.interval);

    log.info('Scheduled job', { 
      name, 
      intervalMs: job.interval,
      intervalHours: job.interval / (60 * 60 * 1000),
    });
  }
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler() {
  log.info('Stopping job scheduler');

  for (const [name, intervalId] of Object.entries(intervals)) {
    clearInterval(intervalId);
    delete intervals[name];
    log.info('Stopped job', { name });
  }
}

/**
 * Get status of all jobs
 */
export function getJobStatus() {
  const status = {};
  
  for (const [name, job] of Object.entries(jobs)) {
    status[name] = {
      running: job.running,
      lastRun: job.lastRun,
      intervalMs: job.interval,
      scheduled: !!intervals[name],
    };
  }

  return status;
}

/**
 * Manually trigger a job
 */
export async function triggerJob(name) {
  if (!jobs[name]) {
    throw new Error(`Unknown job: ${name}`);
  }
  
  await runJob(name);
  return { success: true, jobName: name };
}

export default {
  startScheduler,
  stopScheduler,
  getJobStatus,
  triggerJob,
};
