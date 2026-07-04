-- Add manual ordering to tasks (drag-to-reorder within a status column).
ALTER TABLE "tasks" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill: sequence existing tasks within each (project, status) by creation order.
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId", "status"
      ORDER BY "createdAt" ASC
    ) - 1 AS rn
  FROM "tasks"
)
UPDATE "tasks" t
SET "position" = o.rn
FROM ordered o
WHERE t."id" = o."id";
