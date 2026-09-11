import { describe, expect, it } from "vitest";
import {
  createToken,
  isAllowedMime,
  isValidToken,
  normalizeColor,
  normalizeDisplayName,
  stringifyPeaks,
  parsePeaks,
} from "../src/lib/ids";

describe("token", () => {
  it("creates valid 128-bit tokens", () => {
    const token = createToken();
    expect(isValidToken(token)).toBe(true);
  });

  it("rejects short tokens", () => {
    expect(isValidToken("abc")).toBe(false);
  });
});

describe("display name and color", () => {
  it("accepts valid name", () => {
    expect(normalizeDisplayName("  Tyler ")).toBe("Tyler");
  });

  it("rejects empty name", () => {
    expect(normalizeDisplayName("   ")).toBeNull();
  });

  it("accepts hex color", () => {
    expect(normalizeColor("#e07a5f")).toBe("#E07A5F");
  });

  it("rejects invalid color", () => {
    expect(normalizeColor("red")).toBeNull();
  });
});

describe("mime and peaks", () => {
  it("allows webm and mp4", () => {
    expect(isAllowedMime("audio/webm")).toBe(true);
    expect(isAllowedMime("audio/mp4")).toBe(true);
    expect(isAllowedMime("video/mp4")).toBe(false);
  });

  it("round-trips peaks", () => {
    const json = stringifyPeaks([0, 0.5, 1.2, -1]);
    expect(parsePeaks(json)).toEqual([0, 0.5, 1, 0]);
  });

  it("handles bad peaks json", () => {
    expect(parsePeaks("not-json")).toEqual([]);
  });
});
