import { describe, expect, it } from "vitest";
import {
  applyEditedClip,
  draftFromServer,
  hasOpenSlot,
  isDraftDirty,
  playableDraft,
  type DraftClip,
} from "./draft";
import type { Clip } from "./api";

const sample: Clip = {
  id: "c1",
  position: 0,
  durationMs: 1000,
  mime: "audio/mp4",
  peaks: [0.5],
  audioUrl: "/api/audio/x",
  createdAt: "2026-01-01",
};

describe("draft helpers", () => {
  it("maps server clips to saved draft", () => {
    expect(draftFromServer([sample])[0]).toMatchObject({ kind: "saved", id: "c1" });
  });

  it("playableDraft skips armed and recording", () => {
    const draft: DraftClip[] = [
      { kind: "saved", id: "a", durationMs: 1, peaks: [], audioUrl: "/a" },
      { kind: "armed", id: "arm" },
      { kind: "recording", id: "r", peaks: [], elapsedMs: 10 },
      {
        kind: "pending",
        id: "b",
        durationMs: 2,
        peaks: [],
        blob: new Blob(),
        mime: "audio/webm",
        audioUrl: "blob:b",
      },
    ];
    expect(playableDraft(draft).map((c) => c.id)).toEqual(["a", "b"]);
    expect(hasOpenSlot(draft)).toBe(true);
  });

  it("dirty when pending, armed, or deleted", () => {
    expect(isDraftDirty(draftFromServer([sample]), [])).toBe(false);
    expect(isDraftDirty(draftFromServer([sample]), ["c1"])).toBe(true);
    expect(isDraftDirty([{ kind: "armed", id: "r" }], [])).toBe(true);
  });

  it("replaces a saved clip with a pending edit", () => {
    const blob = new Blob([new Uint8Array([1])], { type: "audio/wav" });
    const result = applyEditedClip(draftFromServer([sample]), "c1", {
      id: "edited",
      durationMs: 400,
      peaks: [0.2],
      blob,
      mime: "audio/wav",
      audioUrl: "blob:edited",
    });
    expect(result.deletedSavedId).toBe("c1");
    expect(result.revokedUrl).toBeNull();
    expect(result.draft).toEqual([
      {
        kind: "pending",
        id: "edited",
        durationMs: 400,
        peaks: [0.2],
        blob,
        mime: "audio/wav",
        audioUrl: "blob:edited",
      },
    ]);
  });

  it("replaces a pending clip without deleting a saved id", () => {
    const oldBlob = new Blob([new Uint8Array([1])]);
    const newBlob = new Blob([new Uint8Array([2])]);
    const draft: DraftClip[] = [
      {
        kind: "pending",
        id: "p1",
        durationMs: 1000,
        peaks: [0.5],
        blob: oldBlob,
        mime: "audio/webm",
        audioUrl: "blob:old",
      },
    ];
    const result = applyEditedClip(draft, "p1", {
      id: "p1",
      durationMs: 600,
      peaks: [0.1],
      blob: newBlob,
      mime: "audio/wav",
      audioUrl: "blob:new",
    });
    expect(result.deletedSavedId).toBeNull();
    expect(result.revokedUrl).toBe("blob:old");
    expect(result.draft[0]).toMatchObject({ kind: "pending", id: "p1", durationMs: 600 });
  });

  it("fails when the clip is still recording", () => {
    expect(() =>
      applyEditedClip([{ kind: "recording", id: "r", peaks: [], elapsedMs: 0 }], "r", {
        id: "x",
        durationMs: 100,
        peaks: [],
        blob: new Blob(),
        mime: "audio/wav",
        audioUrl: "blob:x",
      }),
    ).toThrow(/cannot be edited/);
  });
});
