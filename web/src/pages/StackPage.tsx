import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await getSpace(token);
      const list = await listMemories(token);
      setMemories(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load space");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setMember(loadMember(token));
    void refresh();
  }, [token, refresh]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleJoin(displayName: string, color: string) {
    try {
      const m = await joinSpace(token, displayName, color);
      saveMember(token, m);
      setMember(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    }
  }

  async function handleNewMemory() {
    if (!member) return;
    setCreating(true);
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
        setError(null);
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
        <button type="button" className="ghost-btn" onClick={() => void shareLink()}>
          Share link
        </button>
      </header>

      <main className="stack-page">
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
        {!loading && memories.length === 0 && (
          <div className="empty-state">
            <p>No memories yet.</p>
            <p>Start a tape. Friends with this link can listen and reply.</p>
          </div>
        )}
        {memories.map((m) => (
          <MemoryCard key={m.id} token={token} memory={m} />
        ))}
      </main>

      {member && (
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

      <JoinSheet open={!member && !loading && !error} onJoin={handleJoin} />
    </div>
  );
}
