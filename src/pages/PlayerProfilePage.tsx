import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { LoadingCard } from "@/components/LoadingCard";
import { SortableTable, type SortableTableColumn } from "@/components/SortableTable";
import { useAuth } from "@/auth/AuthContext";
import { getSnapshot, refreshSnapshot, SNAPSHOT_CACHE_UPDATED_EVENT } from "@/api/client";
import { canViewPlayer } from "@/rbac/permissions";
import type { MatchStatRecord, SnapshotResponse } from "@/types";

const DATA_ERROR_MESSAGE = "Unable to load data. Please check your API key or connection.";

type BreakdownRow = {
  key: string;
  matchLabel: string;
  date: string;
  minutes: number;
  points: number;
  goals: number;
  tackles: number;
  simplePass: number;
  advancePass: number;
  carries: number;
  turnovers: number;
  assists: number;
};

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
      setError(null);
      getSnapshot(session)
        .then(setSnapshot)
        .catch((err) => setError(err instanceof Error ? err.message : DATA_ERROR_MESSAGE));
    };
    load();
    const onUpdated = () => load();
    window.addEventListener(SNAPSHOT_CACHE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(SNAPSHOT_CACHE_UPDATED_EVENT, onUpdated);
  }, [session]);

  useEffect(() => {
    if (!snapshot) return;
    const options = snapshot.filters.options.map((option) => option.id);
    setActiveFilterId((current) => (options.includes(current) ? current : snapshot.filters.defaultOptionId));
  }, [snapshot]);

  if (!session || !playerId) return null;

  const missingBoundPlayerId = session.role === "player" && !session.playerId;
  if (!missingBoundPlayerId && !canViewPlayer(session.role, session.playerId, playerId)) {
    return <Navigate to="/" replace />;
  }

  if (error) {
    return (
      <AppShell title="Player Detail">
        <section className="panel fetch-status-card" role="alert">
          <h2>Unable to load data. Please check your API key or connection.</h2>
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

  const allPlayerRecords = snapshot.records.filter((record) => record.playerId === playerId);
  const filteredRecords = (activeFilterId === "all" ? allPlayerRecords : allPlayerRecords.filter((record) => record.matchId === activeFilterId)).sort(sortByDateThenMatch);
  const player = snapshot.players[playerId] ?? (allPlayerRecords[0] ? { playerId, name: allPlayerRecords[0].playerName, number: "", position: "" } : null);

  if (!player) {
    return (
      <AppShell title="Player Detail">
        <div className="panel error">No player data available for this player.</div>
      </AppShell>
    );
  }

  const totals = {
    minutes: sumBy(filteredRecords, (record) => record.totalMinutes),
    points: sumBy(filteredRecords, (record) => record.pts),
    goals: sumBy(filteredRecords, (record) => record.goalsScored),
    tackles: sumBy(filteredRecords, (record) => record.tackles),
    simplePass: sumBy(filteredRecords, (record) => record.simplePass),
    advancePass: sumBy(filteredRecords, (record) => record.advancePass),
    carries: sumBy(filteredRecords, (record) => record.carries),
    turnovers: sumBy(filteredRecords, (record) => record.turnovers),
    assists: sumBy(filteredRecords, (record) => record.assists)
  };

  const breakdownRows: BreakdownRow[] = filteredRecords.map((record) => ({
    key: record.key,
    matchLabel: record.matchLabel,
    date: record.date,
    minutes: record.totalMinutes,
    points: record.pts,
    goals: record.goalsScored,
    tackles: record.tackles,
    simplePass: record.simplePass,
    advancePass: record.advancePass,
    carries: record.carries,
    turnovers: record.turnovers,
    assists: record.assists
  }));

  const summaryCards = [
    { label: "Minutes Played", value: totals.minutes },
    { label: "Points", value: totals.points },
    { label: "Goals", value: totals.goals },
    { label: "Tackles", value: totals.tackles },
    { label: "Simple Pass", value: totals.simplePass },
    { label: "Advance Pass", value: totals.advancePass },
    { label: "Carries", value: totals.carries },
    { label: "Turnovers", value: totals.turnovers },
    { label: "Assists", value: totals.assists }
  ];

  const showBackButton = session.role === "manager" || session.role === "admin";
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

  const columns: Array<SortableTableColumn<BreakdownRow>> = [
    {
      id: "matchLabel",
      label: "Match",
      sortAccessor: (row) => `${row.date}|${row.matchLabel}`,
      cell: (row) => (
        <div className="match-cell">
          <span>{row.matchLabel}</span>
          <small>{row.date || "-"}</small>
        </div>
      )
    },
    { id: "minutes", label: "Minutes", sortAccessor: (row) => row.minutes, cell: (row) => formatNumber(row.minutes), headerClassName: "num", cellClassName: "num" },
    { id: "points", label: "Points", sortAccessor: (row) => row.points, cell: (row) => formatNumber(row.points), headerClassName: "num", cellClassName: "num" },
    { id: "goals", label: "Goals", sortAccessor: (row) => row.goals, cell: (row) => formatNumber(row.goals), headerClassName: "num", cellClassName: "num" },
    { id: "tackles", label: "Tackles", sortAccessor: (row) => row.tackles, cell: (row) => formatNumber(row.tackles), headerClassName: "num", cellClassName: "num" },
    { id: "simplePass", label: "Simple Pass", sortAccessor: (row) => row.simplePass, cell: (row) => formatNumber(row.simplePass), headerClassName: "num", cellClassName: "num" },
    { id: "advancePass", label: "Advance Pass", sortAccessor: (row) => row.advancePass, cell: (row) => formatNumber(row.advancePass), headerClassName: "num", cellClassName: "num" },
    { id: "carries", label: "Carries", sortAccessor: (row) => row.carries, cell: (row) => formatNumber(row.carries), headerClassName: "num", cellClassName: "num" },
    { id: "turnovers", label: "Turnovers", sortAccessor: (row) => row.turnovers, cell: (row) => formatNumber(row.turnovers), headerClassName: "num", cellClassName: "num" },
    { id: "assists", label: "Assists", sortAccessor: (row) => row.assists, cell: (row) => formatNumber(row.assists), headerClassName: "num", cellClassName: "num" }
  ];

  return (
    <AppShell title={player.name} titlePrefix={backIcon}>
      <section className="player-dashboard-hero panel">
        <div className="player-dashboard-copy">
          <p className="player-page-subtitle">Player Detail Dashboard</p>
          <h2 className="player-dashboard-name">{player.name}</h2>
          <p className="player-page-meta">Match-by-match live Google Sheets data</p>
        </div>
        <label className="filter-select-field player-filter-field">
          <span className="filter-select-label">Match</span>
          <select className="filter-select" aria-label="Player dashboard match filter" value={activeFilterId} onChange={(event) => setActiveFilterId(event.target.value)}>
            {snapshot.filters.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="player-stat-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className="player-summary-card panel-inner">
            <span>{card.label}</span>
            <strong>{formatNumber(card.value)}</strong>
          </article>
        ))}
      </div>

      <section className="panel player-breakdown-section">
        <div className="panel-inner player-breakdown-head">
          <h3>Per-match breakdown</h3>
          <p>{activeFilterId === "all" ? "Showing every match the player appeared in." : "Showing the selected match only."}</p>
        </div>
        <div className="panel-inner manager-table">
          <SortableTable rows={breakdownRows} columns={columns} getRowKey={(row) => row.key} />
        </div>
      </section>
    </AppShell>
  );
}

function sumBy(items: MatchStatRecord[], accessor: (item: MatchStatRecord) => number): number {
  return items.reduce((total, item) => total + accessor(item), 0);
}

function sortByDateThenMatch(left: MatchStatRecord, right: MatchStatRecord): number {
  const leftTime = Date.parse(left.date);
  const rightTime = Date.parse(right.date);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.matchLabel.localeCompare(right.matchLabel);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}
