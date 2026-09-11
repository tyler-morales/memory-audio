-- Timed emoji marks on clip blocks (SoundCloud-style waveform comments).
CREATE TABLE emoji_replies (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id),
  author_id TEXT NOT NULL REFERENCES members(id),
  clip_id TEXT NOT NULL REFERENCES clips(id),
  offset_ms INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_emoji_replies_memory ON emoji_replies(memory_id);
CREATE INDEX idx_emoji_replies_clip ON emoji_replies(clip_id);
