CREATE TABLE comment_mentions (
  id TEXT PRIMARY KEY NOT NULL,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX comment_mentions_comment_idx ON comment_mentions (comment_id);
CREATE INDEX comment_mentions_user_idx ON comment_mentions (mentioned_user_id);
