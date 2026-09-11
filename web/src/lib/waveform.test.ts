import { describe, expect, it } from "vitest";
import {
  BAR_GAP,
  BAR_W,
  BLOCK_PAD,
  MAX_BARS,
  MS_PER_BAR,
  RECORDING_MIN_W,
  barsForClip,
  barsForRecording,
  blockWidthForBars,
  followPlayheadScrollLeft,
  recordingBarCount,
  recordingPlayheadOffset,
} from "./waveform";

describe("barsForClip", () => {
  it("caps a long saved clip so the tape stays compact", () => {
    const peaks = Array.from({ length: 400 }, () => 0.5);
    expect(barsForClip(peaks, 90_000)).toHaveLength(MAX_BARS);
  });

  it("fails to drop below the minimum bar count for a tiny clip", () => {
    expect(barsForClip([0.2], 50).length).toBeGreaterThanOrEqual(12);
  });
});

describe("barsForRecording", () => {
  it("grows with elapsed time past the saved-clip cap", () => {
    const peaks = Array.from({ length: 400 }, (_, i) => (i % 5) / 5);
    const short = barsForRecording(peaks, 2_000);
    const long = barsForRecording(peaks, 20_000);
    expect(short.length).toBe(Math.round(2_000 / MS_PER_BAR));
    expect(long.length).toBeGreaterThan(MAX_BARS);
    expect(long.length).toBe(Math.round(20_000 / MS_PER_BAR));
  });

  it("fails closed when elapsed is empty — one placeholder bar", () => {
    expect(recordingBarCount(0)).toBe(1);
    expect(barsForRecording([], 0)).toHaveLength(1);
    expect(barsForRecording([], -20)).toHaveLength(1);
  });
});

describe("recording block width and playhead", () => {
  it("starts at the minimum width then grows as bars accumulate", () => {
    const early = blockWidthForBars(recordingBarCount(400), RECORDING_MIN_W);
    const later = blockWidthForBars(recordingBarCount(12_000), RECORDING_MIN_W);
    expect(early).toBe(RECORDING_MIN_W);
    expect(later).toBeGreaterThan(RECORDING_MIN_W);
    expect(later).toBe(blockWidthForBars(recordingBarCount(12_000)));
  });

  it("moves the playhead across the block as audio progresses", () => {
    const width = RECORDING_MIN_W;
    const start = recordingPlayheadOffset(0, width);
    const mid = recordingPlayheadOffset(1_200, width);
    expect(start).toBe(BLOCK_PAD + BAR_W);
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBe(BLOCK_PAD + (recordingBarCount(1_200) * (BAR_W + BAR_GAP) - BAR_GAP));
  });

  it("fails to run past the block padding", () => {
    const width = RECORDING_MIN_W;
    const offset = recordingPlayheadOffset(90_000, width);
    expect(offset).toBe(width - BLOCK_PAD);
  });
});

describe("followPlayheadScrollLeft", () => {
  it("centers the playhead in the viewport", () => {
    expect(followPlayheadScrollLeft(400, 200)).toBe(300);
  });

  it("fails to scroll before the start of the tape", () => {
    expect(followPlayheadScrollLeft(10, 400)).toBe(0);
    expect(followPlayheadScrollLeft(-50, 200)).toBe(0);
  });
});
