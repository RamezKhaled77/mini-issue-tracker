CREATE TABLE activities (
  id TEXT PRIMARY KEY NOT NULL,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  field TEXT,
  from_value TEXT,
  to_value TEXT,
  label_ids TEXT,
  label_names TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX activities_issue_idx ON activities (issue_id);
CREATE INDEX activities_actor_idx ON activities (actor_id);
CREATE INDEX activities_created_idx ON activities (created_at DESC);