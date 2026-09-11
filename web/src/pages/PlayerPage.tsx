import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { JoinSheet } from "../components/JoinSheet";
import { RecordButton } from "../components/RecordButton";
import { ReplyThread } from "../components/ReplyThread";
import { TapeWaveform } from "../components/TapeWaveform";
import { useReplyPlayer, useTapePlayer } from "../hooks/useTapePlayer";
import {
  getMemory,
  joinSpace,
  reorderClips,
  uploadClip,
  uploadReply,
  type Member,
  type MemoryDetail,
  type Reply,
} from "../lib/api";
import type { RecordResult } from "../lib/recorder";
import { loadMember, markSeen, saveMember } from "../lib/session";
import { absoluteToClipPosition, formatDuration } from "../lib/timeline";

type RecordMode =
  | null
  | { kind: "clip" }
  | { kind: "timed" }
  | { kind: "note" }
  | { kind: "nested"; parent: Reply };

export function PlayerPage() {
  const { token = "", memoryId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const capture = searchParams.get("capture") === "1";

  const [member, setMember] = useState<Member | null>(() => loadMember(token));
  const [memory, setMemory] = useState<MemoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordMode, setRecordMode] = useState<RecordMode>(capture ? { kind: "clip" } : null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getMemory(token, memoryId);
      setMemory(data);
      markSeen(token, data.id, data.updatedAt);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory");
    }
  }, [token, memoryId]);

  useEffect(() => {
    setMember(loadMember(token));
    void refresh();
  }, [token, refresh]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const clips = memory?.clips ?? [];
  const player = useTapePlayer(clips);
  const replyPlayer = useReplyPlayer();

  const isCreator = !!member && !!memory && member.id === memory.creator.id;

  const pausePosition = useMemo(() => {
    return absoluteToClipPosition(clips, player.positionMs);
  }, [clips, player.positionMs]);

  async function handleJoin(displayName: string, color: string) {
    try {
      const m = await joinSpace(token, displayName, color);
      saveMember(token, m);
      setMember(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    }
  }

  async function handleRecordComplete(result: RecordResult) {
    if (!member || !memory || !recordMode) return;
    setBusy(true);
    try {
      if (recordMode.kind === "clip") {
        await uploadClip(
          token,
          memory.id,
          member.id,
          result.blob,
          result.durationMs,
          result.peaks,
          result.mime,
        );
        if (capture) {
          searchParams.delete("capture");
          setSearchParams(searchParams, { replace: true });
        }
        // Stay in clip mode so the next take appends as a new block
        setRecordMode({ kind: "clip" });
        await refresh();
        return;
      } else if (recordMode.kind === "timed") {
        const pos = absoluteToClipPosition(clips, player.positionMs);
        if (!pos) throw new Error("Nothing to reply to yet");
        await uploadReply(token, memory.id, member.id, {
          audio: result.blob,
          durationMs: result.durationMs,
          peaks: result.peaks,
          mime: result.mime,
          clipId: pos.clipId,
          offsetMs: pos.offsetMs,
        });
      } else if (recordMode.kind === "note") {
        await uploadReply(token, memory.id, member.id, {
          audio: result.blob,
          durationMs: result.durationMs,
          peaks: result.peaks,
          mime: result.mime,
        });
      } else if (recordMode.kind === "nested") {
        await uploadReply(token, memory.id, member.id, {
          audio: result.blob,
          durationMs: result.durationMs,
          peaks: result.peaks,
          mime: result.mime,
          parentReplyId: recordMode.parent.id,
        });
      }
      setRecordMode(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function moveClip(clipId: string, dir: -1 | 1) {
    if (!member || !memory || !isCreator) return;
    const ids = memory.clips.map((c) => c.id);
    const idx = ids.indexOf(clipId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ids.length) return;
    const next = ids.slice();
    const tmp = next[idx]!;
    next[idx] = next[swap]!;
    next[swap] = tmp;
    setBusy(true);
    try {
      await reorderClips(token, memory.id, member.id, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reorder failed");
    } finally {
      setBusy(false);
    }
  }

  function startTimedReply() {
    player.pause();
    setRecordMode({ kind: "timed" });
  }

  return (
    <div className="app-shell player-page">
      <header className="top-bar">
        <Link className="icon-btn" to={`/s/${token}`} aria-label="Back to memories">
          ←
        </Link>
        <h1>{memory ? `${memory.creator.displayName}'s memory` : "Memory"}</h1>
      </header>

      <div className="player-main">
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {!memory && !error && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

        {memory && (
          <>
            <TapeWaveform
              clips={clips}
              positionMs={player.positionMs}
              replies={memory.replies}
              onSeek={(ms) => void player.seek(ms)}
              onPlayClip={(clipId) => {
                replyPlayer.stop();
                void player.playFromClip(clipId);
              }}
              onTickActivate={(reply) => {
                player.pause();
                void replyPlayer.play(reply.id, reply.audioUrl);
              }}
            />

            <div className="controls">
              <button
                type="button"
                className="primary-btn"
                onClick={() => void player.toggle()}
                disabled={clips.length === 0}
                aria-label={player.isPlaying ? "Pause" : "Play"}
              >
                {player.isPlaying ? "Pause" : "Play"}
              </button>
              <span className="time-label">
                {formatDuration(player.positionMs)} / {formatDuration(memory.totalDurationMs)}
              </span>
            </div>

            {!player.isPlaying && clips.length > 0 && member && recordMode === null && (
              <button type="button" className="ghost-btn" onClick={startTimedReply}>
                Reply here
                {pausePosition
                  ? ` · ${formatDuration(pausePosition.absoluteMs)}`
                  : ""}
              </button>
            )}

            {member && recordMode === null && (
              <div className="controls">
                <button type="button" className="ghost-btn" onClick={() => setRecordMode({ kind: "note" })}>
                  Add note
                </button>
                {isCreator && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setRecordMode({ kind: "clip" })}
                  >
                    Add clip block
                  </button>
                )}
              </div>
            )}

            {isCreator && clips.length > 1 && (
              <div className="clip-list" aria-label="Reorder clips">
                {clips.map((clip, i) => (
                  <div key={clip.id} className="clip-row">
                    <span style={{ flex: 1 }}>
                      Clip {i + 1} · {formatDuration(clip.durationMs)}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move clip ${i + 1} up`}
                      disabled={i === 0 || busy}
                      onClick={() => void moveClip(clip.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move clip ${i + 1} down`}
                      disabled={i === clips.length - 1 || busy}
                      onClick={() => void moveClip(clip.id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            )}

            {recordMode && member && (
              <RecordButton
                label={
                  recordMode.kind === "clip"
                    ? "Record a new clip block (appends to the tape)"
                    : recordMode.kind === "timed"
                      ? "Record a reply at this moment"
                      : recordMode.kind === "note"
                        ? "Record a note under the tape"
                        : `Reply to ${recordMode.parent.author.displayName}`
                }
                onComplete={handleRecordComplete}
                onCancel={() => setRecordMode(null)}
              />
            )}
          </>
        )}
      </div>

      {memory && (
        <ReplyThread
          replies={memory.replies}
          clips={clips}
          playingId={replyPlayer.playingId}
          onPlay={(r) => {
            player.pause();
            void replyPlayer.play(r.id, r.audioUrl);
          }}
          onNestReply={(parent) => {
            player.pause();
            replyPlayer.stop();
            setRecordMode({ kind: "nested", parent });
          }}
          member={member}
        />
      )}

      <JoinSheet open={!member && !!memory} onJoin={handleJoin} />
    </div>
  );
}
