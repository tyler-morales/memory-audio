export type Env = {
  DB: D1Database;
  AUDIO: R2Bucket;
  ASSETS: Fetcher;
};

export type SpaceRow = {
  id: string;
  token: string;
  created_at: string;
};

export type MemberRow = {
  id: string;
  space_id: string;
  display_name: string;
  color: string;
  created_at: string;
};

export type MemoryRow = {
  id: string;
  space_id: string;
  creator_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ClipRow = {
  id: string;
  memory_id: string;
  position: number;
  duration_ms: number;
  r2_key: string;
  mime: string;
  peaks_json: string;
  created_at: string;
};

export type ReplyRow = {
  id: string;
  memory_id: string;
  author_id: string;
  parent_reply_id: string | null;
  clip_id: string | null;
  offset_ms: number | null;
  duration_ms: number;
  r2_key: string;
  mime: string;
  peaks_json: string;
  created_at: string;
};

export type EmojiReplyRow = {
  id: string;
  memory_id: string;
  author_id: string;
  clip_id: string;
  offset_ms: number;
  emoji: string;
  created_at: string;
};

export type MemberPublic = {
  id: string;
  displayName: string;
  color: string;
};

export type ClipPublic = {
  id: string;
  position: number;
  durationMs: number;
  mime: string;
  peaks: number[];
  audioUrl: string;
  createdAt: string;
};

export type ReplyPublic = {
  id: string;
  author: MemberPublic;
  parentReplyId: string | null;
  clipId: string | null;
  offsetMs: number | null;
  durationMs: number;
  mime: string;
  peaks: number[];
  audioUrl: string;
  createdAt: string;
};

export type EmojiReplyPublic = {
  id: string;
  author: MemberPublic;
  clipId: string;
  offsetMs: number;
  emoji: string;
  createdAt: string;
};

export type MemorySummary = {
  id: string;
  title: string;
  creator: MemberPublic;
  createdAt: string;
  updatedAt: string;
  totalDurationMs: number;
  clipCount: number;
  replyCount: number;
  noteCount: number;
  emojiCount: number;
  peaks: number[];
};

export type MemoryDetail = MemorySummary & {
  clips: ClipPublic[];
  replies: ReplyPublic[];
  emojiReplies: EmojiReplyPublic[];
};
