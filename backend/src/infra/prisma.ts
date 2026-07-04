import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Single PrismaClient instance. Reusing it across `tsx watch` reloads avoids
 * exhausting database connections in development.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
