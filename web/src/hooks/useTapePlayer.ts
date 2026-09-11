import { useEffect, useRef, useState } from "react";
import type { Clip } from "../lib/api";
import { absoluteToClipPosition, totalDuration } from "../lib/timeline";

type Status = "idle" | "playing" | "paused" | "ended";

/**
 * Sequential playback across spine clips. Never auto-starts.
 */
export function useTapePlayer(clips: Clip[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [clipIndex, setClipIndex] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [positionMs, setPositionMs] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const clipsKey = clips.map((c) => c.id).join(",");

  useEffect(() => {
    setClipIndex(0);
    setPositionMs(0);
    setStatus("idle");

    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => {
      const prior = clipsRef.current
        .slice(0, clipIndexRef.current)
        .reduce((s, c) => s + c.durationMs, 0);
      setPositionMs(prior + audio.currentTime * 1000);
    };

    const onEnded = () => {
      const next = clipIndexRef.current + 1;
      if (next < clipsRef.current.length) {
        setClipIndex(next);
        void playIndex(next);
      } else {
        setStatus("ended");
        setPositionMs(totalDuration(clipsRef.current));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset player when clip set changes
  }, [clipsKey]);

  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const clipIndexRef = useRef(clipIndex);
  clipIndexRef.current = clipIndex;

  async function playIndex(index: number, offsetMs = 0) {
    const audio = audioRef.current;
    const clip = clipsRef.current[index];
    if (!audio || !clip) return;
    if (audio.src !== new URL(clip.audioUrl, window.location.origin).href) {
      audio.src = clip.audioUrl;
    }
    audio.currentTime = offsetMs / 1000;
    setClipIndex(index);
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
    setPositionMs(mapped.absoluteMs);
    const index = clipsRef.current.findIndex((c) => c.id === mapped.clipId);
    if (index < 0) return;
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
      setStatus(statusRef.current === "ended" ? "paused" : statusRef.current === "idle" ? "paused" : statusRef.current);
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
    setPositionMs(startMs);
    setClipIndex(index);
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
