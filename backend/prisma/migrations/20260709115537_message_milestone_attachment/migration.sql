-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachedMilestoneId" TEXT;

-- AlterTable
ALTER TABLE "scheduled_messages" ADD COLUMN     "attachedMilestoneId" TEXT;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachedMilestoneId_fkey" FOREIGN KEY ("attachedMilestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
