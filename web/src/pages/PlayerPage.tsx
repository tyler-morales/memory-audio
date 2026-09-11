import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EmojiPicker, EmojiPopup } from "../components/EmojiPicker";
import { JoinSheet } from "../components/JoinSheet";
import { MemoryTitle } from "../components/MemoryTitle";
import { RecordButton } from "../components/RecordButton";
import { ReplyThread } from "../components/ReplyThread";
import { TapeWaveform } from "../components/TapeWaveform";
import { useReplyPlayer, useTapePlayer } from "../hooks/useTapePlayer";
import {
  deleteClip,
  getMemory,
  joinSpace,
  postEmojiReply,
  reorderClips,
  updateMemoryTitle,
  uploadClip,
  uploadReply,
  type Member,
  type MemoryDetail,
  type Reply,
} from "../lib/api";
import {
  applyEditedClip,
  draftFromServer,
  hasOpenSlot,
  isDraftDirty,
  playableDraft,
  type DraftClip,
  type EditableDraftClip,
} from "../lib/draft";
import { blobFromAudioUrl, isIdentityKeep, renderClipEdit } from "../lib/audioEdit";
import { AudioRecorder, RECORD_MAX_MS, type RecordResult } from "../lib/recorder";
import { loadMember, markSeen, saveMember } from "../lib/session";
import { displayMemoryTitle } from "../lib/memoryTitle";
import { emojiNearPlayhead } from "../lib/tapeMarks";
import { absoluteToClipPosition, clipPositionToAbsolute, formatDuration } from "../lib/timeline";

type ReplyMode =
  | null
  | { kind: "timed" }
  | { kind: "note" }
  | { kind: "nested"; parent: Reply };

export function PlayerPage() {
  const { token = "", memoryId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const capture = searchParams.get("capture") === "1";

  const [member, setMember] = useState<Member | null>(() => loadMember(token));
  const [memory, setMemory] = useState<MemoryDetail | null>(null);
  const [draft, setDraft] = useState<DraftClip[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [replyMode, setReplyMode] = useState<ReplyMode>(null);
  const [busy, setBusy] = useState(false);
  const [autoCaptureDone, setAutoCaptureDone] = useState(false);
  const [focusedEmojiId, setFocusedEmojiId] = useState<string | null>(null);
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null);

  const recorderRef = useRef(new AudioRecorder());
  const tickRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const trimLockRef = useRef(false);
  const stopInlineRef = useRef<() => Promise<void>>(async () => undefined);

  const dirty = isDraftDirty(draft, deletedIds);

  const refresh = useCallback(async () => {
    try {
      const data = await getMemory(token, memoryId);
      setMemory(data);
      markSeen(token, data.id, data.updatedAt);
      setError(null);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory");
      return null;
    }
  }, [token, memoryId]);

  useEffect(() => {
    setMember(loadMember(token));
    void (async () => {
      const data = await refresh();
      if (data && !dirty) {
        setDraft(draftFromServer(data.clips));
        setDeletedIds([]);
      }
    })();
    // only on token/memory change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, memoryId, refresh]);

  useEffect(() => {
    if (dirty || trimmingClipId) return;
    const id = window.setInterval(() => {
      void (async () => {
        const data = await refresh();
        if (data && !isDraftDirty(draftRef.current, deletedIds) && !trimmingClipId) {
          setDraft(draftFromServer(data.clips));
        }
      })();
    }, 4000);
    return () => clearInterval(id);
  }, [refresh, dirty, deletedIds, trimmingClipId]);

  useEffect(() => {
    return () => {
      if (tickRef.current != null) clearInterval(tickRef.current);
      recorderRef.current.cancel();
      for (const clip of draftRef.current) {
        if (clip.kind === "pending") URL.revokeObjectURL(clip.audioUrl);
      }
    };
  }, []);

  const playable = useMemo(() => playableDraft(draft), [draft]);
  const player = useTapePlayer(playable);
  const replyPlayer = useReplyPlayer();

  const isCreator = !!member && !!memory && member.id === memory.creator.id;
  const recording = draft.some((c) => c.kind === "recording");
  const openSlot = hasOpenSlot(draft);

  const pausePosition = useMemo(() => {
    return absoluteToClipPosition(playable, player.positionMs);
  }, [playable, player.positionMs]);

  const emojiReplies = memory?.emojiReplies ?? [];
  const passingEmoji = useMemo(
    () => emojiNearPlayhead(emojiReplies, playable, player.positionMs),
    [emojiReplies, playable, player.positionMs],
  );
  const focusedEmoji =
    emojiReplies.find((e) => e.id === focusedEmojiId) ?? (player.isPlaying ? passingEmoji : null);

  async function dropEmoji(emoji: string) {
    if (!member || !memory) return;
    const pos = absoluteToClipPosition(playable, player.positionMs);
    if (!pos) {
      setError("Play or tap the tape first");
      return;
    }
    const saved = draft.find((c) => c.id === pos.clipId);
    if (!saved || saved.kind !== "saved") {
      setError("Save the tape before reacting on a new block");
      return;
    }
    setBusy(true);
    try {
      const created = await postEmojiReply(token, memory.id, member.id, {
        clipId: pos.clipId,
        offsetMs: pos.offsetMs,
        emoji,
      });
      setMemory((prev) =>
        prev
          ? {
              ...prev,
              emojiReplies: [...(prev.emojiReplies ?? []), created],
              emojiCount: (prev.emojiCount ?? 0) + 1,
            }
          : prev,
      );
      setFocusedEmojiId(created.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not drop emoji");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(displayName: string, color: string) {
    try {
      const m = await joinSpace(token, displayName, color);
      saveMember(token, m);
      setMember(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    }
  }

  async function handleRename(nextTitle: string) {
    if (!member || !memory || !isCreator) return;
    try {
      const updated = await updateMemoryTitle(token, memory.id, member.id, nextTitle);
      setMemory((prev) =>
        prev ? { ...prev, title: updated.title, updatedAt: updated.updatedAt } : prev,
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename memory");
    }
  }

  function clearRecordingTick() {
    if (tickRef.current != null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function addArmedBlock() {
    if (!isCreator || openSlot) return;
    player.pause();
    replyPlayer.stop();
    setDraft((prev) => [...prev, { kind: "armed", id: crypto.randomUUID() }]);
  }

  async function startInlineRecord(armedId: string) {
    if (!isCreator || recording) return;
    player.pause();
    replyPlayer.stop();
    setDraft((prev) =>
      prev.map((c) =>
        c.id === armedId && c.kind === "armed"
          ? { kind: "recording", id: armedId, peaks: [], elapsedMs: 0 }
          : c,
      ),
    );
    try {
      await recorderRef.current.start();
      clearRecordingTick();
      tickRef.current = window.setInterval(() => {
        const r = recorderRef.current;
        setDraft((prev) =>
          prev.map((c) =>
            c.kind === "recording" && c.id === armedId
              ? { ...c, peaks: [...r.allPeaks], elapsedMs: r.elapsedMs }
              : c,
          ),
        );
        if (r.elapsedMs >= RECORD_MAX_MS) {
          void stopInlineRef.current();
        }
      }, 100);
    } catch {
      setDraft((prev) => prev.filter((c) => c.id !== armedId));
      setError("Microphone permission is required to record.");
    }
  }

  async function stopInlineRecord() {
    clearRecordingTick();
    if (!recorderRef.current.isRecording) {
      setDraft((prev) => prev.filter((c) => c.kind !== "recording"));
      return;
    }
    try {
      const result = await recorderRef.current.stop();
      const objectUrl = URL.createObjectURL(result.blob);
      setDraft((prev) => {
        const without = prev.filter((c) => c.kind !== "recording");
        return [
          ...without,
          {
            kind: "pending",
            id: crypto.randomUUID(),
            durationMs: result.durationMs,
            peaks: result.peaks,
            blob: result.blob,
            mime: result.mime,
            audioUrl: objectUrl,
          },
        ];
      });
    } catch (e) {
      setDraft((prev) => prev.filter((c) => c.kind !== "recording"));
      setError(e instanceof Error ? e.message : "Recording failed");
    }
  }
  stopInlineRef.current = stopInlineRecord;

  function cancelInlineSlot(clipId: string) {
    clearRecordingTick();
    recorderRef.current.cancel();
    setDraft((prev) => prev.filter((c) => c.id !== clipId));
  }

  function handleDeleteClip(clipId: string) {
    player.pause();
    const target = draft.find((c) => c.id === clipId);
    if (target?.kind === "pending") URL.revokeObjectURL(target.audioUrl);
    if (target?.kind === "recording" || target?.kind === "armed") {
      clearRecordingTick();
      recorderRef.current.cancel();
    }
    if (target?.kind === "saved") {
      setDeletedIds((ids) => (ids.includes(clipId) ? ids : [...ids, clipId]));
    }
    setDraft((prev) => prev.filter((c) => c.id !== clipId));
  }

  async function handleTrimClip(clipId: string, keepStartMs: number, keepEndMs: number) {
    if (trimLockRef.current) return;
    const clip = draftRef.current.find(
      (c): c is EditableDraftClip =>
        c.id === clipId && (c.kind === "saved" || c.kind === "pending"),
    );
    if (!clip) return;
    if (isIdentityKeep({ keepStartMs, keepEndMs, durationMs: clip.durationMs })) return;

    trimLockRef.current = true;
    player.pause();
    replyPlayer.stop();
    setBusy(true);
    setTrimmingClipId(clipId);
    setError(null);
    try {
      const source = clip.kind === "pending" ? clip.blob : await blobFromAudioUrl(clip.audioUrl);
      const result = await renderClipEdit(source, clip.durationMs, clip.peaks, {
        keepStartMs,
        keepEndMs,
        cut: null,
      });
      const applied = applyEditedClip(draftRef.current, clipId, {
        id: crypto.randomUUID(),
        durationMs: result.durationMs,
        peaks: result.peaks,
        blob: result.blob,
        mime: result.mime,
        audioUrl: URL.createObjectURL(result.blob),
      });
      if (applied.revokedUrl) URL.revokeObjectURL(applied.revokedUrl);
      if (applied.deletedSavedId) {
        setDeletedIds((ids) =>
          ids.includes(applied.deletedSavedId!) ? ids : [...ids, applied.deletedSavedId!],
        );
      }
      setDraft(applied.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not trim this clip");
    } finally {
      trimLockRef.current = false;
      setBusy(false);
      setTrimmingClipId(null);
    }
  }

  async function handleSave() {
    if (!member || !memory || !isCreator) return;
    if (recording || openSlot) {
      setError("Finish or remove the open block before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const id of deletedIds) {
        await deleteClip(token, memory.id, member.id, id);
      }
      setDeletedIds([]);
      const pending = draft.filter((c): c is Extract<DraftClip, { kind: "pending" }> => c.kind === "pending");
      const uploadedIds: string[] = [];
      for (const clip of pending) {
        const created = await uploadClip(
          token,
          memory.id,
          member.id,
          clip.blob,
          clip.durationMs,
          clip.peaks,
          clip.mime,
        );
        uploadedIds.push(created.id);
      }
      if (pending.length > 0) {
        let pendingIdx = 0;
        const order = draft
          .filter((c): c is EditableDraftClip => c.kind === "saved" || c.kind === "pending")
          .map((c) => (c.kind === "pending" ? uploadedIds[pendingIdx++]! : c.id));
        if (order.length > 0) {
          await reorderClips(token, memory.id, member.id, order);
        }
      }
      const data = await refresh();
      if (data) {
        for (const clip of pending) URL.revokeObjectURL(clip.audioUrl);
        setDraft(draftFromServer(data.clips));
        setDeletedIds([]);
      }
      if (capture) {
        searchParams.delete("capture");
        setSearchParams(searchParams, { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReplyComplete(result: RecordResult) {
    if (!member || !memory || !replyMode) return;
    setBusy(true);
    try {
      if (replyMode.kind === "timed") {
        const pos = absoluteToClipPosition(playable, player.positionMs);
        if (!pos) throw new Error("Nothing to reply to yet");
        // Only allow timed replies on saved server clips
        const saved = draft.find((c) => c.id === pos.clipId);
        if (!saved || saved.kind !== "saved") {
          throw new Error("Save the tape before replying on a new block");
        }
        await uploadReply(token, memory.id, member.id, {
          audio: result.blob,
          durationMs: result.durationMs,
          peaks: result.peaks,
          mime: result.mime,
          clipId: pos.clipId,
          offsetMs: pos.offsetMs,
        });
      } else if (replyMode.kind === "note") {
        await uploadReply(token, memory.id, member.id, {
          audio: result.blob,
          durationMs: result.durationMs,
          peaks: result.peaks,
          mime: result.mime,
        });
      } else if (replyMode.kind === "nested") {
        await uploadReply(token, memory.id, member.id, {
          audio: result.blob,
          durationMs: result.durationMs,
          peaks: result.peaks,
          mime: result.mime,
          parentReplyId: replyMode.parent.id,
        });
      }
      setReplyMode(null);
      const data = await refresh();
      if (data && !dirty) setDraft(draftFromServer(data.clips));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  // New memory: open an armed block ready to record (does not auto-start mic)
  useEffect(() => {
    if (!capture || autoCaptureDone || !isCreator || !memory) return;
    if (draft.length > 0 || openSlot) {
      setAutoCaptureDone(true);
      return;
    }
    setAutoCaptureDone(true);
    setDraft([{ kind: "armed", id: crypto.randomUUID() }]);
    if (capture) {
      searchParams.delete("capture");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture, autoCaptureDone, isCreator, memory, draft.length, openSlot]);

  return (
    <div className="app-shell player-page">
      <header className="top-bar">
        <Link className="icon-btn" to={`/s/${token}`} aria-label="Back to memories">
          ←
        </Link>
        {memory ? (
          <MemoryTitle
            title={memory.title ?? ""}
            fallback={displayMemoryTitle("", memory.creator.displayName)}
            editable={isCreator}
            onCommit={handleRename}
          />
        ) : (
          <h1>Memory</h1>
        )}
        {isCreator && dirty && (
          <button
            type="button"
            className="primary-btn"
            disabled={busy || recording}
            onClick={() => void handleSave()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        )}
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
              clips={draft}
              positionMs={player.positionMs}
              replies={memory.replies}
              emojiReplies={emojiReplies}
              activeEmojiId={focusedEmoji?.id ?? null}
              onSeek={(ms) => {
                replyPlayer.stop();
                void player.seek(ms);
              }}
              onSelectClip={(clipId) => {
                replyPlayer.stop();
                void player.selectClip(clipId);
              }}
              onTickActivate={(reply) => {
                player.pause();
                void replyPlayer.play(reply.id, reply.audioUrl);
              }}
              onEmojiActivate={(mark) => {
                replyPlayer.stop();
                const abs = clipPositionToAbsolute(playable, mark.clipId, mark.offsetMs);
                if (abs != null) void player.seek(abs);
                setFocusedEmojiId(mark.id);
              }}
              onAddClip={
                isCreator && !openSlot && replyMode === null
                  ? () => addArmedBlock()
                  : undefined
              }
              onDeleteClip={isCreator && !recording ? handleDeleteClip : undefined}
              onTrimClip={isCreator && !recording ? handleTrimClip : undefined}
              onTrimBegin={() => {
                player.pause();
                replyPlayer.stop();
              }}
              trimmingClipId={trimmingClipId}
              onStartRecording={(id) => void startInlineRecord(id)}
              onStopRecording={() => void stopInlineRecord()}
              onCancelRecording={cancelInlineSlot}
            />

            {focusedEmoji && (
              <EmojiPopup
                emoji={focusedEmoji.emoji}
                name={focusedEmoji.author.displayName}
                timeLabel={formatDuration(
                  clipPositionToAbsolute(playable, focusedEmoji.clipId, focusedEmoji.offsetMs) ?? 0,
                )}
              />
            )}

            <div className="controls">
              <button
                type="button"
                className="primary-btn"
                onClick={() => void player.toggle()}
                disabled={playable.length === 0 || recording}
                aria-label={player.isPlaying ? "Pause" : "Play"}
              >
                {player.isPlaying ? "Pause" : "Play"}
              </button>
              <span className="time-label">
                {formatDuration(player.positionMs)} /{" "}
                {formatDuration(playable.reduce((s, c) => s + c.durationMs, 0))}
              </span>
              {dirty && (
                <span className="time-label" style={{ color: "var(--focus)" }}>
                  Unsaved changes
                </span>
              )}
            </div>

            {member && playable.length > 0 && replyMode === null && !recording && (
              <EmojiPicker
                timeLabel={formatDuration(pausePosition?.absoluteMs ?? player.positionMs)}
                busy={busy}
                onPick={(emoji) => void dropEmoji(emoji)}
              />
            )}

            {!player.isPlaying &&
              playable.length > 0 &&
              member &&
              replyMode === null &&
              !recording &&
              !dirty && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    player.pause();
                    setReplyMode({ kind: "timed" });
                  }}
                >
                  Reply here
                  {pausePosition ? ` · ${formatDuration(pausePosition.absoluteMs)}` : ""}
                </button>
              )}

            {member && replyMode === null && !recording && (
              <div className="controls">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setReplyMode({ kind: "note" })}
                >
                  Add note
                </button>
              </div>
            )}

            {replyMode && member && (
              <RecordButton
                label={
                  replyMode.kind === "timed"
                    ? "Record a reply at this moment"
                    : replyMode.kind === "note"
                      ? "Record a note under the tape"
                      : `Reply to ${replyMode.parent.author.displayName}`
                }
                onComplete={handleReplyComplete}
                onCancel={() => setReplyMode(null)}
              />
            )}
          </>
        )}
      </div>

      {memory && (
        <ReplyThread
          replies={memory.replies}
          clips={playable}
          playingId={replyPlayer.playingId}
          onPlay={(r) => {
            player.pause();
            void replyPlayer.play(r.id, r.audioUrl);
          }}
          onNestReply={(parent) => {
            player.pause();
            replyPlayer.stop();
            setReplyMode({ kind: "nested", parent });
          }}
          member={member}
        />
      )}

      <JoinSheet open={!member && !!memory} onJoin={handleJoin} />
    </div>
  );
}
