import { useMemo, useState } from "react";
import type { Member, Reply } from "../lib/api";
import { clipPositionToAbsolute, formatDuration, formatRelative } from "../lib/timeline";
import type { Clip } from "../lib/api";
import { WaveformBars } from "./WaveformBars";

type Props = {
  replies: Reply[];
  clips: Clip[];
  playingId: string | null;
  onPlay: (reply: Reply) => void;
  onNestReply: (parent: Reply) => void;
  member: Member | null;
};

export function ReplyThread({ replies, clips, playingId, onPlay, onNestReply, member }: Props) {
  const notes = useMemo(
    () => replies.filter((r) => !r.parentReplyId && !r.clipId),
    [replies],
  );
  const timed = useMemo(
    () =>
      replies
        .filter((r) => !r.parentReplyId && r.clipId != null)
        .slice()
        .sort((a, b) => {
          const aa = clipPositionToAbsolute(clips, a.clipId!, a.offsetMs ?? 0) ?? 0;
          const bb = clipPositionToAbsolute(clips, b.clipId!, b.offsetMs ?? 0) ?? 0;
          return aa - bb;
        }),
    [replies, clips],
  );
  const childrenOf = useMemo(() => {
    const map = new Map<string, Reply[]>();
    for (const r of replies) {
      if (!r.parentReplyId) continue;
      const list = map.get(r.parentReplyId) ?? [];
      list.push(r);
      map.set(r.parentReplyId, list);
    }
    return map;
  }, [replies]);

  return (
    <div className="thread-list">
      {timed.length > 0 && (
        <>
          <h3 className="thread-section-title">On the tape</h3>
          {timed.map((reply) => (
            <ReplyBlock
              key={reply.id}
              reply={reply}
              children={childrenOf.get(reply.id) ?? []}
              playingId={playingId}
              onPlay={onPlay}
              onNestReply={onNestReply}
              canNest={!!member}
              timeLabel={formatTapeTime(clips, reply)}
            />
          ))}
        </>
      )}
      {notes.length > 0 && (
        <>
          <h3 className="thread-section-title">Notes</h3>
          {notes.map((reply) => (
            <ReplyBlock
              key={reply.id}
              reply={reply}
              children={childrenOf.get(reply.id) ?? []}
              playingId={playingId}
              onPlay={onPlay}
              onNestReply={onNestReply}
              canNest={!!member}
            />
          ))}
        </>
      )}
      {timed.length === 0 && notes.length === 0 && (
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          No replies yet. Pause the tape to reply at a moment, or leave a note below.
        </p>
      )}
    </div>
  );
}

function formatTapeTime(clips: Clip[], reply: Reply): string | undefined {
  if (!reply.clipId || reply.offsetMs == null) return undefined;
  const abs = clipPositionToAbsolute(clips, reply.clipId, reply.offsetMs);
  if (abs == null) return undefined;
  return formatDuration(abs);
}

function ReplyBlock({
  reply,
  children,
  playingId,
  onPlay,
  onNestReply,
  canNest,
  timeLabel,
}: {
  reply: Reply;
  children: Reply[];
  playingId: string | null;
  onPlay: (r: Reply) => void;
  onNestReply: (r: Reply) => void;
  canNest: boolean;
  timeLabel?: string;
}) {
  const [showKids, setShowKids] = useState(true);

  return (
    <div>
      <article className="reply-card" aria-label={`Reply by ${reply.author.displayName}`}>
        <div className="reply-card__head">
          <span style={{ color: reply.author.color, fontWeight: 600 }}>
            {reply.author.displayName}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </span>
          <span style={{ color: "var(--text-muted)" }}>{formatRelative(reply.createdAt)}</span>
        </div>
        <WaveformBars peaks={reply.peaks} color={reply.author.color} height={28} />
        <div className="controls">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onPlay(reply)}
            aria-pressed={playingId === reply.id}
          >
            {playingId === reply.id ? "Pause" : "Play"} · {formatDuration(reply.durationMs)}
          </button>
          {canNest && (
            <button type="button" className="ghost-btn" onClick={() => onNestReply(reply)}>
              Reply
            </button>
          )}
          {children.length > 0 && (
            <button
              type="button"
              className="ghost-btn"
              aria-expanded={showKids}
              onClick={() => setShowKids((v) => !v)}
            >
              {children.length} nested
            </button>
          )}
        </div>
      </article>
      {showKids &&
        children.map((child) => (
          <article
            key={child.id}
            className="reply-card nested"
            aria-label={`Nested reply by ${child.author.displayName}`}
          >
            <div className="reply-card__head">
              <span style={{ color: child.author.color, fontWeight: 600 }}>
                {child.author.displayName}
              </span>
              <span style={{ color: "var(--text-muted)" }}>{formatRelative(child.createdAt)}</span>
            </div>
            <WaveformBars peaks={child.peaks} color={child.author.color} height={24} />
            <div className="controls">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => onPlay(child)}
                aria-pressed={playingId === child.id}
              >
                {playingId === child.id ? "Pause" : "Play"} · {formatDuration(child.durationMs)}
              </button>
            </div>
          </article>
        ))}
    </div>
  );
}
