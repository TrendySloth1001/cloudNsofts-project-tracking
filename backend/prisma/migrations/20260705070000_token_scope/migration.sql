-- Personal Access Token scoping + usage tracking.
ALTER TABLE "api_tokens" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "api_tokens" ADD COLUMN "projectIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "api_tokens" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
