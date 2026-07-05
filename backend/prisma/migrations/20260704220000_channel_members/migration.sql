-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "authorEmail" TEXT;

-- CreateTable
CREATE TABLE "channel_members" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_members_email_idx" ON "channel_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "channel_members_channelId_email_key" ON "channel_members"("channelId", "email");

-- AddForeignKey
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
