/**
 * Database Initialization
 * Prisma Client setup and connection management
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger.js';

let prisma = null;

/**
 * Initialize database connection
 */
export async function initializeDatabase() {
  try {
    prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e) => {
        logger.debug(`Query: ${e.query}`, { duration: `${e.duration}ms` });
      });
    }

    // Test connection
    await prisma.$connect();
    logger.info('Database connection established');

    return prisma;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get Prisma client instance
 */
export function getDatabase() {
  if (!prisma) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return prisma;
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  }
}

// Handle process termination
process.on('beforeExit', async () => {
  await closeDatabase();
});

export { prisma };
