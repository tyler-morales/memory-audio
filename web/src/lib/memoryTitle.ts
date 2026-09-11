export function displayMemoryTitle(title: string, creatorName: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : `${creatorName}'s memory`;
}

export const MAX_MEMORY_TITLE_CHARS = 80;

/** Returns the title to persist, or null when unchanged. */
export function committedMemoryTitle(raw: string, previous: string): string | null {
  const next = raw.trim().slice(0, MAX_MEMORY_TITLE_CHARS);
  if (next === previous.trim()) return null;
  return next;
}

