import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { useAuth } from "@/auth/AuthContext";
import { getSnapshot, refreshSnapshot, SNAPSHOT_CACHE_UPDATED_EVENT } from "@/api/client";
import type { SnapshotResponse } from "@/types";

export function PlayerLandingPage() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const load = () => {
      setSnapshot(null);
      setError(null);
      getSnapshot(session)
        .then(setSnapshot)
        .catch((err) => setError(err instanceof Error ? err.message : "Unable to load data. Please check your API key or connection."));
    };
    load();
    const onUpdated = () => load();
    window.addEventListener(SNAPSHOT_CACHE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(SNAPSHOT_CACHE_UPDATED_EVENT, onUpdated);
  }, [session]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (error) {
    const isRateLimit = /429|quota|resource_exhausted/i.test(error);
    return (
      <AppShell title="Player View">
        <section className="panel fetch-status-card" role="alert">
          <h2>Unable to load data. Please check your API key or connection.</h2>
          <p>{isRateLimit ? "Google Sheets API is rate-limited right now. Please wait a moment and retry." : "Unable to load data. Please check your API key or connection."}</p>
          <p className="fetch-status-detail">{error}</p>
          <button type="button" className="fetch-retry-btn" onClick={() => void refreshSnapshot(session)}>
            Refresh Data
          </button>
        </section>
      </AppShell>
    );
  }

  if (!snapshot) {
    return (
      <AppShell title="Player View">
        <section className="panel fetch-status-card" aria-live="polite">
          <h2>Loading player data...</h2>
          <p>Loading cached metrics.</p>
        </section>
      </AppShell>
    );
  }

  const firstVisible = snapshot.visiblePlayerIds[0] || Object.keys(snapshot.players)[0];
  if (!firstVisible) {
    return (
      <AppShell title="Player View">
        <section className="panel fetch-status-card" role="alert">
          <h2>No player data found.</h2>
          <p>No players are available in cache right now.</p>
          <button type="button" className="fetch-retry-btn" onClick={() => void refreshSnapshot(session)}>
            Refresh Data
          </button>
        </section>
      </AppShell>
    );
  }

  return <Navigate to={`/player/${firstVisible}`} replace />;
}
