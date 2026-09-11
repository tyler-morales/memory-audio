import { Link } from "react-router-dom";
import type { MemorySummary } from "../lib/api";
import { displayMemoryTitle } from "../lib/memoryTitle";
import { formatDuration, formatRelative } from "../lib/timeline";
import { isUpdated } from "../lib/session";
import { WaveformBars } from "./WaveformBars";

type Props = {
  token: string;
  memory: MemorySummary;
};

export function MemoryCard({ token, memory }: Props) {
  const updated = isUpdated(token, memory.id, memory.updatedAt);
  const title = displayMemoryTitle(memory.title ?? "", memory.creator.displayName);

  return (
    <Link
      className="memory-card"
      to={`/s/${token}/m/${memory.id}`}
      aria-label={`${title} by ${memory.creator.displayName}, ${formatDuration(memory.totalDurationMs)}`}
    >
      <div
        className="memory-card__accent"
        style={{ background: memory.creator.color }}
        aria-hidden
      />
      <div className="memory-card__body">
        <div className="memory-card__meta">
          <span className="memory-card__title">{title}</span>
          <span>{formatRelative(memory.updatedAt)}</span>
        </div>
        <span className="memory-card__name">{memory.creator.displayName}</span>
        <WaveformBars peaks={memory.peaks} color={memory.creator.color} />
        <div className="memory-card__meta">
          <span>
            {formatDuration(memory.totalDurationMs)}
            {memory.clipCount > 0 ? ` · ${memory.clipCount} clip${memory.clipCount === 1 ? "" : "s"}` : " · empty"}
          </span>
          <span>
            {memory.replyCount > 0 && `${memory.replyCount} repl${memory.replyCount === 1 ? "y" : "ies"}`}
            {memory.replyCount > 0 && memory.noteCount > 0 && " · "}
            {memory.noteCount > 0 && `${memory.noteCount} note${memory.noteCount === 1 ? "" : "s"}`}
            {(memory.replyCount > 0 || memory.noteCount > 0) && (memory.emojiCount ?? 0) > 0 && " · "}
            {(memory.emojiCount ?? 0) > 0 &&
              `${memory.emojiCount} emoji`}
            {updated && (
              <>
                {(memory.replyCount > 0 || memory.noteCount > 0 || (memory.emojiCount ?? 0) > 0) && " · "}
                <span className="badge">Updated</span>
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
