/**
 * Client-side clip trim/cut. Edited audio is re-encoded as WAV so we don't
 * depend on MediaRecorder for slicing (Safari vs Chrome mime mismatch).
 */

export const MIN_KEEP_MS = 200;

export type TimeRange = {
  startMs: number;
  endMs: number;
};

export type ClipEdit = {
  durationMs: number;
  keepStartMs: number;
  keepEndMs: number;
  cut: TimeRange | null;
};

export type DecodedAudio = {
  channels: Float32Array[];
  sampleRate: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type KeepWindow = {
  keepStartMs: number;
  keepEndMs: number;
  durationMs: number;
};

/**
 * Map a horizontal drag on a clip edge into a keep window.
 * `deltaMs` is pointer delta converted at the untrimmed block's px/ms.
 */
export function applyHandleDelta(
  window: KeepWindow,
  edge: "start" | "end",
  deltaMs: number,
): { keepStartMs: number; keepEndMs: number } {
  if (edge === "start") {
    return {
      keepStartMs: clamp(
        Math.round(window.keepStartMs + deltaMs),
        0,
        window.keepEndMs - MIN_KEEP_MS,
      ),
      keepEndMs: window.keepEndMs,
    };
  }
  return {
    keepStartMs: window.keepStartMs,
    keepEndMs: clamp(
      Math.round(window.keepEndMs + deltaMs),
      window.keepStartMs + MIN_KEEP_MS,
      window.durationMs,
    ),
  };
}

export function isIdentityKeep(window: KeepWindow): boolean {
  return window.keepStartMs <= 0 && window.keepEndMs >= window.durationMs;
}

export function resolveKeepRanges(edit: ClipEdit): TimeRange[] {
  const duration = edit.durationMs;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Clip has no duration");
  }

  const keepStart = clamp(Math.round(edit.keepStartMs), 0, duration);
  const keepEnd = clamp(Math.round(edit.keepEndMs), 0, duration);
  if (keepEnd - keepStart < MIN_KEEP_MS) {
    throw new Error("Keep at least 0.2 seconds");
  }

  if (!edit.cut) {
    return [{ startMs: keepStart, endMs: keepEnd }];
  }

  const cutStart = clamp(Math.round(edit.cut.startMs), keepStart, keepEnd);
  const cutEnd = clamp(Math.round(edit.cut.endMs), keepStart, keepEnd);
  if (cutEnd - cutStart < 1) {
    throw new Error("Cut range is empty");
  }
  if (cutStart <= keepStart && cutEnd >= keepEnd) {
    throw new Error("Cut would remove the whole clip");
  }

  const ranges: TimeRange[] = [];
  if (cutStart > keepStart) ranges.push({ startMs: keepStart, endMs: cutStart });
  if (cutEnd < keepEnd) ranges.push({ startMs: cutEnd, endMs: keepEnd });

  const total = ranges.reduce((sum, range) => sum + (range.endMs - range.startMs), 0);
  if (ranges.length === 0 || total < MIN_KEEP_MS) {
    throw new Error("Cut would remove the whole clip");
  }
  return ranges;
}

export function tryKeepRanges(
  edit: ClipEdit,
): { ok: true; ranges: TimeRange[] } | { ok: false; error: string } {
  try {
    return { ok: true, ranges: resolveKeepRanges(edit) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid edit" };
  }
}

export function rangesDurationMs(ranges: TimeRange[]): number {
  return ranges.reduce((sum, range) => sum + (range.endMs - range.startMs), 0);
}

export function slicePeaks(peaks: number[], durationMs: number, ranges: TimeRange[]): number[] {
  if (peaks.length === 0 || durationMs <= 0) return [0.2];
  const picked: number[] = [];
  for (const range of ranges) {
    const startIdx = Math.floor((range.startMs / durationMs) * peaks.length);
    const endIdx = Math.max(startIdx + 1, Math.ceil((range.endMs / durationMs) * peaks.length));
    picked.push(...peaks.slice(startIdx, Math.min(peaks.length, endIdx)));
  }
  return picked.length > 0 ? picked : [0.2];
}

export function sliceChannelData(
  channels: Float32Array[],
  sampleRate: number,
  ranges: TimeRange[],
): Float32Array[] {
  if (channels.length === 0 || sampleRate <= 0) return channels;
  const sourceLength = channels[0]?.length ?? 0;
  const lengths = ranges.map((range) => {
    const start = clamp(Math.round((range.startMs / 1000) * sampleRate), 0, sourceLength);
    const end = clamp(Math.round((range.endMs / 1000) * sampleRate), start, sourceLength);
    return end - start;
  });
  const total = lengths.reduce((sum, n) => sum + n, 0);
  return channels.map((channel) => {
    const out = new Float32Array(total);
    let offset = 0;
    ranges.forEach((range, index) => {
      const start = clamp(Math.round((range.startMs / 1000) * sampleRate), 0, channel.length);
      const end = start + (lengths[index] ?? 0);
      out.set(channel.subarray(start, Math.min(channel.length, end)), offset);
      offset += lengths[index] ?? 0;
    });
    return out;
  });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  if (channels.length === 0 || channels.some((channel) => channel.length === 0)) {
    throw new Error("Cannot encode empty audio");
  }
  const numChannels = channels.length;
  const frameCount = channels[0]!.length;
  for (const channel of channels) {
    if (channel.length !== frameCount) {
      throw new Error("Channel length mismatch");
    }
  }

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]![i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function decodeViaWebAudio(blob: Blob): Promise<DecodedAudio> {
  const ctx = new AudioContext();
  try {
    const copy = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(copy);
    const channels = Array.from(
      { length: buffer.numberOfChannels },
      (_, i) => new Float32Array(buffer.getChannelData(i)),
    );
    return { channels, sampleRate: buffer.sampleRate };
  } finally {
    await ctx.close();
  }
}

export async function renderClipEdit(
  blob: Blob,
  durationMs: number,
  peaks: number[],
  edit: Omit<ClipEdit, "durationMs">,
  decode: (input: Blob) => Promise<DecodedAudio> = decodeViaWebAudio,
): Promise<{ blob: Blob; mime: string; durationMs: number; peaks: number[] }> {
  const ranges = resolveKeepRanges({ durationMs, ...edit });
  const decoded = await decode(blob);
  if (decoded.channels.length === 0 || (decoded.channels[0]?.length ?? 0) === 0) {
    throw new Error("Could not decode this clip for editing");
  }

  const decodedMs = (decoded.channels[0]!.length / decoded.sampleRate) * 1000;
  const scale = durationMs > 0 ? decodedMs / durationMs : 1;
  const scaled = ranges.map((range) => ({
    startMs: range.startMs * scale,
    endMs: range.endMs * scale,
  }));

  const sliced = sliceChannelData(decoded.channels, decoded.sampleRate, scaled);
  if (sliced.length === 0 || (sliced[0]?.length ?? 0) === 0) {
    throw new Error("Could not decode this clip for editing");
  }

  const wav = encodeWav(sliced, decoded.sampleRate);
  const renderedMs = Math.round((sliced[0]!.length / decoded.sampleRate) * 1000);
  return {
    blob: wav,
    mime: "audio/wav",
    durationMs: Math.max(1, renderedMs),
    peaks: slicePeaks(peaks, durationMs, ranges),
  };
}

export async function blobFromAudioUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load clip audio");
  return res.blob();
}
