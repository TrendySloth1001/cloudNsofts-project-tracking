-- Scheduled (send-later) channel messages.
CREATE TABLE "scheduled_messages" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "authorEmail" TEXT,
  "agentName" TEXT,
  "body" TEXT NOT NULL,
  "attachedTaskId" TEXT,
  "attachedFeatureId" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sentMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scheduled_messages_status_scheduledFor_idx" ON "scheduled_messages"("status", "scheduledFor");
CREATE INDEX "scheduled_messages_channelId_idx" ON "scheduled_messages"("channelId");
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
