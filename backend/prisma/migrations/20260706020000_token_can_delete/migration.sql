-- Per-token destructive-op capability (default off).
ALTER TABLE "api_tokens" ADD COLUMN "canDelete" BOOLEAN NOT NULL DEFAULT false;
