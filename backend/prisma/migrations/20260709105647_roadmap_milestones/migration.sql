/*
  Warnings:

  - You are about to drop the column `done` on the `milestones` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `milestones` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('upcoming', 'in_progress', 'done');

-- AlterTable
ALTER TABLE "milestones" DROP COLUMN "done",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "MilestoneStatus" NOT NULL DEFAULT 'upcoming',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
