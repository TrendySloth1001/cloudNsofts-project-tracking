-- Multi-member assignment: replace the single Task.assigneeId / Feature.ownerId
-- FKs with join tables. Order matters: create tables, BACKFILL from the old
-- columns, then drop them.

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_owners" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_owners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignees_memberId_idx" ON "task_assignees"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_taskId_memberId_key" ON "task_assignees"("taskId", "memberId");

-- CreateIndex
CREATE INDEX "feature_owners_memberId_idx" ON "feature_owners"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_owners_featureId_memberId_key" ON "feature_owners"("featureId", "memberId");

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_owners" ADD CONSTRAINT "feature_owners_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_owners" ADD CONSTRAINT "feature_owners_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing single assignee/owner becomes a join row.
INSERT INTO "task_assignees" ("id", "taskId", "memberId")
SELECT gen_random_uuid()::text, "id", "assigneeId"
FROM "tasks"
WHERE "assigneeId" IS NOT NULL;

INSERT INTO "feature_owners" ("id", "featureId", "memberId")
SELECT gen_random_uuid()::text, "id", "ownerId"
FROM "features"
WHERE "ownerId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "features" DROP CONSTRAINT "features_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assigneeId_fkey";

-- AlterTable
ALTER TABLE "features" DROP COLUMN "ownerId";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "assigneeId";
