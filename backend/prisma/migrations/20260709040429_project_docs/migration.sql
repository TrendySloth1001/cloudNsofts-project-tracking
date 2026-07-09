-- CreateTable
CREATE TABLE "docs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "author" TEXT NOT NULL,
    "authorEmail" TEXT,
    "updatedBy" TEXT,
    "updatedByEmail" TEXT,
    "agentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "docs_projectId_idx" ON "docs"("projectId");

-- AddForeignKey
ALTER TABLE "docs" ADD CONSTRAINT "docs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
