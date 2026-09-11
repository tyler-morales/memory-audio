import type { Env, MemberRow, MemoryRow, SpaceRow, ClipRow, ReplyRow } from "./types";

export async function getSpaceByToken(db: D1Database, token: string): Promise<SpaceRow | null> {
  return db.prepare("SELECT * FROM spaces WHERE token = ?").bind(token).first<SpaceRow>();
}

export async function getMember(
  db: D1Database,
  spaceId: string,
  memberId: string,
): Promise<MemberRow | null> {
  return db
    .prepare("SELECT * FROM members WHERE id = ? AND space_id = ?")
    .bind(memberId, spaceId)
    .first<MemberRow>();
}

export async function getMemory(
  db: D1Database,
  spaceId: string,
  memoryId: string,
): Promise<MemoryRow | null> {
  return db
    .prepare("SELECT * FROM memories WHERE id = ? AND space_id = ?")
    .bind(memoryId, spaceId)
    .first<MemoryRow>();
}

export async function listClips(db: D1Database, memoryId: string): Promise<ClipRow[]> {
  const result = await db
    .prepare("SELECT * FROM clips WHERE memory_id = ? ORDER BY position ASC")
    .bind(memoryId)
    .all<ClipRow>();
  return result.results ?? [];
}

export async function listReplies(db: D1Database, memoryId: string): Promise<ReplyRow[]> {
  const result = await db
    .prepare("SELECT * FROM replies WHERE memory_id = ? ORDER BY created_at ASC")
    .bind(memoryId)
    .all<ReplyRow>();
  return result.results ?? [];
}

export async function listMembersByIds(
  db: D1Database,
  ids: string[],
): Promise<Map<string, MemberRow>> {
  const map = new Map<string, MemberRow>();
  if (ids.length === 0) return map;
  // D1 has no IN binding helper; fetch individually in parallel for MVP sizes
  const rows = await Promise.all(
    ids.map((id) => db.prepare("SELECT * FROM members WHERE id = ?").bind(id).first<MemberRow>()),
  );
  for (const row of rows) {
    if (row) map.set(row.id, row);
  }
  return map;
}

export async function touchMemory(db: D1Database, memoryId: string): Promise<void> {
  await db
    .prepare("UPDATE memories SET updated_at = datetime('now') WHERE id = ?")
    .bind(memoryId)
    .run();
}

export function requireMemberId(c: { req: { header: (n: string) => string | undefined } }): string | null {
  const id = c.req.header("X-Member-Id")?.trim();
  return id && id.length > 0 ? id : null;
}

export async function putAudio(
  env: Env,
  key: string,
  body: ArrayBuffer,
  mime: string,
): Promise<void> {
  await env.AUDIO.put(key, body, {
    httpMetadata: { contentType: mime },
  });
}
