export type TimelineClip = {
  id: string;
  durationMs: number;
  peaks: number[];
};

export type AbsolutePosition = {
  clipId: string;
  offsetMs: number;
  absoluteMs: number;
};

/**
 * Map absolute playhead ms across concatenated clips → clip + local offset.
 */
export function absoluteToClipPosition(
  clips: TimelineClip[],
  absoluteMs: number,
): AbsolutePosition | null {
  if (clips.length === 0) return null;
  const clamped = Math.max(0, absoluteMs);
  let cursor = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    const end = cursor + clip.durationMs;
    if (clamped < end || i === clips.length - 1) {
      const offsetMs = Math.min(clip.durationMs, Math.max(0, clamped - cursor));
      return { clipId: clip.id, offsetMs, absoluteMs: cursor + offsetMs };
    }
    cursor = end;
  }
  const last = clips[clips.length - 1]!;
  return {
    clipId: last.id,
    offsetMs: last.durationMs,
    absoluteMs: clips.reduce((s, c) => s + c.durationMs, 0),
  };
}

export function clipPositionToAbsolute(
  clips: TimelineClip[],
  clipId: string,
  offsetMs: number,
): number | null {
  let cursor = 0;
  for (const clip of clips) {
    if (clip.id === clipId) {
      return cursor + Math.max(0, Math.min(clip.durationMs, offsetMs));
    }
    cursor += clip.durationMs;
  }
  return null;
}

export function totalDuration(clips: TimelineClip[]): number {
  return clips.reduce((sum, c) => sum + c.durationMs, 0);
}

export function concatPeaks(clips: TimelineClip[], targetBars = 120): number[] {
  const all: number[] = [];
  for (const clip of clips) {
    all.push(...(clip.peaks.length ? clip.peaks : [0.2]));
  }
  if (all.length === 0) return [];
  if (all.length <= targetBars) return all;
  const bucket = all.length / targetBars;
  const out: number[] = [];
  for (let i = 0; i < targetBars; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.floor((i + 1) * bucket);
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, all[j] ?? 0);
    out.push(max);
  }
  return out;
}

/** Boundaries as fraction of total duration (0–1), excluding 0 and 1. */
export function clipBoundaryFractions(clips: TimelineClip[]): number[] {
  const total = totalDuration(clips);
  if (total <= 0 || clips.length <= 1) return [];
  const marks: number[] = [];
  let cursor = 0;
  for (let i = 0; i < clips.length - 1; i++) {
    cursor += clips[i]!.durationMs;
    marks.push(cursor / total);
  }
  return marks;
}

export function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatRelative(iso: string, now = Date.now()): string {
  // SQLite datetime('now') is UTC without timezone — normalize to Instant
  const normalized = iso.includes("T")
    ? iso.endsWith("Z")
      ? iso
      : `${iso}Z`
    : `${iso.replace(" ", "T")}Z`;
  const t = new Date(normalized).getTime();
  const diff = Math.max(0, now - (Number.isFinite(t) ? t : now));
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
