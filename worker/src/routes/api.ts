import { Hono } from "hono";
import type { Env } from "../lib/types";
import {
  createId,
  createToken,
  extensionForMime,
  isAllowedMime,
  isValidToken,
  MAX_AUDIO_BYTES,
  normalizeColor,
  normalizeDisplayName,
  memoryTitleFromBody,
  stringifyPeaks,
} from "../lib/ids";
import {
  getMember,
  getMemory,
  getSpaceByToken,
  listClips,
  listEmojiReplies,
  listMembersByIds,
  listReplies,
  putAudio,
  requireMemberId,
  touchMemory,
} from "../lib/db";
import { clipPublic, detailMemory, emojiReplyPublic, replyPublic, summarizeMemory } from "../lib/mappers";
import { normalizeEmoji, normalizeTapeOffsetMs } from "../lib/emoji";
import type { ClipRow, EmojiReplyRow, MemoryRow, ReplyRow } from "../lib/types";

export const api = new Hono<{ Bindings: Env }>();

api.get("/health", (c) => c.json({ ok: true }));

api.post("/spaces", async (c) => {
  const id = createId();
  const token = createToken();
  await c.env.DB.prepare("INSERT INTO spaces (id, token) VALUES (?, ?)").bind(id, token).run();
  return c.json({ id, token, url: `/s/${token}` }, 201);
});

api.get("/spaces/:token", async (c) => {
  const token = c.req.param("token");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);
  return c.json({ id: space.id, token: space.token, createdAt: space.created_at });
});

api.post("/spaces/:token/join", async (c) => {
  const token = c.req.param("token");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);

  let body: { displayName?: string; color?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const displayName = normalizeDisplayName(body.displayName ?? "");
  const color = normalizeColor(body.color ?? "");
  if (!displayName) return c.json({ error: "displayName required" }, 400);
  if (!color) return c.json({ error: "color required (hex)" }, 400);

  const id = createId();
  await c.env.DB.prepare(
    "INSERT INTO members (id, space_id, display_name, color) VALUES (?, ?, ?, ?)",
  )
    .bind(id, space.id, displayName, color)
    .run();

  return c.json({ id, displayName, color }, 201);
});

api.get("/spaces/:token/memories", async (c) => {
  const token = c.req.param("token");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);

  const memories = await c.env.DB.prepare(
    "SELECT * FROM memories WHERE space_id = ? ORDER BY updated_at DESC",
  )
    .bind(space.id)
    .all<MemoryRow>();

  const rows = memories.results ?? [];
  const summaries = await Promise.all(
    rows.map(async (memory) => {
      const creator = await getMember(c.env.DB, space.id, memory.creator_id);
      const clips = await listClips(c.env.DB, memory.id);
      const replies = await listReplies(c.env.DB, memory.id);
      const emojiReplies = await listEmojiReplies(c.env.DB, memory.id);
      if (!creator) return null;
      return summarizeMemory(memory, creator, clips, replies, emojiReplies);
    }),
  );

  return c.json({ memories: summaries.filter(Boolean) });
});

api.post("/spaces/:token/memories", async (c) => {
  const token = c.req.param("token");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);

  const memberId = requireMemberId(c);
  if (!memberId) return c.json({ error: "X-Member-Id required" }, 401);
  const member = await getMember(c.env.DB, space.id, memberId);
  if (!member) return c.json({ error: "Member not found" }, 401);

  const id = createId();
  await c.env.DB.prepare(
    "INSERT INTO memories (id, space_id, creator_id) VALUES (?, ?, ?)",
  )
    .bind(id, space.id, member.id)
    .run();

  const memory = await getMemory(c.env.DB, space.id, id);
  if (!memory) return c.json({ error: "Failed to create" }, 500);

  return c.json(summarizeMemory(memory, member, [], []), 201);
});

api.get("/spaces/:token/memories/:memoryId", async (c) => {
  const token = c.req.param("token");
  const memoryId = c.req.param("memoryId");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);
  const memory = await getMemory(c.env.DB, space.id, memoryId);
  if (!memory) return c.json({ error: "Memory not found" }, 404);

  const creator = await getMember(c.env.DB, space.id, memory.creator_id);
  if (!creator) return c.json({ error: "Creator missing" }, 500);

  const clips = await listClips(c.env.DB, memory.id);
  const replies = await listReplies(c.env.DB, memory.id);
  const emojiReplies = await listEmojiReplies(c.env.DB, memory.id);
  const authorIds = [
    ...new Set([...replies.map((r) => r.author_id), ...emojiReplies.map((r) => r.author_id)]),
  ];
  const authors = await listMembersByIds(c.env.DB, authorIds);

  return c.json(detailMemory(memory, creator, clips, replies, authors, emojiReplies));
});

api.patch("/spaces/:token/memories/:memoryId", async (c) => {
  const token = c.req.param("token");
  const memoryId = c.req.param("memoryId");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);
  const memory = await getMemory(c.env.DB, space.id, memoryId);
  if (!memory) return c.json({ error: "Memory not found" }, 404);

  const memberId = requireMemberId(c);
  if (!memberId) return c.json({ error: "X-Member-Id required" }, 401);
  if (memberId !== memory.creator_id) {
    return c.json({ error: "Only the creator can rename this memory" }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const title = memoryTitleFromBody(body);
  if (title == null) return c.json({ error: "title required" }, 400);

  await c.env.DB.prepare(
    "UPDATE memories SET title = ?, updated_at = datetime('now') WHERE id = ? AND space_id = ?",
  )
    .bind(title, memory.id, space.id)
    .run();

  const updated = await getMemory(c.env.DB, space.id, memory.id);
  if (!updated) return c.json({ error: "Failed to rename" }, 500);

  return c.json({ id: updated.id, title: updated.title, updatedAt: updated.updated_at });
});

api.post("/spaces/:token/memories/:memoryId/clips", async (c) => {
  const token = c.req.param("token");
  const memoryId = c.req.param("memoryId");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);
  const memory = await getMemory(c.env.DB, space.id, memoryId);
  if (!memory) return c.json({ error: "Memory not found" }, 404);

  const memberId = requireMemberId(c);
  if (!memberId) return c.json({ error: "X-Member-Id required" }, 401);
  if (memberId !== memory.creator_id) {
    return c.json({ error: "Only the creator can add clips" }, 403);
  }

  const form = await c.req.parseBody();
  const file = form.audio;
  if (!(file instanceof File)) return c.json({ error: "audio file required" }, 400);
  if (file.size > MAX_AUDIO_BYTES) {
    return c.json({ error: "Audio too large (max 20 MB)" }, 413);
  }

  const mime = file.type || "audio/mp4";
  if (!isAllowedMime(mime)) return c.json({ error: `Unsupported mime: ${mime}` }, 400);

  const durationMs = Number(form.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 90_000) {
    return c.json({ error: "durationMs must be 1–90000" }, 400);
  }

  let peaks: unknown = [];
  if (typeof form.peaks === "string") {
    try {
      peaks = JSON.parse(form.peaks);
    } catch {
      peaks = [];
    }
  }

  const existing = await listClips(c.env.DB, memory.id);
  const position =
    typeof form.position === "string" && form.position !== ""
      ? Number(form.position)
      : existing.length;
  if (!Number.isInteger(position) || position < 0) {
    return c.json({ error: "invalid position" }, 400);
  }

  const clipId = createId();
  const key = `spaces/${space.id}/memories/${memory.id}/clips/${clipId}.${extensionForMime(mime)}`;
  const buffer = await file.arrayBuffer();
  await putAudio(c.env, key, buffer, mime);

  // Shift positions if inserting in middle
  if (position < existing.length) {
    await c.env.DB.prepare(
      "UPDATE clips SET position = position + 1 WHERE memory_id = ? AND position >= ?",
    )
      .bind(memory.id, position)
      .run();
  }

  await c.env.DB.prepare(
    `INSERT INTO clips (id, memory_id, position, duration_ms, r2_key, mime, peaks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(clipId, memory.id, position, Math.round(durationMs), key, mime, stringifyPeaks(peaks))
    .run();

  await touchMemory(c.env.DB, memory.id);

  const row = await c.env.DB.prepare("SELECT * FROM clips WHERE id = ?")
    .bind(clipId)
    .first<ClipRow>();
  if (!row) return c.json({ error: "Failed to create clip" }, 500);

  return c.json(clipPublic(row), 201);
});

api.put("/spaces/:token/memories/:memoryId/clips/order", async (c) => {
  const token = c.req.param("token");
  const memoryId = c.req.param("memoryId");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);
  const memory = await getMemory(c.env.DB, space.id, memoryId);
  if (!memory) return c.json({ error: "Memory not found" }, 404);

  const memberId = requireMemberId(c);
  if (!memberId) return c.json({ error: "X-Member-Id required" }, 401);
  if (memberId !== memory.creator_id) {
    return c.json({ error: "Only the creator can reorder clips" }, 403);
  }

  let body: { clipIds?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const clipIds = body.clipIds;
  if (!Array.isArray(clipIds) || clipIds.length === 0) {
    return c.json({ error: "clipIds required" }, 400);
  }

  const existing = await listClips(c.env.DB, memory.id);
  if (existing.length !== clipIds.length) {
    return c.json({ error: "clipIds must include all clips" }, 400);
  }
  const existingIds = new Set(existing.map((c) => c.id));
  for (const id of clipIds) {
    if (!existingIds.has(id)) return c.json({ error: `Unknown clip ${id}` }, 400);
  }

  // Two-phase update in one batch so a crash can't leave negative positions
  const phase1 = clipIds.map((id, i) =>
    c.env.DB.prepare("UPDATE clips SET position = ? WHERE id = ? AND memory_id = ?").bind(
      -(i + 1),
      id,
      memory.id,
    ),
  );
  const phase2 = clipIds.map((id, i) =>
    c.env.DB.prepare("UPDATE clips SET position = ? WHERE id = ? AND memory_id = ?").bind(
      i,
      id,
      memory.id,
    ),
  );
  await c.env.DB.batch([...phase1, ...phase2]);

  await touchMemory(c.env.DB, memory.id);
  const clips = await listClips(c.env.DB, memory.id);
  return c.json({ clips: clips.map(clipPublic) });
});

api.delete("/spaces/:token/memories/:memoryId/clips/:clipId", async (c) => {
  const token = c.req.param("token");
  const memoryId = c.req.param("memoryId");
  const clipId = c.req.param("clipId");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);
  const memory = await getMemory(c.env.DB, space.id, memoryId);
  if (!memory) return c.json({ error: "Memory not found" }, 404);

  const memberId = requireMemberId(c);
  if (!memberId) return c.json({ error: "X-Member-Id required" }, 401);
  if (memberId !== memory.creator_id) {
    return c.json({ error: "Only the creator can delete clips" }, 403);
  }

  const clip = await c.env.DB.prepare("SELECT * FROM clips WHERE id = ? AND memory_id = ?")
    .bind(clipId, memory.id)
    .first<ClipRow>();
  if (!clip) return c.json({ error: "Clip not found" }, 404);

  // Drop timed voice + emoji replies anchored to this clip
  await c.env.DB.prepare("DELETE FROM replies WHERE memory_id = ? AND clip_id = ?")
    .bind(memory.id, clipId)
    .run();
  await c.env.DB.prepare("DELETE FROM emoji_replies WHERE memory_id = ? AND clip_id = ?")
    .bind(memory.id, clipId)
    .run();

  await c.env.DB.prepare("DELETE FROM clips WHERE id = ? AND memory_id = ?")
    .bind(clipId, memory.id)
    .run();

  // Compact positions
  const remaining = await listClips(c.env.DB, memory.id);
  if (remaining.length > 0) {
    const phase1 = remaining.map((row, i) =>
      c.env.DB.prepare("UPDATE clips SET position = ? WHERE id = ?").bind(-(i + 1), row.id),
    );
    const phase2 = remaining.map((row, i) =>
      c.env.DB.prepare("UPDATE clips SET position = ? WHERE id = ?").bind(i, row.id),
    );
    await c.env.DB.batch([...phase1, ...phase2]);
  }

  try {
    await c.env.AUDIO.delete(clip.r2_key);
  } catch {
    /* orphan cleanup best-effort */
  }

  await touchMemory(c.env.DB, memory.id);
  return c.json({ ok: true });
});

api.post("/spaces/:token/memories/:memoryId/replies", async (c) => {
  const token = c.req.param("token");
  const memoryId = c.req.param("memoryId");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);
  const memory = await getMemory(c.env.DB, space.id, memoryId);
  if (!memory) return c.json({ error: "Memory not found" }, 404);

  const memberId = requireMemberId(c);
  if (!memberId) return c.json({ error: "X-Member-Id required" }, 401);
  const member = await getMember(c.env.DB, space.id, memberId);
  if (!member) return c.json({ error: "Member not found" }, 401);

  const form = await c.req.parseBody();
  const file = form.audio;
  if (!(file instanceof File)) return c.json({ error: "audio file required" }, 400);
  if (file.size > MAX_AUDIO_BYTES) {
    return c.json({ error: "Audio too large (max 20 MB)" }, 413);
  }

  const mime = file.type || "audio/mp4";
  if (!isAllowedMime(mime)) return c.json({ error: `Unsupported mime: ${mime}` }, 400);

  const durationMs = Number(form.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 90_000) {
    return c.json({ error: "durationMs must be 1–90000" }, 400);
  }

  let peaks: unknown = [];
  if (typeof form.peaks === "string") {
    try {
      peaks = JSON.parse(form.peaks);
    } catch {
      peaks = [];
    }
  }

  const parentReplyId =
    typeof form.parentReplyId === "string" && form.parentReplyId.length > 0
      ? form.parentReplyId
      : null;
  const clipId =
    typeof form.clipId === "string" && form.clipId.length > 0 ? form.clipId : null;
  const offsetMsRaw = form.offsetMs;
  const offsetMs =
    typeof offsetMsRaw === "string" && offsetMsRaw !== "" ? Number(offsetMsRaw) : null;

  if (parentReplyId) {
    const parent = await c.env.DB.prepare(
      "SELECT * FROM replies WHERE id = ? AND memory_id = ?",
    )
      .bind(parentReplyId, memory.id)
      .first<ReplyRow>();
    if (!parent) return c.json({ error: "Parent reply not found" }, 400);
    if (parent.parent_reply_id) {
      return c.json({ error: "Only one level of nesting allowed" }, 400);
    }
  } else if (clipId != null) {
    const clip = await c.env.DB.prepare("SELECT * FROM clips WHERE id = ? AND memory_id = ?")
      .bind(clipId, memory.id)
      .first<ClipRow>();
    if (!clip) return c.json({ error: "Clip not found" }, 400);
    if (offsetMs == null || !Number.isFinite(offsetMs) || offsetMs < 0) {
      return c.json({ error: "offsetMs required for timed replies" }, 400);
    }
  }
  // else: Note (no clip, no parent)

  const replyId = createId();
  const key = `spaces/${space.id}/memories/${memory.id}/replies/${replyId}.${extensionForMime(mime)}`;
  const buffer = await file.arrayBuffer();
  await putAudio(c.env, key, buffer, mime);

  await c.env.DB.prepare(
    `INSERT INTO replies
      (id, memory_id, author_id, parent_reply_id, clip_id, offset_ms, duration_ms, r2_key, mime, peaks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      replyId,
      memory.id,
      member.id,
      parentReplyId,
      parentReplyId ? null : clipId,
      parentReplyId ? null : offsetMs != null ? Math.round(offsetMs) : null,
      Math.round(durationMs),
      key,
      mime,
      stringifyPeaks(peaks),
    )
    .run();

  await touchMemory(c.env.DB, memory.id);

  const row = await c.env.DB.prepare("SELECT * FROM replies WHERE id = ?")
    .bind(replyId)
    .first<ReplyRow>();
  if (!row) return c.json({ error: "Failed to create reply" }, 500);

  return c.json(replyPublic(row, member), 201);
});

api.post("/spaces/:token/memories/:memoryId/emoji-replies", async (c) => {
  const token = c.req.param("token");
  const memoryId = c.req.param("memoryId");
  if (!isValidToken(token)) return c.json({ error: "Invalid token" }, 400);
  const space = await getSpaceByToken(c.env.DB, token);
  if (!space) return c.json({ error: "Space not found" }, 404);
  const memory = await getMemory(c.env.DB, space.id, memoryId);
  if (!memory) return c.json({ error: "Memory not found" }, 404);

  const memberId = requireMemberId(c);
  if (!memberId) return c.json({ error: "X-Member-Id required" }, 401);
  const member = await getMember(c.env.DB, space.id, memberId);
  if (!member) return c.json({ error: "Member not found" }, 401);

  let body: { clipId?: string; offsetMs?: number; emoji?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const emoji = typeof body.emoji === "string" ? normalizeEmoji(body.emoji) : null;
  if (!emoji) return c.json({ error: "emoji not allowed" }, 400);

  const clipId = typeof body.clipId === "string" && body.clipId.length > 0 ? body.clipId : null;
  if (!clipId) return c.json({ error: "clipId required" }, 400);

  const clip = await c.env.DB.prepare("SELECT * FROM clips WHERE id = ? AND memory_id = ?")
    .bind(clipId, memory.id)
    .first<ClipRow>();
  if (!clip) return c.json({ error: "Clip not found" }, 400);

  const offsetMs = normalizeTapeOffsetMs(Number(body.offsetMs), clip.duration_ms);
  if (offsetMs == null) return c.json({ error: "offsetMs required for timed emoji" }, 400);

  const id = createId();
  await c.env.DB.prepare(
    `INSERT INTO emoji_replies (id, memory_id, author_id, clip_id, offset_ms, emoji)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, memory.id, member.id, clip.id, offsetMs, emoji)
    .run();

  await touchMemory(c.env.DB, memory.id);

  const row = await c.env.DB.prepare("SELECT * FROM emoji_replies WHERE id = ?")
    .bind(id)
    .first<EmojiReplyRow>();
  if (!row) return c.json({ error: "Failed to create emoji reply" }, 500);

  return c.json(emojiReplyPublic(row, member), 201);
});

api.get("/audio/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.AUDIO.get(key);
  if (!object) return c.json({ error: "Not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");

  return new Response(object.body, { headers });
});
