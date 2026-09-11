import { describe, expect, it } from "vitest";
import {
  createToken,
  isAllowedMime,
  isValidToken,
  MAX_AUDIO_BYTES,
  normalizeDisplayName,
} from "../src/lib/ids";

describe("API validation contracts", () => {
  it("accepts freshly created tokens", () => {
    expect(isValidToken(createToken())).toBe(true);
  });

  it("rejects unknown tokens", () => {
    expect(isValidToken("short")).toBe(false);
  });

  it("rejects empty display names", () => {
    expect(normalizeDisplayName("")).toBeNull();
  });

  it("allows recording mimes", () => {
    expect(isAllowedMime("audio/mp4")).toBe(true);
    expect(isAllowedMime("audio/webm;codecs=opus")).toBe(true);
  });

  it("duration gate matches upload handler", () => {
    const valid = (ms: number) => Number.isFinite(ms) && ms > 0 && ms <= 90_000;
    expect(valid(0)).toBe(false);
    expect(valid(45000)).toBe(true);
    expect(valid(90001)).toBe(false);
  });

  it("rejects audio over 20 MB", () => {
    expect(MAX_AUDIO_BYTES).toBe(20 * 1024 * 1024);
    expect(21 * 1024 * 1024 > MAX_AUDIO_BYTES).toBe(true);
  });
});
