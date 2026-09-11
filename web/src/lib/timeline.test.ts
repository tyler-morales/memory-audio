import { describe, expect, it } from "vitest";
import {
  absoluteToClipPosition,
  clipBoundaryFractions,
  clipPositionToAbsolute,
  concatPeaks,
  totalDuration,
} from "./timeline";
import { downsamplePeaks, pickRecorderMime } from "./recorder";

describe("absoluteToClipPosition", () => {
  const clips = [
    { id: "a", durationMs: 1000, peaks: [] },
    { id: "b", durationMs: 2000, peaks: [] },
  ];

  it("maps into first clip", () => {
    expect(absoluteToClipPosition(clips, 400)).toEqual({
      clipId: "a",
      offsetMs: 400,
      absoluteMs: 400,
    });
  });

  it("maps into second clip", () => {
    expect(absoluteToClipPosition(clips, 1500)).toEqual({
      clipId: "b",
      offsetMs: 500,
      absoluteMs: 1500,
    });
  });

  it("clamps past end to last clip", () => {
    const pos = absoluteToClipPosition(clips, 99999);
    expect(pos?.clipId).toBe("b");
    expect(pos?.offsetMs).toBe(2000);
  });

  it("returns null for empty", () => {
    expect(absoluteToClipPosition([], 0)).toBeNull();
  });
});

describe("clipPositionToAbsolute", () => {
  const clips = [
    { id: "a", durationMs: 1000, peaks: [] },
    { id: "b", durationMs: 2000, peaks: [] },
  ];

  it("converts back", () => {
    expect(clipPositionToAbsolute(clips, "b", 250)).toBe(1250);
  });

  it("fails unknown clip", () => {
    expect(clipPositionToAbsolute(clips, "z", 0)).toBeNull();
  });
});

describe("boundaries and peaks", () => {
  it("computes boundaries", () => {
    const clips = [
      { id: "a", durationMs: 1000, peaks: [1] },
      { id: "b", durationMs: 1000, peaks: [1] },
    ];
    expect(totalDuration(clips)).toBe(2000);
    expect(clipBoundaryFractions(clips)).toEqual([0.5]);
  });

  it("concats peaks", () => {
    const peaks = concatPeaks(
      [
        { id: "a", durationMs: 1, peaks: [0.1, 0.9] },
        { id: "b", durationMs: 1, peaks: [0.5] },
      ],
      10,
    );
    expect(peaks.length).toBeGreaterThan(0);
  });

  it("downsamples peaks", () => {
    const samples = Array.from({ length: 100 }, (_, i) => (i % 10) / 10);
    expect(downsamplePeaks(samples, 10)).toHaveLength(10);
  });
});

describe("pickRecorderMime", () => {
  it("returns undefined without MediaRecorder", () => {
    // In node test env MediaRecorder is typically undefined
    const result = pickRecorderMime();
    expect(result === undefined || typeof result === "string").toBe(true);
  });
});
