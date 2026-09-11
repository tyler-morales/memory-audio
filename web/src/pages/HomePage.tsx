import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSpace } from "../lib/api";

export function HomePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const space = await createSpace();
      navigate(`/s/${space.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create space");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell home-page">
      <h1>Memory Space</h1>
      <p>
        Shared audio memories for people you care about. Record tidbits through the day, reply on
        the tape, and stay in the room without a call.
      </p>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="primary-btn" onClick={() => void handleCreate()} disabled={busy}>
        {busy ? "Creating…" : "Create a space"}
      </button>
      <p style={{ fontSize: "0.85rem" }}>
        You’ll get a private link. Anyone with it can speak. No accounts.
      </p>
    </main>
  );
}
