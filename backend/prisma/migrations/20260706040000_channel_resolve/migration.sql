-- Mark a channel conversation as resolved (used by the agent wait loop to stop).
ALTER TABLE "channels" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "channels" ADD COLUMN "resolvedBy" TEXT;
