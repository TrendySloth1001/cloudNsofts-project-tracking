-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachedFeatureId" TEXT,
ADD COLUMN     "attachedTaskId" TEXT;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachedTaskId_fkey" FOREIGN KEY ("attachedTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachedFeatureId_fkey" FOREIGN KEY ("attachedFeatureId") REFERENCES "features"("id") ON DELETE SET NULL ON UPDATE CASCADE;
