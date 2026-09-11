/**
 * MediaRecorder mime negotiation for iOS Safari (mp4/aac) and Chrome (webm/opus).
 */
export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

export function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "m4a";
}

export type RecordResult = {
  blob: Blob;
  mime: string;
  durationMs: number;
  peaks: number[];
};

const MAX_MS = 90_000;

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private mime = "";
  private analyser: AnalyserNode | null = null;
  private audioCtx: AudioContext | null = null;
  private peakSamples: number[] = [];
  private peakTimer: number | null = null;

  get isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const mime = pickRecorderMime();
    this.mime = mime ?? "";
    this.chunks = [];
    this.peakSamples = [];

    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    this.recorder = mime
      ? new MediaRecorder(this.stream, { mimeType: mime })
      : new MediaRecorder(this.stream);

    this.mime = this.recorder.mimeType || mime || "audio/mp4";

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.startedAt = performance.now();
    this.recorder.start(250);
    this.peakTimer = window.setInterval(() => this.samplePeak(), 50);
  }

  private samplePeak(): void {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let max = 0;
    for (const v of data) {
      const amp = Math.abs(v - 128) / 128;
      if (amp > max) max = amp;
    }
    this.peakSamples.push(Math.min(1, max * 1.8));
  }

  async stop(): Promise<RecordResult> {
    if (!this.recorder) {
      throw new Error("Not recording");
    }

    const recorder = this.recorder;
    const durationMs = Math.min(MAX_MS, Math.round(performance.now() - this.startedAt));

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: this.mime }));
      };
      recorder.onerror = () => reject(new Error("Recording failed"));
      if (recorder.state !== "inactive") recorder.stop();
    });

    this.cleanup();

    const peaks = downsamplePeaks(this.peakSamples, 64);
    return { blob, mime: this.mime, durationMs: Math.max(1, durationMs), peaks };
  }

  cancel(): void {
    try {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.peakTimer != null) {
      clearInterval(this.peakTimer);
      this.peakTimer = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.analyser = null;
    this.recorder = null;
  }

  get livePeaks(): number[] {
    return this.peakSamples.slice(-48);
  }

  get allPeaks(): number[] {
    return this.peakSamples.slice();
  }

  get elapsedMs(): number {
    if (!this.startedAt) return 0;
    return Math.min(MAX_MS, Math.round(performance.now() - this.startedAt));
  }
}

export function downsamplePeaks(samples: number[], target: number): number[] {
  if (samples.length === 0) return Array.from({ length: Math.min(8, target) }, () => 0.15);
  if (samples.length <= target) return samples.map((n) => Math.max(0, Math.min(1, n)));
  const bucket = samples.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.floor((i + 1) * bucket);
    let max = 0;
    for (let j = start; j < end; j++) {
      max = Math.max(max, samples[j] ?? 0);
    }
    out.push(max);
  }
  return out;
}

export const RECORD_MAX_MS = MAX_MS;
