-- AlterTable
ALTER TABLE "device_auths" ADD COLUMN     "projectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'full';
