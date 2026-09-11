/** Curated reactions that can be dropped on the tape (SoundCloud-style timed marks). */
export const TAPE_EMOJIS = [
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥",
  "👏",
  "🙌",
  "💯",
  "😍",
  "👍",
  "🎉",
  "😭",
  "🤔",
  "✨",
] as const;

export type TapeEmoji = (typeof TAPE_EMOJIS)[number];

const TAPE_EMOJI_SET = new Set<string>(TAPE_EMOJIS);

export function normalizeEmoji(raw: string): TapeEmoji | null {
  const emoji = raw.trim();
  if (!TAPE_EMOJI_SET.has(emoji)) return null;
  return emoji as TapeEmoji;
}

/** Clip-local offset for a timed mark. Duration must be > 0. */
export function normalizeTapeOffsetMs(offsetMs: number, durationMs: number): number | null {
  if (!Number.isFinite(offsetMs) || offsetMs < 0) return null;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  return Math.min(Math.round(durationMs), Math.round(offsetMs));
}
