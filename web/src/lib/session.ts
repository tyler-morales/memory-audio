import type { Member } from "./api";

const PREFIX = "memory-audio:";

export function loadMember(token: string): Member | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}member:${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Member;
    if (!parsed.id || !parsed.displayName || !parsed.color) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMember(token: string, member: Member): void {
  localStorage.setItem(`${PREFIX}member:${token}`, JSON.stringify(member));
  document.cookie = `ma_member_${token}=${encodeURIComponent(member.id)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function loadLastSeen(token: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${PREFIX}lastSeen:${token}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function markSeen(token: string, memoryId: string, updatedAt: string): void {
  const map = loadLastSeen(token);
  map[memoryId] = updatedAt;
  localStorage.setItem(`${PREFIX}lastSeen:${token}`, JSON.stringify(map));
}

export function isUpdated(token: string, memoryId: string, updatedAt: string): boolean {
  const map = loadLastSeen(token);
  const seen = map[memoryId];
  if (!seen) return true;
  return seen !== updatedAt;
}
