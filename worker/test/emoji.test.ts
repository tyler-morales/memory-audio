import { describe, expect, it } from "vitest";
import { normalizeEmoji, normalizeTapeOffsetMs, TAPE_EMOJIS } from "../src/lib/emoji";

describe("normalizeEmoji", () => {
  it("accepts a palette emoji", () => {
    expect(normalizeEmoji("🔥")).toBe("🔥");
  });

  it("rejects unknown or empty emoji", () => {
    expect(normalizeEmoji("")).toBeNull();
    expect(normalizeEmoji("abc")).toBeNull();
    expect(normalizeEmoji("🙃")).toBeNull();
  });

  it("covers the full tape palette", () => {
    for (const emoji of TAPE_EMOJIS) {
      expect(normalizeEmoji(emoji)).toBe(emoji);
    }
  });
});

describe("normalizeTapeOffsetMs", () => {
  it("rounds a valid offset inside the clip", () => {
    expect(normalizeTapeOffsetMs(1234.6, 5000)).toBe(1235);
  });

  it("rejects missing, negative, or non-finite offsets", () => {
    expect(normalizeTapeOffsetMs(Number.NaN, 1000)).toBeNull();
    expect(normalizeTapeOffsetMs(-1, 1000)).toBeNull();
    expect(normalizeTapeOffsetMs(0, 0)).toBeNull();
  });

  it("clamps past the clip duration", () => {
    expect(normalizeTapeOffsetMs(9999, 2000)).toBe(2000);
  });
});
