-- Full-text search indexes so coding agents can search conversations instead of
-- ingesting entire threads. Expression GIN indexes on the message/event bodies.
CREATE INDEX "messages_body_fts_idx"
  ON "messages" USING GIN (to_tsvector('english', "body"));
CREATE INDEX "task_events_body_fts_idx"
  ON "task_events" USING GIN (to_tsvector('english', "body"));
