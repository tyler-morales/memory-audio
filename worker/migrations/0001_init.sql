CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id),
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_members_space ON members(space_id);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id),
  creator_id TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_memories_space ON memories(space_id);

CREATE TABLE clips (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id),
  position INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  peaks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_clips_memory ON clips(memory_id, position);

CREATE TABLE replies (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id),
  author_id TEXT NOT NULL REFERENCES members(id),
  parent_reply_id TEXT REFERENCES replies(id),
  clip_id TEXT REFERENCES clips(id),
  offset_ms INTEGER,
  duration_ms INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  peaks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_replies_memory ON replies(memory_id);
CREATE INDEX idx_replies_parent ON replies(parent_reply_id);
