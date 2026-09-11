import { useEffect, useMemo, useRef } from "react";
import type { Reply } from "../lib/api";
import { formatDuration, totalDuration, type TimelineClip } from "../lib/timeline";

type Props = {
  clips: TimelineClip[];
  positionMs: number;
  replies: Reply[];
  /** Jump to an absolute time (e.g. fine seek inside a block). */
  onSeek: (ms: number) => void;
  /** Jump playhead to the start of a clip block (does not auto-play). */
  onSelectClip: (clipId: string) => void;
  onTickActivate: (reply: Reply) => void;
};

const BAR_W = 5;
const BAR_GAP = 2;
const BLOCK_PAD = 10;
const BLOCK_GAP = 10;
const MIN_BARS = 12;
const MAX_BARS = 48;

function barsForClip(clip: TimelineClip): number[] {
  const peaks = clip.peaks.length > 0 ? clip.peaks : [0.2, 0.35, 0.25];
  const target = Math.min(
    MAX_BARS,
    Math.max(MIN_BARS, Math.round(clip.durationMs / 120)),
  );
  if (peaks.length === target) return peaks;
  if (peaks.length < target) {
    const out: number[] = [];
    for (let i = 0; i < target; i++) {
      out.push(peaks[Math.floor((i / target) * peaks.length)] ?? 0.2);
    }
    return out;
  }
  const bucket = peaks.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.floor((i + 1) * bucket);
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, peaks[j] ?? 0);
    out.push(max);
  }
  return out;
}

export function TapeWaveform({
  clips,
  positionMs,
  replies,
  onSeek,
  onPlayClip,
  onTickActivate,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(
    () =>
      clips.map((clip, index) => {
        const bars = barsForClip(clip);
        const width = BLOCK_PAD * 2 + bars.length * (BAR_W + BAR_GAP) - BAR_GAP;
        return { clip, index, bars, width };
      }),
    [clips],
  );

  const total = totalDuration(clips);
  const active = useMemo(() => {
    let cursor = 0;
    for (let i = 0; i < clips.length; i++) {
      const end = cursor + clips[i]!.durationMs;
      if (positionMs < end || i === clips.length - 1) {
        return {
          index: i,
          localMs: Math.min(clips[i]!.durationMs, Math.max(0, positionMs - cursor)),
          startMs: cursor,
        };
      }
      cursor = end;
    }
    return { index: 0, localMs: 0, startMs: 0 };
  }, [clips, positionMs]);

  const trackWidth = useMemo(() => {
    if (blocks.length === 0) return 280;
    return (
      blocks.reduce((sum, b) => sum + b.width, 0) + BLOCK_GAP * Math.max(0, blocks.length - 1)
    );
  }, [blocks]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || blocks.length === 0) return;
    let x = 0;
    for (let i = 0; i < active.index; i++) {
      x += blocks[i]!.width + BLOCK_GAP;
    }
    const block = blocks[active.index];
    if (!block) return;
    const localProgress =
      block.clip.durationMs > 0 ? active.localMs / block.clip.durationMs : 0;
    const playheadX = x + BLOCK_PAD + localProgress * (block.width - BLOCK_PAD * 2);
    scroller.scrollLeft = Math.max(0, playheadX - scroller.clientWidth / 2);
  }, [active.index, active.localMs, blocks]);

  const timedReplies = replies.filter((r) => r.clipId && r.offsetMs != null && !r.parentReplyId);

  return (
    <div className="wave-scroll" ref={scrollRef}>
      {blocks.length === 0 ? (
        <p className="wave-empty">No clips yet — record a block to start the tape.</p>
      ) : (
        <div
          className="wave-blocks"
          style={{ width: trackWidth }}
          role="list"
          aria-label="Audio clip blocks"
        >
          {blocks.map(({ clip, index, bars, width }) => {
            const isActive = index === active.index;
            const progress =
              clip.durationMs > 0 && isActive
                ? Math.min(1, active.localMs / clip.durationMs)
                : index < active.index
                  ? 1
                  : 0;

            const clipReplies = timedReplies.filter((r) => r.clipId === clip.id);

            return (
              <div
                key={clip.id}
                className={`clip-block${isActive ? " is-active" : ""}`}
                style={{ width }}
                role="listitem"
              >
                <button
                  type="button"
                  className="clip-block__hit"
                  aria-label={`Play clip ${index + 1}, ${formatDuration(clip.durationMs)}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => onPlayClip(clip.id)}
                >
                  <span className="clip-block__label">
                    {index + 1} · {formatDuration(clip.durationMs)}
                  </span>
                  <span className="clip-block__bars" aria-hidden>
                    {bars.map((p, i) => {
                      const frac = bars.length > 1 ? i / (bars.length - 1) : 0;
                      const played = frac <= progress;
                      return (
                        <span
                          key={i}
                          className={`wave-bar ${played ? "is-played" : "is-future"}`}
                          style={{ height: `${Math.max(10, Math.round(p * 100))}%` }}
                        />
                      );
                    })}
                  </span>
                  {isActive && (
                    <span
                      className="playhead playhead--in-block"
                      style={{
                        left: `${BLOCK_PAD + progress * (width - BLOCK_PAD * 2)}px`,
                      }}
                      aria-hidden
                    />
                  )}
                </button>

                {clipReplies.map((reply) => {
                  const local = reply.offsetMs ?? 0;
                  const left =
                    BLOCK_PAD +
                    Math.max(0, Math.min(1, local / clip.durationMs)) *
                      (width - BLOCK_PAD * 2);
                  return (
                    <button
                      key={reply.id}
                      type="button"
                      className="reply-tick"
                      style={{
                        left: `${left}px`,
                        background: reply.author.color,
                        top: "6px",
                      }}
                      aria-label={`Reply from ${reply.author.displayName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTickActivate(reply);
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {total > 0 && (
        <div className="sr-only">
          <button type="button" onClick={() => onSeek(Math.max(0, positionMs - 1000))}>
            Seek back 1 second
          </button>
          <button type="button" onClick={() => onSeek(Math.min(total, positionMs + 1000))}>
            Seek forward 1 second
          </button>
        </div>
      )}
    </div>
  );
}
