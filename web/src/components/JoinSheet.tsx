import { useState } from "react";
import { MEMBER_COLORS } from "../lib/api";

type Props = {
  open: boolean;
  onJoin: (displayName: string, color: string) => Promise<void>;
};

export function JoinSheet({ open, onJoin }: Props) {
  const [color, setColor] = useState<string>(MEMBER_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="presentation">
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-title"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const displayName = String(data.get("displayName") ?? "");
          setBusy(true);
          setError(null);
          void onJoin(displayName, color)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Join failed");
            })
            .finally(() => setBusy(false));
        }}
      >
        <h2 id="join-title">Who are you?</h2>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          Pick a name and color so friends know your voice. No account needed.
        </p>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={40}
            autoComplete="nickname"
            placeholder="e.g. Tyler"
            autoFocus
          />
        </div>
        <div className="field">
          <span id="color-label" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Color
          </span>
          <div className="color-row" role="radiogroup" aria-labelledby="color-label">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="color-swatch"
                style={{ background: c }}
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? "Joining…" : "Join space"}
        </button>
      </form>
    </div>
  );
}
