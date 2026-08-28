CREATE TABLE saved_views (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX saved_views_workspace_name_idx ON saved_views (workspace_id, name);
CREATE INDEX saved_views_workspace_idx ON saved_views (workspace_id);
CREATE INDEX saved_views_created_by_idx ON saved_views (created_by_id);