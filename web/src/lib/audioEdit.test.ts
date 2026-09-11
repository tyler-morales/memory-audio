import { describe, expect, it } from "vitest";
import {
  MIN_KEEP_MS,
  applyHandleDelta,
  encodeWav,
  isIdentityKeep,
  renderClipEdit,
  resolveKeepRanges,
  sliceChannelData,
  slicePeaks,
  type ClipEdit,
} from "./audioEdit";

const thirtySeconds: ClipEdit = {
  durationMs: 30_000,
  keepStartMs: 0,
  keepEndMs: 30_000,
  cut: null,
};

describe("resolveKeepRanges", () => {
  it("keeps a trimmed window", () => {
    expect(
      resolveKeepRanges({
        ...thirtySeconds,
        keepStartMs: 1500,
        keepEndMs: 28_000,
      }),
    ).toEqual([{ startMs: 1500, endMs: 28_000 }]);
  });

  it("splits around a middle cut", () => {
    expect(
      resolveKeepRanges({
        ...thirtySeconds,
        cut: { startMs: 4000, endMs: 5500 },
      }),
    ).toEqual([
      { startMs: 0, endMs: 4000 },
      { startMs: 5500, endMs: 30_000 },
    ]);
  });

  it("treats a cut at the start as a trim", () => {
    expect(
      resolveKeepRanges({
        ...thirtySeconds,
        cut: { startMs: 0, endMs: 800 },
      }),
    ).toEqual([{ startMs: 800, endMs: 30_000 }]);
  });

  it("rejects a keep window shorter than the minimum", () => {
    expect(() =>
      resolveKeepRanges({
        ...thirtySeconds,
        keepStartMs: 0,
        keepEndMs: MIN_KEEP_MS - 1,
      }),
    ).toThrow(/0\.2 seconds/);
  });

  it("rejects a cut that removes the whole keep window", () => {
    expect(() =>
      resolveKeepRanges({
        durationMs: 5000,
        keepStartMs: 1000,
        keepEndMs: 2000,
        cut: { startMs: 1000, endMs: 2000 },
      }),
    ).toThrow(/whole clip/);
  });

  it("rejects an empty cut range", () => {
    expect(() =>
      resolveKeepRanges({
        ...thirtySeconds,
        cut: { startMs: 4000, endMs: 4000 },
      }),
    ).toThrow(/empty/);
  });

  it("rejects missing duration", () => {
    expect(() =>
      resolveKeepRanges({
        durationMs: 0,
        keepStartMs: 0,
        keepEndMs: 1000,
        cut: null,
      }),
    ).toThrow(/duration/);
  });
});

describe("applyHandleDelta", () => {
  const full = { keepStartMs: 0, keepEndMs: 10_000, durationMs: 10_000 };

  it("trims the start when dragging the left edge right", () => {
    expect(applyHandleDelta(full, "start", 1500)).toEqual({
      keepStartMs: 1500,
      keepEndMs: 10_000,
    });
  });

  it("trims the end when dragging the right edge left", () => {
    expect(applyHandleDelta(full, "end", -2000)).toEqual({
      keepStartMs: 0,
      keepEndMs: 8000,
    });
  });

  it("clamps so the keep window stays at least the minimum", () => {
    expect(applyHandleDelta(full, "start", 9900)).toEqual({
      keepStartMs: 10_000 - MIN_KEEP_MS,
      keepEndMs: 10_000,
    });
    expect(applyHandleDelta(full, "end", -9900)).toEqual({
      keepStartMs: 0,
      keepEndMs: MIN_KEEP_MS,
    });
  });

  it("does not move past the clip bounds", () => {
    expect(applyHandleDelta(full, "start", -400)).toEqual({
      keepStartMs: 0,
      keepEndMs: 10_000,
    });
    expect(applyHandleDelta(full, "end", 400)).toEqual({
      keepStartMs: 0,
      keepEndMs: 10_000,
    });
  });
});

describe("isIdentityKeep", () => {
  it("is true for the full clip window", () => {
    expect(isIdentityKeep({ keepStartMs: 0, keepEndMs: 10_000, durationMs: 10_000 })).toBe(true);
  });

  it("is false once either edge has moved in", () => {
    expect(isIdentityKeep({ keepStartMs: 50, keepEndMs: 10_000, durationMs: 10_000 })).toBe(false);
    expect(isIdentityKeep({ keepStartMs: 0, keepEndMs: 9_900, durationMs: 10_000 })).toBe(false);
  });
});

describe("slicePeaks", () => {
  it("keeps peaks inside the trimmed window", () => {
    const peaks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    expect(slicePeaks(peaks, 1000, [{ startMs: 200, endMs: 500 }])).toEqual([0.3, 0.4, 0.5]);
  });

  it("concatenates peaks across a cut", () => {
    const peaks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    expect(
      slicePeaks(peaks, 800, [
        { startMs: 0, endMs: 200 },
        { startMs: 600, endMs: 800 },
      ]),
    ).toEqual([0.1, 0.2, 0.7, 0.8]);
  });

  it("returns a placeholder when there are no peaks", () => {
    expect(slicePeaks([], 1000, [{ startMs: 0, endMs: 500 }])).toEqual([0.2]);
  });
});

describe("sliceChannelData", () => {
  it("copies samples for a keep window", () => {
    const channel = new Float32Array([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    const sliced = sliceChannelData([channel], 10, [{ startMs: 200, endMs: 500 }]);
    expect(Array.from(sliced[0]!)).toEqual(Array.from(new Float32Array([0.2, 0.3, 0.4])));
  });

  it("joins samples around a cut", () => {
    const channel = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const sliced = sliceChannelData(
      [channel],
      10,
      [
        { startMs: 0, endMs: 200 },
        { startMs: 800, endMs: 1000 },
      ],
    );
    expect(Array.from(sliced[0]!)).toEqual([0, 1, 8, 9]);
  });
});

describe("encodeWav", () => {
  it("writes a PCM wav header for mono audio", () => {
    const blob = encodeWav([new Float32Array([0, 1, -1])], 8000);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBeGreaterThan(44);
  });

  it("rejects empty channel data", () => {
    expect(() => encodeWav([new Float32Array(0)], 8000)).toThrow(/empty/);
  });
});

describe("renderClipEdit", () => {
  it("returns trimmed wav audio and peaks", async () => {
    const samples = new Float32Array(10);
    for (let i = 0; i < 10; i++) samples[i] = i / 10;
    const result = await renderClipEdit(
      new Blob(),
      1000,
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      { keepStartMs: 200, keepEndMs: 800, cut: { startMs: 400, endMs: 600 } },
      async () => ({ channels: [samples], sampleRate: 10 }),
    );
    expect(result.mime).toBe("audio/wav");
    expect(result.durationMs).toBe(400);
    expect(result.peaks).toEqual([0.3, 0.4, 0.7, 0.8]);
    expect(result.blob.size).toBeGreaterThan(44);
  });

  it("fails when the decoder returns no samples", async () => {
    await expect(
      renderClipEdit(
        new Blob(),
        1000,
        [0.5],
        { keepStartMs: 0, keepEndMs: 500, cut: null },
        async () => ({ channels: [new Float32Array(0)], sampleRate: 8000 }),
      ),
    ).rejects.toThrow(/decode/);
  });
});
