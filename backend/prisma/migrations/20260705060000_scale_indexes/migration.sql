-- CreateIndex
CREATE INDEX "channels_projectId_idx" ON "channels"("projectId");

-- CreateIndex
CREATE INDEX "features_projectId_idx" ON "features"("projectId");

-- CreateIndex
CREATE INDEX "milestones_projectId_idx" ON "milestones"("projectId");

-- CreateIndex
CREATE INDEX "project_clients_email_idx" ON "project_clients"("email");

-- CreateIndex
CREATE INDEX "project_clients_projectId_email_idx" ON "project_clients"("projectId", "email");

-- CreateIndex
CREATE INDEX "project_members_email_idx" ON "project_members"("email");

-- CreateIndex
CREATE INDEX "project_members_projectId_email_idx" ON "project_members"("projectId", "email");

-- CreateIndex
CREATE INDEX "subtasks_taskId_idx" ON "subtasks"("taskId");

-- CreateIndex
CREATE INDEX "task_events_taskId_createdAt_idx" ON "task_events"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_featureId_idx" ON "tasks"("featureId");

