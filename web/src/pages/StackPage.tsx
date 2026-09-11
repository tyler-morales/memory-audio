import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { JoinSheet } from "../components/JoinSheet";
import { MemoryCard } from "../components/MemoryCard";
import {
  createMemory,
  getSpace,
  joinSpace,
  listMemories,
  type Member,
  type MemorySummary,
} from "../lib/api";
import { loadMember, saveMember } from "../lib/session";

export function StackPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(() => loadMember(token));
  const [memories, setMemories] = useState<MemorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [spaceMissing, setSpaceMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await getSpace(token);
      const list = await listMemories(token);
      setMemories(list);
      setError(null);
      setSpaceMissing(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load space";
      setError(message);
      const missing =
        /not found/i.test(message) || /invalid token/i.test(message);
      setSpaceMissing(missing);
      if (missing) {
        setMemories([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setMember(loadMember(token));
    setLoading(true);
    void refresh();
  }, [token, refresh]);

  useEffect(() => {
    if (spaceMissing) return;
    const id = window.setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh, spaceMissing]);

  async function handleJoin(displayName: string, color: string) {
    try {
      const m = await joinSpace(token, displayName, color);
      saveMember(token, m);
      setMember(m);
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    }
  }

  async function handleNewMemory() {
    if (!member || spaceMissing) return;
    setCreating(true);
    setError(null);
    try {
      const memory = await createMemory(token, member.id);
      navigate(`/s/${token}/m/${memory.id}?capture=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create memory");
    } finally {
      setCreating(false);
    }
  }

  async function shareLink() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Memory Space", url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied");
      }
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Memories</h1>
        {!spaceMissing && (
          <button type="button" className="ghost-btn" onClick={() => void shareLink()}>
            Share link
          </button>
        )}
      </header>

      <main className="stack-page">
        {error && (
          <div className="error-banner" role="alert">
            {error}
            {spaceMissing && (
              <p style={{ margin: "0.5rem 0 0" }}>
                This space link is no longer valid (local database was reset).{" "}
                <Link to="/" style={{ color: "inherit", textDecoration: "underline" }}>
                  Create a new space
                </Link>
              </p>
            )}
          </div>
        )}
        {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
        {!loading && !spaceMissing && memories.length === 0 && !error && (
          <div className="empty-state">
            <p>No memories yet.</p>
            <p>Start a tape. Friends with this link can listen and reply.</p>
          </div>
        )}
        {!loading && !spaceMissing && error && memories.length === 0 && (
          <div className="empty-state">
            <p>Couldn’t load memories.</p>
            <button type="button" className="ghost-btn" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        )}
        {memories.map((m) => (
          <MemoryCard key={m.id} token={token} memory={m} />
        ))}
      </main>

      {member && !spaceMissing && (
        <button
          type="button"
          className="fab"
          aria-label="New memory"
          disabled={creating}
          onClick={() => void handleNewMemory()}
        >
          +
        </button>
      )}

      <JoinSheet open={!member && !loading && !spaceMissing} onJoin={handleJoin} />
    </div>
  );
}
