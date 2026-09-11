/** Curated reactions dropped on clip blocks (must match worker/src/lib/emoji.ts). */
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

export function isTapeEmoji(value: string): value is TapeEmoji {
  return TAPE_EMOJI_SET.has(value);
}
