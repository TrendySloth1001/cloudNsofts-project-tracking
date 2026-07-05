-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CLIENT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT;
