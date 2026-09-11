import { clipPositionToAbsolute, type TimelineClip } from "./timeline";

export type TapeMark = {
  id: string;
  offsetMs: number;
  durationMs: number;
};

/**
 * Map a pointer x (in the seek control) to a clip-local offset.
 */
export function xToOffsetMs(x: number, width: number, durationMs: number, pad = 0): number {
  const inner = Math.max(1, width - pad * 2);
  const frac = Math.max(0, Math.min(1, (x - pad) / inner));
  return Math.round(frac * Math.max(0, durationMs));
}

/**
 * Greedy lane assignment so overlapping marks stack instead of covering each other.
 */
export function lanesForMarks(
  marks: TapeMark[],
  trackInnerPx: number,
  minGapPx = 22,
): Map<string, number> {
  const lanes = new Map<string, number>();
  const laneRight: number[] = [];
  const sorted = marks.slice().sort((a, b) => a.offsetMs - b.offsetMs);
  for (const mark of sorted) {
    const duration = Math.max(1, mark.durationMs);
    const x = (mark.offsetMs / duration) * Math.max(1, trackInnerPx);
    let lane = laneRight.findIndex((right) => x - right >= minGapPx);
    if (lane < 0) {
      lane = laneRight.length;
      laneRight.push(x);
    } else {
      laneRight[lane] = x;
    }
    lanes.set(mark.id, lane);
  }
  return lanes;
}

export type PlayheadEmoji = {
  id: string;
  clipId: string;
  offsetMs: number;
};

/** Closest timed emoji whose absolute time is within `windowMs` of the playhead. */
export function emojiNearPlayhead<T extends PlayheadEmoji>(
  emojis: T[],
  clips: TimelineClip[],
  positionMs: number,
  windowMs = 500,
): T | null {
  let closest: T | null = null;
  let best = Infinity;
  for (const emoji of emojis) {
    const abs = clipPositionToAbsolute(clips, emoji.clipId, emoji.offsetMs);
    if (abs == null) continue;
    const dist = Math.abs(abs - positionMs);
    if (dist <= windowMs && dist < best) {
      best = dist;
      closest = emoji;
    }
  }
  return closest;
}
