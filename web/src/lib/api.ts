export type Member = {
  id: string;
  displayName: string;
  color: string;
};

export type Clip = {
  id: string;
  position: number;
  durationMs: number;
  mime: string;
  peaks: number[];
  audioUrl: string;
  createdAt: string;
};

export type Reply = {
  id: string;
  author: Member;
  parentReplyId: string | null;
  clipId: string | null;
  offsetMs: number | null;
  durationMs: number;
  mime: string;
  peaks: number[];
  audioUrl: string;
  createdAt: string;
};

export type EmojiReply = {
  id: string;
  author: Member;
  clipId: string;
  offsetMs: number;
  emoji: string;
  createdAt: string;
};

export type MemorySummary = {
  id: string;
  title: string;
  creator: Member;
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
  clips: Clip[];
  replies: Reply[];
  emojiReplies: EmojiReply[];
};

export const MEMBER_COLORS = [
  "#E07A5F",
  "#3D405B",
  "#81B29A",
  "#F2CC8F",
  "#E9C46A",
  "#2A9D8F",
  "#E76F51",
  "#264653",
] as const;

function memberHeaders(memberId: string | null): HeadersInit {
  return memberId ? { "X-Member-Id": memberId } : {};
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function createSpace(): Promise<{ id: string; token: string; url: string }> {
  const res = await fetch("/api/spaces", { method: "POST" });
  return parseJson(res);
}

export async function getSpace(token: string): Promise<{ id: string; token: string; createdAt: string }> {
  const res = await fetch(`/api/spaces/${token}`);
  return parseJson(res);
}

export async function joinSpace(
  token: string,
  displayName: string,
  color: string,
): Promise<Member> {
  const res = await fetch(`/api/spaces/${token}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, color }),
  });
  return parseJson(res);
}

export async function listMemories(token: string): Promise<MemorySummary[]> {
  const res = await fetch(`/api/spaces/${token}/memories`);
  const data = await parseJson<{ memories: MemorySummary[] }>(res);
  return data.memories;
}

export async function createMemory(token: string, memberId: string): Promise<MemorySummary> {
  const res = await fetch(`/api/spaces/${token}/memories`, {
    method: "POST",
    headers: memberHeaders(memberId),
  });
  return parseJson(res);
}

export async function getMemory(token: string, memoryId: string): Promise<MemoryDetail> {
  const res = await fetch(`/api/spaces/${token}/memories/${memoryId}`);
  return parseJson(res);
}

export async function updateMemoryTitle(
  token: string,
  memoryId: string,
  memberId: string,
  title: string,
): Promise<{ id: string; title: string; updatedAt: string }> {
  const res = await fetch(`/api/spaces/${token}/memories/${memoryId}`, {
    method: "PATCH",
    headers: {
      ...memberHeaders(memberId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });
  return parseJson(res);
}

export async function uploadClip(
  token: string,
  memoryId: string,
  memberId: string,
  audio: Blob,
  durationMs: number,
  peaks: number[],
  mime: string,
): Promise<Clip> {
  const form = new FormData();
  const ext = mime.includes("webm") ? "webm" : mime.includes("wav") ? "wav" : "m4a";
  form.append("audio", audio, `clip.${ext}`);
  form.append("durationMs", String(durationMs));
  form.append("peaks", JSON.stringify(peaks));

  const res = await fetch(`/api/spaces/${token}/memories/${memoryId}/clips`, {
    method: "POST",
    headers: memberHeaders(memberId),
    body: form,
  });
  return parseJson(res);
}

export async function deleteClip(
  token: string,
  memoryId: string,
  memberId: string,
  clipId: string,
): Promise<void> {
  const res = await fetch(`/api/spaces/${token}/memories/${memoryId}/clips/${clipId}`, {
    method: "DELETE",
    headers: memberHeaders(memberId),
  });
  await parseJson<{ ok: boolean }>(res);
}

export async function reorderClips(
  token: string,
  memoryId: string,
  memberId: string,
  clipIds: string[],
): Promise<Clip[]> {
  const res = await fetch(`/api/spaces/${token}/memories/${memoryId}/clips/order`, {
    method: "PUT",
    headers: {
      ...memberHeaders(memberId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clipIds }),
  });
  const data = await parseJson<{ clips: Clip[] }>(res);
  return data.clips;
}

export type UploadReplyInput = {
  audio: Blob;
  durationMs: number;
  peaks: number[];
  mime: string;
  clipId?: string | null;
  offsetMs?: number | null;
  parentReplyId?: string | null;
};

export async function uploadReply(
  token: string,
  memoryId: string,
  memberId: string,
  input: UploadReplyInput,
): Promise<Reply> {
  const form = new FormData();
  const ext = input.mime.includes("webm") ? "webm" : "m4a";
  form.append("audio", input.audio, `reply.${ext}`);
  form.append("durationMs", String(input.durationMs));
  form.append("peaks", JSON.stringify(input.peaks));
  if (input.parentReplyId) form.append("parentReplyId", input.parentReplyId);
  if (input.clipId) form.append("clipId", input.clipId);
  if (input.offsetMs != null) form.append("offsetMs", String(input.offsetMs));

  const res = await fetch(`/api/spaces/${token}/memories/${memoryId}/replies`, {
    method: "POST",
    headers: memberHeaders(memberId),
    body: form,
  });
  return parseJson(res);
}

export async function postEmojiReply(
  token: string,
  memoryId: string,
  memberId: string,
  input: { clipId: string; offsetMs: number; emoji: string },
): Promise<EmojiReply> {
  const res = await fetch(`/api/spaces/${token}/memories/${memoryId}/emoji-replies`, {
    method: "POST",
    headers: {
      ...memberHeaders(memberId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}
