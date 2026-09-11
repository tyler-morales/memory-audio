import { describe, expect, it } from "vitest";
import { committedMemoryTitle, displayMemoryTitle, MAX_MEMORY_TITLE_CHARS } from "./memoryTitle";

describe("displayMemoryTitle", () => {
  it("uses a custom title when present", () => {
    expect(displayMemoryTitle("Sunday breakfast", "Tyler")).toBe("Sunday breakfast");
  });

  it("falls back to the creator name when untitled", () => {
    expect(displayMemoryTitle("   ", "Tyler")).toBe("Tyler's memory");
  });

  it("caps titles at 80 characters", () => {
    expect(MAX_MEMORY_TITLE_CHARS).toBe(80);
  });
});

describe("committedMemoryTitle", () => {
  it("returns a trimmed title when it changed", () => {
    expect(committedMemoryTitle("  Kitchen talk  ", "")).toBe("Kitchen talk");
  });

  it("returns null when the title did not change", () => {
    expect(committedMemoryTitle("Kitchen talk", "Kitchen talk")).toBeNull();
    expect(committedMemoryTitle("  ", "")).toBeNull();
  });
});
