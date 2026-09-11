/** Max upload size for a single clip/reply (90s speech is well under this). */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** 128-bit unlisted space token (base64url). */
export function createToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function createId(): string {
  return crypto.randomUUID();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isValidToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(token);
}

const ALLOWED_COLORS = new Set([
  "#E07A5F",
  "#3D405B",
  "#81B29A",
  "#F2CC8F",
  "#E9C46A",
  "#2A9D8F",
  "#E76F51",
  "#264653",
]);

export function normalizeColor(color: string): string | null {
  const trimmed = color.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(trimmed)) return null;
  // Accept any hex for flexibility; prefer palette when matching
  if (ALLOWED_COLORS.has(trimmed)) return trimmed;
  return trimmed;
}

export function normalizeDisplayName(name: string): string | null {
  const trimmed = name.trim().slice(0, 40);
  if (trimmed.length < 1) return null;
  return trimmed;
}

export function parsePeaks(json: string): number[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((n) => (typeof n === "number" ? Math.max(0, Math.min(1, n)) : 0))
      .slice(0, 256);
  } catch {
    return [];
  }
}

export function stringifyPeaks(peaks: unknown): string {
  if (!Array.isArray(peaks)) return "[]";
  const normalized = peaks
    .map((n) => (typeof n === "number" ? Math.max(0, Math.min(1, n)) : 0))
    .slice(0, 256);
  return JSON.stringify(normalized);
}

export function isAllowedMime(mime: string): boolean {
  return (
    mime === "audio/mp4" ||
    mime === "audio/webm" ||
    mime === "audio/webm;codecs=opus" ||
    mime === "audio/ogg" ||
    mime === "audio/ogg;codecs=opus" ||
    mime === "audio/mpeg" ||
    mime === "audio/wav" ||
    mime === "audio/x-m4a" ||
    mime.startsWith("audio/mp4") ||
    mime.startsWith("audio/webm")
  );
}

export function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "m4a";
}
