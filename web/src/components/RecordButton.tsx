import { useEffect, useRef, useState } from "react";
import { AudioRecorder, RECORD_MAX_MS, type RecordResult } from "../lib/recorder";
import { formatDuration } from "../lib/timeline";
import { WaveformBars } from "./WaveformBars";

type Props = {
  label: string;
  onComplete: (result: RecordResult) => Promise<void> | void;
  onCancel?: () => void;
};

export function RecordButton({ label, onComplete, onCancel }: Props) {
  const recorderRef = useRef(new AudioRecorder());
  const stoppingRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [livePeaks, setLivePeaks] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      const r = recorderRef.current;
      setElapsed(r.elapsedMs);
      setLivePeaks([...r.livePeaks]);
      if (r.elapsedMs >= RECORD_MAX_MS) {
        void stop();
      }
    }, 100);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    setError(null);
    stoppingRef.current = false;
    try {
      await recorderRef.current.start();
      setRecording(true);
      setElapsed(0);
    } catch {
      setError("Microphone permission is required to record.");
    }
  }

  async function stop() {
    if (stoppingRef.current) return;
    if (!recorderRef.current.isRecording) return;
    stoppingRef.current = true;
    setRecording(false);
    setBusy(true);
    try {
      const result = await recorderRef.current.stop();
      await onComplete(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recording failed");
    } finally {
      stoppingRef.current = false;
      setBusy(false);
      setLivePeaks([]);
      setElapsed(0);
    }
  }

  function cancel() {
    stoppingRef.current = true;
    recorderRef.current.cancel();
    stoppingRef.current = false;
    setRecording(false);
    setLivePeaks([]);
    setElapsed(0);
    onCancel?.();
  }

  return (
    <div className="record-panel">
      <strong>{label}</strong>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {recording && (
        <>
          <WaveformBars peaks={livePeaks.length ? livePeaks : [0.2]} className="live-wave" height={40} />
          <span className="time-label" aria-live="polite">
            Recording {formatDuration(elapsed)} / {formatDuration(RECORD_MAX_MS)}
          </span>
        </>
      )}
      <div className="controls">
        {!recording ? (
          <button type="button" className="primary-btn" onClick={() => void start()} disabled={busy}>
            Start recording
          </button>
        ) : (
          <button type="button" className="danger-btn" onClick={() => void stop()} disabled={busy}>
            Stop & save
          </button>
        )}
        {(recording || onCancel) && (
          <button type="button" className="ghost-btn" onClick={cancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
