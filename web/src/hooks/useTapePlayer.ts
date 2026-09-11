import { useEffect, useRef, useState } from "react";
import type { Clip } from "../lib/api";
import { absoluteToClipPosition, totalDuration } from "../lib/timeline";

type Status = "idle" | "playing" | "paused" | "ended";

/**
 * Sequential playback across spine clips. Never auto-starts.
 * When the clip list changes (add/delete), keep the current clip if it
 * still exists; otherwise cue the latest remaining clip — never jump to 0.
 */
export function useTapePlayer(clips: Clip[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [clipIndex, setClipIndex] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [positionMs, setPositionMs] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const clipIndexRef = useRef(clipIndex);
  clipIndexRef.current = clipIndex;
  const activeClipIdRef = useRef<string | null>(clips[0]?.id ?? null);
  const positionMsRef = useRef(positionMs);
  positionMsRef.current = positionMs;

  const clipsKey = clips.map((c) => `${c.id}:${c.durationMs}:${c.audioUrl}`).join(",");

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => {
      const prior = clipsRef.current
        .slice(0, clipIndexRef.current)
        .reduce((s, c) => s + c.durationMs, 0);
      const next = prior + audio.currentTime * 1000;
      positionMsRef.current = next;
      setPositionMs(next);
    };

    const onEnded = () => {
      const next = clipIndexRef.current + 1;
      if (next < clipsRef.current.length) {
        setClipIndex(next);
        void playIndex(next);
      } else {
        setStatus("ended");
        const end = totalDuration(clipsRef.current);
        positionMsRef.current = end;
        setPositionMs(end);
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const list = clipsRef.current;
    const audio = audioRef.current;
    if (statusRef.current === "playing") {
      audio?.pause();
      setStatus("paused");
    }

    if (list.length === 0) {
      activeClipIdRef.current = null;
      setClipIndex(0);
      positionMsRef.current = 0;
      setPositionMs(0);
      setStatus("idle");
      return;
    }

    const prevId = activeClipIdRef.current;
    let index = prevId ? list.findIndex((c) => c.id === prevId) : -1;

    if (index < 0) {
      const isFirstLoad = prevId === null;
      index = isFirstLoad ? 0 : list.length - 1;
      const startMs = list.slice(0, index).reduce((s, c) => s + c.durationMs, 0);
      activeClipIdRef.current = list[index]!.id;
      setClipIndex(index);
      positionMsRef.current = startMs;
      setPositionMs(startMs);
      setStatus(isFirstLoad ? "idle" : "paused");
      if (audio) {
        audio.src = list[index]!.audioUrl;
        audio.currentTime = 0;
      }
      return;
    }

    // Same clip still present — keep absolute position clamped into that clip
    const startMs = list.slice(0, index).reduce((s, c) => s + c.durationMs, 0);
    const endMs = startMs + list[index]!.durationMs;
    const clamped = Math.min(Math.max(positionMsRef.current, startMs), endMs);
    activeClipIdRef.current = list[index]!.id;
    setClipIndex(index);
    positionMsRef.current = clamped;
    setPositionMs(clamped);
    if (audio) {
      if (audio.src !== new URL(list[index]!.audioUrl, window.location.origin).href) {
        audio.src = list[index]!.audioUrl;
      }
      audio.currentTime = (clamped - startMs) / 1000;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipsKey]);

  async function playIndex(index: number, offsetMs = 0) {
    const audio = audioRef.current;
    const clip = clipsRef.current[index];
    if (!audio || !clip) return;
    if (audio.src !== new URL(clip.audioUrl, window.location.origin).href) {
      audio.src = clip.audioUrl;
    }
    audio.currentTime = offsetMs / 1000;
    setClipIndex(index);
    activeClipIdRef.current = clip.id;
    try {
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("paused");
    }
  }

  async function play() {
    if (status === "ended" || positionMs >= totalDuration(clipsRef.current)) {
      setPositionMs(0);
      positionMsRef.current = 0;
      await playIndex(0, 0);
      return;
    }
    const mapped = absoluteToClipPosition(clipsRef.current, positionMs);
    if (!mapped) return;
    const index = clipsRef.current.findIndex((c) => c.id === mapped.clipId);
    if (index < 0) return;
    await playIndex(index, mapped.offsetMs);
  }

  function pause() {
    audioRef.current?.pause();
    setStatus("paused");
  }

  async function toggle() {
    if (status === "playing") pause();
    else await play();
  }

  async function seek(ms: number) {
    const mapped = absoluteToClipPosition(clipsRef.current, ms);
    if (!mapped) return;
    positionMsRef.current = mapped.absoluteMs;
    setPositionMs(mapped.absoluteMs);
    const index = clipsRef.current.findIndex((c) => c.id === mapped.clipId);
    if (index < 0) return;
    activeClipIdRef.current = mapped.clipId;
    if (statusRef.current === "playing") {
      await playIndex(index, mapped.offsetMs);
    } else {
      setClipIndex(index);
      const audio = audioRef.current;
      const clip = clipsRef.current[index];
      if (audio && clip) {
        if (audio.src !== new URL(clip.audioUrl, window.location.origin).href) {
          audio.src = clip.audioUrl;
        }
        audio.currentTime = mapped.offsetMs / 1000;
      }
      setStatus(
        statusRef.current === "ended" || statusRef.current === "idle"
          ? "paused"
          : statusRef.current,
      );
    }
  }

  /** Move playhead to the start of a clip block without starting playback. */
  async function selectClip(clipId: string) {
    const index = clipsRef.current.findIndex((c) => c.id === clipId);
    if (index < 0) return;
    if (statusRef.current === "playing") {
      audioRef.current?.pause();
    }
    const startMs = clipsRef.current
      .slice(0, index)
      .reduce((s, c) => s + c.durationMs, 0);
    positionMsRef.current = startMs;
    setPositionMs(startMs);
    setClipIndex(index);
    activeClipIdRef.current = clipId;
    const audio = audioRef.current;
    const clip = clipsRef.current[index];
    if (audio && clip) {
      if (audio.src !== new URL(clip.audioUrl, window.location.origin).href) {
        audio.src = clip.audioUrl;
      }
      audio.currentTime = 0;
    }
    setStatus("paused");
  }

  return {
    status,
    positionMs,
    play,
    pause,
    toggle,
    seek,
    selectClip,
    isPlaying: status === "playing",
  };
}

export function useReplyPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onEnded = () => setPlayingId(null);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  async function play(id: string, url: string) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = url;
    try {
      await audio.play();
      setPlayingId(id);
    } catch {
      setPlayingId(null);
    }
  }

  function stop() {
    audioRef.current?.pause();
    setPlayingId(null);
  }

  return { playingId, play, stop };
}
