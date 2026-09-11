import { useEffect, useMemo, useRef, useState } from "react";
import { ClipTrimHandles } from "./ClipTrimHandles";
import type { EmojiReply, Reply } from "../lib/api";
import { isIdentityKeep } from "../lib/audioEdit";
import type { DraftClip } from "../lib/draft";
import { lanesForMarks, xToOffsetMs } from "../lib/tapeMarks";
import { formatDuration, totalDuration } from "../lib/timeline";
import {
  ADD_TILE_W,
  BLOCK_GAP,
  BLOCK_PAD,
  RECORDING_MIN_W,
  barsForClip,
  barsForRecording,
  blockWidthForBars,
  followPlayheadScrollLeft,
  recordingPlayheadOffset,
} from "../lib/waveform";

type Props = {
  clips: DraftClip[];
  positionMs: number;
  replies: Reply[];
  emojiReplies: EmojiReply[];
  activeEmojiId?: string | null;
  onSeek: (ms: number) => void;
  onSelectClip: (clipId: string) => void;
  onTickActivate: (reply: Reply) => void;
  onEmojiActivate: (emoji: EmojiReply) => void;
  /** Creator: start a new inline recording block */
  onAddClip?: () => void;
  /** Creator: remove a block from the draft */
  onDeleteClip?: (clipId: string) => void;
  /** Creator: commit an inline edge-trim */
  onTrimClip?: (clipId: string, keepStartMs: number, keepEndMs: number) => void;
  /** Pause playback when a trim drag starts */
  onTrimBegin?: () => void;
  /** Clip currently being re-encoded after a trim */
  trimmingClipId?: string | null;
  /** Start recording on an armed block */
  onStartRecording?: (clipId: string) => void;
  /** Stop the in-timeline recording */
  onStopRecording?: () => void;
  /** Cancel/discard an armed or recording block */
  onCancelRecording?: (clipId: string) => void;
};

const EMOJI_LANE_STEP = 14;

function isPlayable(
  clip: DraftClip,
): clip is Extract<DraftClip, { kind: "saved" | "pending" }> {
  return clip.kind === "saved" || clip.kind === "pending";
}

export function TapeWaveform({
  clips,
  positionMs,
  replies,
  emojiReplies,
  activeEmojiId = null,
  onSeek,
  onSelectClip,
  onTickActivate,
  onEmojiActivate,
  onAddClip,
  onDeleteClip,
  onTrimClip,
  onTrimBegin,
  trimmingClipId = null,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopBtnRef = useRef<HTMLButtonElement>(null);
  const [trimPreview, setTrimPreview] = useState<{
    clipId: string;
    keepStartMs: number;
    keepEndMs: number;
  } | null>(null);
  const isRecording = clips.some((c) => c.kind === "recording");

  const blocks = useMemo(
    () =>
      clips.map((clip, index) => {
        if (clip.kind === "recording") {
          const bars = barsForRecording(clip.peaks, clip.elapsedMs);
          return { clip, index, bars, width: blockWidthForBars(bars.length, RECORDING_MIN_W) };
        }
        if (clip.kind === "armed") {
          return { clip, index, bars: [] as number[], width: RECORDING_MIN_W };
        }
        const bars = barsForClip(clip.peaks, clip.durationMs);
        return { clip, index, bars, width: blockWidthForBars(bars.length) };
      }),
    [clips],
  );

  const playable = clips.filter(isPlayable);
  const total = totalDuration(
    playable.map((c) => ({
      id: c.id,
      durationMs: c.durationMs,
      peaks: c.peaks,
    })),
  );

  useEffect(() => {
    if (!trimPreview) return;
    if (!clips.some((c) => c.id === trimPreview.clipId)) setTrimPreview(null);
  }, [clips, trimPreview]);

  const active = useMemo(() => {
    let cursor = 0;
    for (let i = 0; i < playable.length; i++) {
      const clip = playable[i]!;
      const end = cursor + clip.durationMs;
      if (positionMs < end || i === playable.length - 1) {
        const draftIndex = clips.findIndex((c) => c.id === clip.id);
        return {
          index: draftIndex,
          localMs: Math.min(clip.durationMs, Math.max(0, positionMs - cursor)),
          startMs: cursor,
        };
      }
      cursor = end;
    }
    return { index: 0, localMs: 0, startMs: 0 };
  }, [clips, playable, positionMs]);

  const trackWidth = useMemo(() => {
    const clipsWidth =
      blocks.length === 0
        ? 0
        : blocks.reduce((sum, b) => sum + b.width, 0) + BLOCK_GAP * Math.max(0, blocks.length - 1);
    const addExtra = onAddClip && !isRecording ? ADD_TILE_W + (blocks.length > 0 ? BLOCK_GAP : 0) : 0;
    return Math.max(280, clipsWidth + addExtra);
  }, [blocks, onAddClip, isRecording]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || blocks.length === 0) return;
    let x = 0;
    let playheadX: number | null = null;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!;
      if (block.clip.kind === "recording") {
        playheadX = x + recordingPlayheadOffset(block.clip.elapsedMs, block.width);
        break;
      }
      if (!isRecording && i === active.index && isPlayable(block.clip)) {
        const dur = block.clip.durationMs;
        const localProgress = dur > 0 ? active.localMs / dur : 0;
        playheadX = x + BLOCK_PAD + localProgress * (block.width - BLOCK_PAD * 2);
        break;
      }
      x += block.width + BLOCK_GAP;
    }
    if (playheadX == null) return;
    scroller.scrollLeft = followPlayheadScrollLeft(playheadX, scroller.clientWidth);
  }, [active.index, active.localMs, blocks, isRecording]);

  useEffect(() => {
    if (isRecording) stopBtnRef.current?.focus();
  }, [isRecording]);

  const timedReplies = replies.filter((r) => r.clipId && r.offsetMs != null && !r.parentReplyId);

  return (
    <div className="wave-scroll" ref={scrollRef}>
      {isRecording && (
        <div className="sr-only" role="status">
          Recording
        </div>
      )}
      <div
        className="wave-blocks"
        style={{ width: trackWidth }}
        role="list"
        aria-label="Audio clip blocks"
      >
        {blocks.length === 0 && !onAddClip && (
          <p className="wave-empty">No clips yet — tap + to record a block.</p>
        )}

        {blocks.map(({ clip, index, bars, width }) => {
          if (clip.kind === "recording") {
            const playheadLeft = recordingPlayheadOffset(clip.elapsedMs, width);
            return (
              <div
                key={clip.id}
                className="clip-block clip-block--recording is-active"
                style={{ width }}
                role="listitem"
              >
                <div className="clip-block__record-head">
                  <div className="clip-block__record-actions">
                    <span className="clip-block__label">
                      Recording · {formatDuration(clip.elapsedMs)}
                    </span>
                    <button
                      ref={stopBtnRef}
                      type="button"
                      className="danger-btn clip-block__mini-btn"
                      aria-label="Stop recording"
                      onClick={onStopRecording}
                    >
                      Stop
                    </button>
                    <button
                      type="button"
                      className="ghost-btn clip-block__mini-btn"
                      aria-label="Cancel recording"
                      onClick={() => onCancelRecording?.(clip.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="clip-block__wave">
                  <div className="clip-block__seek clip-block__seek--live">
                    <span className="clip-block__bars clip-block__bars--live" aria-hidden>
                      {bars.map((p, i) => (
                        <span
                          key={i}
                          className="wave-bar is-recording"
                          style={{ height: `${Math.max(10, Math.round(p * 100))}%` }}
                        />
                      ))}
                    </span>
                    <span className="playhead playhead--in-block" style={{ left: `${playheadLeft}px` }} aria-hidden />
                  </div>
                </div>
              </div>
            );
          }

          if (clip.kind === "armed") {
            return (
              <div
                key={clip.id}
                className="clip-block clip-block--armed"
                style={{ width: RECORDING_MIN_W }}
                role="listitem"
              >
                <div className="clip-block__hit clip-block__hit--static">
                  <span className="clip-block__label">New block</span>
                  <div className="clip-block__record-actions">
                    <button
                      type="button"
                      className="primary-btn clip-block__mini-btn"
                      onClick={() => onStartRecording?.(clip.id)}
                    >
                      Record
                    </button>
                    <button
                      type="button"
                      className="ghost-btn clip-block__mini-btn"
                      onClick={() => onCancelRecording?.(clip.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          const isActive = index === active.index;
          const progress =
            clip.durationMs > 0 && isActive
              ? Math.min(1, active.localMs / clip.durationMs)
              : index < active.index
                ? 1
                : 0;

          const clipReplies = timedReplies.filter((r) => r.clipId === clip.id);
          const clipEmojis = emojiReplies.filter((r) => r.clipId === clip.id);
          const inner = width - BLOCK_PAD * 2;
          const lanes = lanesForMarks(
            clipEmojis.map((e) => ({
              id: e.id,
              offsetMs: e.offsetMs,
              durationMs: clip.durationMs,
            })),
            inner,
          );
          const maxLane = clipEmojis.reduce((m, e) => Math.max(m, lanes.get(e.id) ?? 0), 0);
          const emojiLaneH = clipEmojis.length > 0 ? 26 + maxLane * EMOJI_LANE_STEP : 4;
          const startMs = clips.slice(0, index).reduce((sum, c) => {
            return isPlayable(c) ? sum + c.durationMs : sum;
          }, 0);

          const preview = trimPreview?.clipId === clip.id ? trimPreview : null;
          const keepStartMs = preview?.keepStartMs ?? 0;
          const keepEndMs = preview?.keepEndMs ?? clip.durationMs;
          const keepDur = Math.max(1, keepEndMs - keepStartMs);
          const pxPerMs = width / Math.max(1, clip.durationMs);
          const trimming = trimmingClipId === clip.id;
          const displayDuration = preview ? keepDur : clip.durationMs;
          const clipDurationMs = clip.durationMs;

          function commitTrim() {
            if (!onTrimClip || !preview) return;
            if (
              isIdentityKeep({
                keepStartMs: preview.keepStartMs,
                keepEndMs: preview.keepEndMs,
                durationMs: clipDurationMs,
              })
            ) {
              setTrimPreview(null);
              return;
            }
            onTrimClip(clip.id, preview.keepStartMs, preview.keepEndMs);
            setTrimPreview(null);
          }

          return (
            <div
              key={clip.id}
              className={`clip-block${isActive ? " is-active" : ""}${clip.kind === "pending" ? " is-pending" : ""}${trimming ? " is-trimming" : ""}${preview ? " is-trim-preview" : ""}`}
              style={{ width }}
              role="listitem"
              aria-busy={trimming || undefined}
            >
              {preview && (
                <>
                  <span
                    className="clip-block__trim-discard clip-block__trim-discard--start"
                    style={{ width: keepStartMs * pxPerMs }}
                    aria-hidden
                  />
                  <span
                    className="clip-block__trim-discard clip-block__trim-discard--end"
                    style={{ width: (clip.durationMs - keepEndMs) * pxPerMs }}
                    aria-hidden
                  />
                </>
              )}
              {onTrimClip && (
                <ClipTrimHandles
                  clipIndex={index + 1}
                  durationMs={clip.durationMs}
                  keepStartMs={keepStartMs}
                  keepEndMs={keepEndMs}
                  pxPerMs={pxPerMs}
                  disabled={Boolean(trimmingClipId)}
                  onChange={(next) => {
                    if (!trimPreview) onTrimBegin?.();
                    setTrimPreview({ clipId: clip.id, ...next });
                  }}
                  onCommit={commitTrim}
                  onCancel={() => setTrimPreview(null)}
                />
              )}
              {onDeleteClip && (
                <div className="clip-block__actions">
                  <button
                    type="button"
                    className="clip-block__delete"
                    aria-label={`Delete clip ${index + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClip(clip.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              <button
                type="button"
                className="clip-block__label-btn"
                aria-label={`Cue clip ${index + 1} from the start, ${formatDuration(displayDuration)}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectClip(clip.id)}
              >
                {index + 1} · {formatDuration(displayDuration)}
                {clip.kind === "pending" ? " · unsaved" : ""}
                {preview ? " · trim" : ""}
              </button>

              <div
                className="clip-block__emoji-lane"
                style={{ height: emojiLaneH }}
                aria-label={clipEmojis.length > 0 ? `Emoji replies on clip ${index + 1}` : undefined}
              >
                {clipEmojis.map((mark) => {
                  const local = mark.offsetMs;
                  const left =
                    BLOCK_PAD + Math.max(0, Math.min(1, local / clip.durationMs)) * inner;
                  const lane = lanes.get(mark.id) ?? 0;
                  return (
                    <button
                      key={mark.id}
                      type="button"
                      className={`tape-emoji${activeEmojiId === mark.id ? " is-active" : ""}`}
                      style={{
                        left: `${left}px`,
                        top: `${lane * EMOJI_LANE_STEP}px`,
                      }}
                      aria-label={`${mark.emoji} from ${mark.author.displayName} at ${formatDuration(local)}`}
                      aria-pressed={activeEmojiId === mark.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEmojiActivate(mark);
                      }}
                    >
                      <span aria-hidden>{mark.emoji}</span>
                    </button>
                  );
                })}
              </div>

              <div className="clip-block__wave">
                <button
                  type="button"
                  className="clip-block__seek"
                  aria-label={`Seek in clip ${index + 1}`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const local = xToOffsetMs(
                      e.clientX - rect.left,
                      rect.width,
                      clip.durationMs,
                      0,
                    );
                    onSeek(startMs + local);
                  }}
                >
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
                  {isActive && !preview && (
                    <span
                      className="playhead playhead--in-block"
                      style={{
                        left: `${BLOCK_PAD + progress * inner}px`,
                      }}
                      aria-hidden
                    />
                  )}
                </button>

                {clipReplies.map((reply) => {
                  const local = reply.offsetMs ?? 0;
                  const left =
                    BLOCK_PAD + Math.max(0, Math.min(1, local / clip.durationMs)) * inner;
                  return (
                    <button
                      key={reply.id}
                      type="button"
                      className="reply-tick"
                      style={{
                        left: `${left}px`,
                        background: reply.author.color,
                      }}
                      aria-label={`Voice reply from ${reply.author.displayName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTickActivate(reply);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {onAddClip && !isRecording && (
          <div className="clip-block clip-block--add" role="listitem" style={{ width: ADD_TILE_W }}>
            <button
              type="button"
              className="clip-block__add"
              aria-label="Add clip block"
              onClick={onAddClip}
            >
              <span className="clip-block__add-plus" aria-hidden>
                +
              </span>
              <span className="clip-block__add-label">Add</span>
            </button>
          </div>
        )}
      </div>

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
