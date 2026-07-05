-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('planned', 'active', 'shipped');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "featureId" TEXT;

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "FeatureStatus" NOT NULL DEFAULT 'planned',
    "ownerId" TEXT,
    "targetDate" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "project_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
