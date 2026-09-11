import { describe, expect, it } from "vitest";
import { isTapeEmoji, TAPE_EMOJIS } from "./emoji";
import {
  emojiNearPlayhead,
  lanesForMarks,
  xToOffsetMs,
} from "./tapeMarks";

describe("isTapeEmoji", () => {
  it("accepts palette emoji", () => {
    expect(isTapeEmoji("❤️")).toBe(true);
    expect(TAPE_EMOJIS.includes("👏")).toBe(true);
  });

  it("rejects unknown emoji", () => {
    expect(isTapeEmoji("🙃")).toBe(false);
    expect(isTapeEmoji("")).toBe(false);
  });
});

describe("xToOffsetMs", () => {
  it("maps pointer x to clip offset", () => {
    expect(xToOffsetMs(50, 100, 1000, 0)).toBe(500);
  });

  it("clamps outside the track", () => {
    expect(xToOffsetMs(-10, 100, 1000, 0)).toBe(0);
    expect(xToOffsetMs(200, 100, 1000, 0)).toBe(1000);
  });
});

describe("lanesForMarks", () => {
  it("stacks overlapping marks onto separate lanes", () => {
    const lanes = lanesForMarks(
      [
        { id: "a", offsetMs: 100, durationMs: 1000 },
        { id: "b", offsetMs: 110, durationMs: 1000 },
      ],
      200,
      24,
    );
    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("b")).toBe(1);
  });

  it("keeps far-apart marks on lane 0", () => {
    const lanes = lanesForMarks(
      [
        { id: "a", offsetMs: 0, durationMs: 1000 },
        { id: "b", offsetMs: 900, durationMs: 1000 },
      ],
      200,
      24,
    );
    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("b")).toBe(0);
  });
});

describe("emojiNearPlayhead", () => {
  const clips = [{ id: "c1", durationMs: 2000, peaks: [] }];
  const emojis = [
    { id: "e1", clipId: "c1", offsetMs: 400 },
    { id: "e2", clipId: "c1", offsetMs: 1500 },
  ];

  it("returns the closest emoji within the window", () => {
    expect(emojiNearPlayhead(emojis, clips, 420, 300)?.id).toBe("e1");
  });

  it("returns null when nothing is nearby", () => {
    expect(emojiNearPlayhead(emojis, clips, 900, 200)).toBeNull();
  });
});
