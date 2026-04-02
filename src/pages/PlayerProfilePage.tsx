import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { LoadingCard } from "@/components/LoadingCard";
import { useAuth } from "@/auth/AuthContext";
import { getSnapshot, refreshSnapshot, SNAPSHOT_CACHE_UPDATED_EVENT } from "@/api/client";
import { canViewPlayer } from "@/rbac/permissions";
import type { SnapshotResponse } from "@/types";

const cardOrder = ["overall", "attack", "transition", "defence", "kickouts", "ourKickouts", "oppKickouts"];
const featuredCards = new Set(["overall", "attack"]);

export function PlayerProfilePage() {
  const { playerId } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilterId, setActiveFilterId] = useState("all");

  useEffect(() => {
    if (!session) return;
    const load = () => {
      setSnapshot(null);
      setError(null);
      getSnapshot(session)
        .then(setSnapshot)
        .catch((err) => setError(err instanceof Error ? err.message : "Could not load cached player profile"));
    };
    load();
    const onUpdated = () => load();
    window.addEventListener(SNAPSHOT_CACHE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(SNAPSHOT_CACHE_UPDATED_EVENT, onUpdated);
  }, [session]);

  useEffect(() => {
    if (!snapshot) return;
    const nextDefault = snapshot.filters?.defaultOptionId ?? "all";
    const options = snapshot.filters?.options.map((option) => option.id) ?? ["all"];
    setActiveFilterId((current) => (options.includes(current) ? current : nextDefault));
  }, [snapshot]);

  if (!session || !playerId) return null;

  const missingBoundPlayerId = session.role === "player" && !session.playerId;
  if (!missingBoundPlayerId && !canViewPlayer(session.role, session.playerId, playerId)) {
    return <Navigate to="/" replace />;
  }

  if (error) {
    const isRateLimit = /429|quota|resource_exhausted/i.test(error);
    return (
      <AppShell title="Player Detail">
        <section className="panel fetch-status-card" role="alert">
          <h2>Player data is unavailable.</h2>
          <p>{isRateLimit ? "Google Sheets API is rate-limited right now. Please wait a moment and retry." : "Could not load player profile from local cache."}</p>
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
      <AppShell title="Player Profile">
        <section className="panel fetch-status-card" aria-live="polite">
          <LoadingCard label="Loading player profile" />
        </section>
      </AppShell>
    );
  }

  const activePlayerViews = snapshot.filters?.playerViews[activeFilterId] ?? snapshot.playerViews;
  const filterOptions = snapshot.filters?.options ?? [{ id: "all", label: "All Matches", description: "Combined view across all available matches" }];
  const fallbackPlayerId = snapshot.visiblePlayerIds[0] ?? Object.keys(activePlayerViews)[0];
  const view =
    activePlayerViews[playerId] ??
    (session.playerId ? activePlayerViews[session.playerId] : undefined) ??
    (fallbackPlayerId ? activePlayerViews[fallbackPlayerId] : undefined);

  if (!view) {
    return (
      <AppShell title="Player Detail">
        <div className="panel error">No player data available for this view.</div>
      </AppShell>
    );
  }

  const cards = cardOrder.map((id) => view.cards.find((c) => c.id === id)).filter((card): card is (typeof view.cards)[number] => Boolean(card));
  const showBackButton = session.role === "manager" || session.role === "admin";
  const topSummaryStats = [
    { label: "Scores For", value: String(view.header.scoresFor) },
    { label: "Turnovers Against", value: String(view.header.turnoversAgainst) },
    { label: "Role View", value: session.role === "manager" ? "Team Manager" : session.role === "admin" ? "Admin" : "Player" }
  ];

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(session.role === "admin" ? "/admin/users" : "/manager/dashboard");
  };

  const backIcon = showBackButton ? (
    <button
      type="button"
      className="back-icon-link"
      aria-label={session.role === "admin" ? "Back to previous admin screen" : "Back to previous manager screen"}
      onClick={handleBack}
    >
      <span aria-hidden="true">&larr;</span>
    </button>
  ) : undefined;

  return (
    <AppShell title={view.header.playerName} titlePrefix={backIcon}>
      <section className="player-dashboard-hero panel">
        <div className="player-dashboard-copy">
          <p className="player-page-subtitle">Player Detail Dashboard</p>
          <h2 className="player-dashboard-name">{view.header.playerName}</h2>
          <p className="player-page-meta">{view.header.subtitle}</p>
        </div>
        <div className="player-dashboard-summary">
          {topSummaryStats.map((item) => (
            <article key={item.label} className="player-summary-chip">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>
      <section className="dashboard-toolbar dashboard-toolbar-player">
        <div>
          <p className="toolbar-kicker">Dashboard Filter</p>
          <h2 className="toolbar-title">Switch between all matches and recent game windows</h2>
        </div>
        <div className="filter-chip-group" role="tablist" aria-label="Player dashboard filter">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`filter-chip ${activeFilterId === option.id ? "active" : ""}`}
              onClick={() => setActiveFilterId(option.id)}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <div className="player-screen-grid">
        {cards.map((card) => (
          <article key={card.id} className={`player-card panel ${featuredCards.has(card.id) ? "player-card-featured" : ""}`}>
            <header className="player-card-head">
              <div>
                <p className="player-card-kicker">Performance Area</p>
                <h2>{card.title}</h2>
              </div>
              <strong>{card.metric}</strong>
            </header>
            <div className="metric-lines">
              {card.lines.map((line) => (
                <div key={line.label} className="metric-line">
                  <div className="label-row">
                    <span>{line.label}</span>
                    <span>{line.value}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.round((line.ratio ?? 0.5) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
