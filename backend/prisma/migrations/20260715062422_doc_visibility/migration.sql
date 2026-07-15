-- CreateEnum
CREATE TYPE "DocVisibility" AS ENUM ('internal', 'client');

-- AlterTable
ALTER TABLE "docs" ADD COLUMN     "visibility" "DocVisibility" NOT NULL DEFAULT 'internal';
