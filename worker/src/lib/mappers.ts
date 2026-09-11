import type {
  ClipPublic,
  ClipRow,
  EmojiReplyPublic,
  EmojiReplyRow,
  MemberPublic,
  MemberRow,
  MemoryDetail,
  MemoryRow,
  MemorySummary,
  ReplyPublic,
  ReplyRow,
} from "./types";
import { parsePeaks } from "./ids";

export function memberPublic(row: MemberRow): MemberPublic {
  return {
    id: row.id,
    displayName: row.display_name,
    color: row.color,
  };
}

export function clipPublic(row: ClipRow): ClipPublic {
  return {
    id: row.id,
    position: row.position,
    durationMs: row.duration_ms,
    mime: row.mime,
    peaks: parsePeaks(row.peaks_json),
    audioUrl: `/api/audio/${row.r2_key}`,
    createdAt: row.created_at,
  };
}

export function replyPublic(row: ReplyRow, author: MemberRow): ReplyPublic {
  return {
    id: row.id,
    author: memberPublic(author),
    parentReplyId: row.parent_reply_id,
    clipId: row.clip_id,
    offsetMs: row.offset_ms,
    durationMs: row.duration_ms,
    mime: row.mime,
    peaks: parsePeaks(row.peaks_json),
    audioUrl: `/api/audio/${row.r2_key}`,
    createdAt: row.created_at,
  };
}

export function emojiReplyPublic(row: EmojiReplyRow, author: MemberRow): EmojiReplyPublic {
  return {
    id: row.id,
    author: memberPublic(author),
    clipId: row.clip_id,
    offsetMs: row.offset_ms,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

function unknownAuthor(authorId: string, spaceId: string, createdAt: string): MemberRow {
  return {
    id: authorId,
    space_id: spaceId,
    display_name: "Unknown",
    color: "#888888",
    created_at: createdAt,
  };
}

export function summarizeMemory(
  memory: MemoryRow,
  creator: MemberRow,
  clips: ClipRow[],
  replies: ReplyRow[],
  emojiReplies: EmojiReplyRow[] = [],
): MemorySummary {
  const totalDurationMs = clips.reduce((sum, c) => sum + c.duration_ms, 0);
  const noteCount = replies.filter((r) => r.clip_id == null && r.parent_reply_id == null).length;
  const replyCount = replies.length - noteCount;
  const peaks = mergeClipPeaks(clips);

  return {
    id: memory.id,
    title: memory.title ?? "",
    creator: memberPublic(creator),
    createdAt: memory.created_at,
    updatedAt: memory.updated_at,
    totalDurationMs,
    clipCount: clips.length,
    replyCount,
    noteCount,
    emojiCount: emojiReplies.length,
    peaks,
  };
}

export function detailMemory(
  memory: MemoryRow,
  creator: MemberRow,
  clips: ClipRow[],
  replies: ReplyRow[],
  authors: Map<string, MemberRow>,
  emojiReplies: EmojiReplyRow[] = [],
): MemoryDetail {
  const summary = summarizeMemory(memory, creator, clips, replies, emojiReplies);
  return {
    ...summary,
    clips: clips
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(clipPublic),
    replies: replies.map((r) => {
      const author = authors.get(r.author_id) ?? unknownAuthor(r.author_id, memory.space_id, r.created_at);
      return replyPublic(r, author);
    }),
    emojiReplies: emojiReplies.map((row) => {
      const author =
        authors.get(row.author_id) ?? unknownAuthor(row.author_id, memory.space_id, row.created_at);
      return emojiReplyPublic(row, author);
    }),
  };
}

function mergeClipPeaks(clips: ClipRow[]): number[] {
  const sorted = clips.slice().sort((a, b) => a.position - b.position);
  const all: number[] = [];
  for (const clip of sorted) {
    all.push(...parsePeaks(clip.peaks_json));
  }
  if (all.length === 0) return [];
  if (all.length <= 48) return all;
  const target = 48;
  const bucket = all.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.floor((i + 1) * bucket);
    let max = 0;
    for (let j = start; j < end; j++) {
      max = Math.max(max, all[j] ?? 0);
    }
    out.push(max);
  }
  return out;
}
