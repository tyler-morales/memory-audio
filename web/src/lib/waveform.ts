/** Visual layout for clip-block waveforms (px). */
export const BAR_W = 5;
export const BAR_GAP = 2;
export const BLOCK_PAD = 10;
export const BLOCK_GAP = 10;
export const MIN_BARS = 12;
export const MAX_BARS = 48;
export const MS_PER_BAR = 120;
export const RECORDING_MIN_W = 280;
export const ADD_TILE_W = 72;

export function resamplePeakBars(source: number[], target: number): number[] {
  if (target <= 0) return [];
  if (source.length === 0) return Array.from({ length: target }, () => 0.2);
  if (source.length === target) return source;
  if (source.length < target) {
    const out: number[] = [];
    for (let i = 0; i < target; i++) {
      out.push(source[Math.floor((i / target) * source.length)] ?? 0.2);
    }
    return out;
  }
  const bucket = source.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.floor((i + 1) * bucket);
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, source[j] ?? 0);
    out.push(max);
  }
  return out;
}

export function clipBarCount(durationMs: number): number {
  return Math.min(MAX_BARS, Math.max(MIN_BARS, Math.round(durationMs / MS_PER_BAR)));
}

export function recordingBarCount(elapsedMs: number): number {
  return Math.max(1, Math.round(Math.max(0, elapsedMs) / MS_PER_BAR));
}

export function barsForClip(peaks: number[], durationMs: number): number[] {
  const source = peaks.length > 0 ? peaks : [0.2, 0.35, 0.25];
  return resamplePeakBars(source, clipBarCount(durationMs));
}

export function barsForRecording(peaks: number[], elapsedMs: number): number[] {
  const source = peaks.length > 0 ? peaks : [0.2];
  return resamplePeakBars(source, recordingBarCount(elapsedMs));
}

export function blockWidthForBars(barCount: number, minWidth = 0): number {
  if (barCount <= 0) return minWidth;
  return Math.max(minWidth, BLOCK_PAD * 2 + barCount * (BAR_W + BAR_GAP) - BAR_GAP);
}

export function recordingPlayheadOffset(elapsedMs: number, blockWidth: number): number {
  const barsW = Math.max(0, recordingBarCount(elapsedMs) * (BAR_W + BAR_GAP) - BAR_GAP);
  const inner = Math.max(0, blockWidth - BLOCK_PAD * 2);
  return BLOCK_PAD + Math.min(inner, barsW);
}

export function followPlayheadScrollLeft(playheadX: number, viewportWidth: number): number {
  return Math.max(0, playheadX - viewportWidth / 2);
}
