import type { Clip } from "./api";

export type DraftClip =
  | {
      kind: "saved";
      id: string;
      durationMs: number;
      peaks: number[];
      audioUrl: string;
    }
  | {
      kind: "pending";
      id: string;
      durationMs: number;
      peaks: number[];
      blob: Blob;
      mime: string;
      audioUrl: string;
    }
  | {
      kind: "armed";
      id: string;
    }
  | {
      kind: "recording";
      id: string;
      peaks: number[];
      elapsedMs: number;
    };

export function draftFromServer(clips: Clip[]): DraftClip[] {
  return clips.map((c) => ({
    kind: "saved" as const,
    id: c.id,
    durationMs: c.durationMs,
    peaks: c.peaks,
    audioUrl: c.audioUrl,
  }));
}

export function playableDraft(clips: DraftClip[]): Clip[] {
  return clips
    .filter(
      (c): c is Extract<DraftClip, { kind: "saved" | "pending" }> =>
        c.kind === "saved" || c.kind === "pending",
    )
    .map((c, position) => ({
      id: c.id,
      position,
      durationMs: c.durationMs,
      mime: c.kind === "pending" ? c.mime : "audio/mp4",
      peaks: c.peaks,
      audioUrl: c.audioUrl,
      createdAt: "",
    }));
}

export function isDraftDirty(draft: DraftClip[], deletedIds: string[]): boolean {
  return (
    deletedIds.length > 0 ||
    draft.some((c) => c.kind === "pending" || c.kind === "recording" || c.kind === "armed")
  );
}

export function hasOpenSlot(draft: DraftClip[]): boolean {
  return draft.some((c) => c.kind === "armed" || c.kind === "recording");
}

export type PendingDraftClip = Extract<DraftClip, { kind: "pending" }>;
export type EditableDraftClip = Extract<DraftClip, { kind: "saved" | "pending" }>;

export function applyEditedClip(
  draft: DraftClip[],
  clipId: string,
  edited: Omit<PendingDraftClip, "kind">,
): { draft: DraftClip[]; deletedSavedId: string | null; revokedUrl: string | null } {
  const index = draft.findIndex((c) => c.id === clipId);
  const current = index >= 0 ? draft[index] : undefined;
  if (!current || current.kind === "recording" || current.kind === "armed") {
    throw new Error("Clip cannot be edited");
  }

  const deletedSavedId = current.kind === "saved" ? current.id : null;
  const revokedUrl = current.kind === "pending" ? current.audioUrl : null;
  const next = draft.slice();
  next[index] = { kind: "pending", ...edited };
  return { draft: next, deletedSavedId, revokedUrl };
}
