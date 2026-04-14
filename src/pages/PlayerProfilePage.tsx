import { useEffect, useState } from "react";
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
  totalImpact: number;
  attackImpact: number;
  transitionImpact: number;
  defenseImpact: number;
  minutes: number;
  points: number;
  goals: number;
  onePointers: number;
  twoPointers: number;
  frees: number;
  tackles: number;
  simplePass: number;
  advancePass: number;
  carries: number;
  turnovers: number;
  assists: number;
};

type MetricLine = {
  label: string;
  value: number;
  accent?: "gold" | "blue";
};

type SummaryCard = {
  label: string;
  value: number;
  subtitle: string;
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
    appearances: filteredRecords.length,
    minutes: sumBy(filteredRecords, (record) => record.totalMinutes),
    points: sumBy(filteredRecords, (record) => record.pts),
    goals: sumBy(filteredRecords, (record) => record.goalsScored),
    onePointers: sumBy(filteredRecords, (record) => record.onePointerScored),
    twoPointers: sumBy(filteredRecords, (record) => record.twoPointerScored),
    frees: sumBy(filteredRecords, (record) => record.freeOnePointerScored + record.freeTwoPointerScored + record.freeGoalsScored),
    tackles: sumBy(filteredRecords, (record) => record.tackles),
    duelsContested: sumBy(filteredRecords, (record) => record.duelsContested),
    duelsLost: sumBy(filteredRecords, (record) => record.duelsLost),
    simplePass: sumBy(filteredRecords, (record) => record.simplePass),
    advancePass: sumBy(filteredRecords, (record) => record.advancePass),
    carries: sumBy(filteredRecords, (record) => record.carries),
    turnovers: sumBy(filteredRecords, (record) => record.turnovers),
    turnoversInContact: sumBy(filteredRecords, (record) => record.turnoversInContact),
    turnoverSkillError: sumBy(filteredRecords, (record) => record.turnoverSkillError),
    turnoversKickedAway: sumBy(filteredRecords, (record) => record.turnoversKickedAway),
    forceTurnoverWin: sumBy(filteredRecords, (record) => record.forceTurnoverWin),
    assists: sumBy(filteredRecords, (record) => record.assists),
    assistsShots: sumBy(filteredRecords, (record) => record.assistsShots),
    assistsGoals: sumBy(filteredRecords, (record) => record.assistsGoals),
    attackImpact: sumBy(filteredRecords, (record) => record.attackImpact),
    transitionImpact: sumBy(filteredRecords, (record) => record.transitionImpact),
    defenseImpact: sumBy(filteredRecords, (record) => record.defenseImpact),
    totalImpact: sumBy(filteredRecords, (record) => record.totalImpact),
    koWinsOur: sumBy(filteredRecords, (record) => record.koWinsOur),
    koContestsOur: sumBy(filteredRecords, (record) => record.koContestsOur),
    koWinsOpp: sumBy(filteredRecords, (record) => record.koWinsOpp),
    koContestsOpp: sumBy(filteredRecords, (record) => record.koContestsOpp)
  };

  const breakdownRows: BreakdownRow[] = filteredRecords.map((record) => ({
    key: record.key,
    matchLabel: record.matchLabel,
    date: record.date,
    totalImpact: record.totalImpact,
    attackImpact: record.attackImpact,
    transitionImpact: record.transitionImpact,
    defenseImpact: record.defenseImpact,
    minutes: record.totalMinutes,
    points: record.pts,
    goals: record.goalsScored,
    onePointers: record.onePointerScored,
    twoPointers: record.twoPointerScored,
    frees: record.freeOnePointerScored + record.freeTwoPointerScored + record.freeGoalsScored,
    tackles: record.tackles,
    simplePass: record.simplePass,
    advancePass: record.advancePass,
    carries: record.carries,
    turnovers: record.turnovers,
    assists: record.assists
  }));

  const summaryCards: SummaryCard[] = [
    { label: "Appearances", value: totals.appearances, subtitle: "Matches played in the selected view" },
    { label: "Total Minutes", value: totals.minutes, subtitle: "Minutes accumulated across the filter" },
    { label: "Total Scores", value: totals.onePointers + totals.twoPointers + totals.goals, subtitle: "1PT + 2PT + goals combined" },
    { label: "Frees Scored", value: totals.frees, subtitle: "Set-piece conversion in the selected view" },
    { label: "Turnovers", value: totals.turnovers, subtitle: "Total ball losses recorded" }
  ];

  const attackMetrics: MetricLine[] = [
    { label: "Total Impact", value: totals.totalImpact },
    { label: "Attack Impact", value: totals.attackImpact },
    { label: "Points", value: totals.points },
    { label: "Goals", value: totals.goals },
    { label: "1-Pointers", value: totals.onePointers },
    { label: "2-Pointers", value: totals.twoPointers },
    { label: "Frees Scored", value: totals.frees },
    { label: "Assists", value: totals.assists }
  ];

  const transitionMetrics: MetricLine[] = [
    { label: "Transition Impact", value: totals.transitionImpact, accent: "blue" },
    { label: "Simple Pass", value: totals.simplePass },
    { label: "Advance Pass", value: totals.advancePass },
    { label: "Carries", value: totals.carries },
    { label: "Assist Shots", value: totals.assistsShots },
    { label: "Assist Goals", value: totals.assistsGoals }
  ];

  const defenceMetrics: MetricLine[] = [
    { label: "Defence Impact", value: totals.defenseImpact, accent: "blue" },
    { label: "Tackles", value: totals.tackles },
    { label: "Duels Contested", value: totals.duelsContested },
    { label: "Duels Lost", value: totals.duelsLost },
    { label: "Force TO Win", value: totals.forceTurnoverWin }
  ];

  const kickoutMetrics: MetricLine[] = [
    { label: "KO % OUR", value: safeDivide(totals.koWinsOur, totals.koContestsOur) * 100 },
    { label: "OUR Contests", value: totals.koContestsOur },
    { label: "OUR Wins", value: totals.koWinsOur },
    { label: "KO % OPP", value: safeDivide(totals.koWinsOpp, totals.koContestsOpp) * 100, accent: "blue" },
    { label: "OPP Contests", value: totals.koContestsOpp },
    { label: "OPP Wins", value: totals.koWinsOpp }
  ];

  const turnoverMetrics: MetricLine[] = [
    { label: "Total Turnovers", value: totals.turnovers },
    { label: "In Contact", value: totals.turnoversInContact },
    { label: "Skill Error", value: totals.turnoverSkillError },
    { label: "Kicked Away", value: totals.turnoversKickedAway }
  ];

  const attackMax = Math.max(...attackMetrics.map((item) => item.value), 1);
  const transitionMax = Math.max(...transitionMetrics.map((item) => item.value), 1);
  const defenceMax = Math.max(...defenceMetrics.map((item) => item.value), 1);
  const turnoverMax = Math.max(...turnoverMetrics.map((item) => item.value), 1);

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
        <div className="manager-player-cell player-history-match-cell">
          <span className="manager-player-avatar player-match-avatar">{getMatchBadge(row.matchLabel)}</span>
          <span className="manager-player-meta">
            <span className="manager-player-link">{row.matchLabel}</span>
            <small>{row.date || "-"}</small>
          </span>
        </div>
      )
    },
    {
      id: "totalImpact",
      label: "Total Impact",
      sortAccessor: (row) => row.totalImpact,
      cell: (row) => <HistoryMetricCell value={row.totalImpact} bars={buildMiniBarValues([row.attackImpact, row.transitionImpact, row.defenseImpact, row.totalImpact])} />,
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "attackImpact",
      label: "Attack",
      sortAccessor: (row) => row.attackImpact,
      cell: (row) => <HistoryMetricCell value={row.attackImpact} bars={buildMiniBarValues([row.points, row.goals, row.onePointers, row.twoPointers])} />,
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "transitionImpact",
      label: "Transition",
      sortAccessor: (row) => row.transitionImpact,
      cell: (row) => <HistoryMetricCell value={row.transitionImpact} bars={buildMiniBarValues([row.simplePass, row.advancePass, row.carries, row.assists])} />,
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "defenseImpact",
      label: "Defence",
      sortAccessor: (row) => row.defenseImpact,
      cell: (row) => <HistoryMetricCell value={row.defenseImpact} bars={buildMiniBarValues([row.tackles, row.turnovers, row.minutes])} accent="blue" />,
      headerClassName: "num",
      cellClassName: "num"
    },
    { id: "minutes", label: "Minutes", sortAccessor: (row) => row.minutes, cell: (row) => formatNumber(row.minutes), headerClassName: "num", cellClassName: "num" },
    { id: "points", label: "Points", sortAccessor: (row) => row.points, cell: (row) => formatNumber(row.points), headerClassName: "num", cellClassName: "num" },
    { id: "goals", label: "Goals", sortAccessor: (row) => row.goals, cell: (row) => formatNumber(row.goals), headerClassName: "num", cellClassName: "num" },
    { id: "onePointers", label: "1PT", sortAccessor: (row) => row.onePointers, cell: (row) => formatNumber(row.onePointers), headerClassName: "num", cellClassName: "num" },
    { id: "twoPointers", label: "2PT", sortAccessor: (row) => row.twoPointers, cell: (row) => formatNumber(row.twoPointers), headerClassName: "num", cellClassName: "num" },
    { id: "frees", label: "Frees", sortAccessor: (row) => row.frees, cell: (row) => formatNumber(row.frees), headerClassName: "num", cellClassName: "num" },
    { id: "tackles", label: "Tackles", sortAccessor: (row) => row.tackles, cell: (row) => formatNumber(row.tackles), headerClassName: "num", cellClassName: "num" },
    { id: "simplePass", label: "Simple Pass", sortAccessor: (row) => row.simplePass, cell: (row) => formatNumber(row.simplePass), headerClassName: "num", cellClassName: "num" },
    { id: "advancePass", label: "Advance Pass", sortAccessor: (row) => row.advancePass, cell: (row) => formatNumber(row.advancePass), headerClassName: "num", cellClassName: "num" },
    { id: "carries", label: "Carries", sortAccessor: (row) => row.carries, cell: (row) => formatNumber(row.carries), headerClassName: "num", cellClassName: "num" },
    { id: "turnovers", label: "Turnovers", sortAccessor: (row) => row.turnovers, cell: (row) => formatNumber(row.turnovers), headerClassName: "num", cellClassName: "num" },
    { id: "assists", label: "Assists", sortAccessor: (row) => row.assists, cell: (row) => formatNumber(row.assists), headerClassName: "num", cellClassName: "num" }
  ];

  return (
    <AppShell title={player.name} titlePrefix={backIcon}>
      <div className="player-dashboard-shell panel">
        <section className="player-dashboard-hero panel">
          <div className="player-dashboard-copy">
            <div className="player-header-identity">
              <span className="manager-player-avatar player-hero-avatar">{getInitials(player.name)}</span>
              <div>
                <p className="player-page-subtitle">Player Detail Dashboard</p>
                <h2 className="player-dashboard-name">{player.name}</h2>
              </div>
            </div>
            <p className="player-page-meta">Manager-ready player view powered by live Google Sheets data</p>
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

        <section className="kpi-grid player-kpi-grid">
          {summaryCards.map((card, index) => (
            <article key={card.label} className={`kpi-card panel-inner player-overview-card player-overview-card-${index + 1}`}>
              <h3>{card.label}</h3>
              <p className="kpi-value">{formatNumber(card.value)}</p>
              <span>{card.subtitle}</span>
            </article>
          ))}
        </section>

        <section className="player-screen-grid">
          <article className="panel player-card player-card-featured">
            <div className="player-card-head">
              <div>
                <p className="player-card-kicker">Attack</p>
                <h2>Output and scoring</h2>
              </div>
              <strong>{formatNumber(totals.attackImpact)}</strong>
            </div>
            <div className="metric-lines">
              {attackMetrics.map((metric) => (
                <MetricLineCard key={metric.label} metric={metric} maxValue={attackMax} />
              ))}
            </div>
          </article>

          <article className="panel player-card">
            <div className="player-card-head">
              <div>
                <p className="player-card-kicker">Transition</p>
                <h2>Link play</h2>
              </div>
              <strong>{formatNumber(totals.transitionImpact)}</strong>
            </div>
            <div className="metric-lines">
              {transitionMetrics.map((metric) => (
                <MetricLineCard key={metric.label} metric={metric} maxValue={transitionMax} />
              ))}
            </div>
          </article>

          <article className="panel player-card">
            <div className="player-card-head">
              <div>
                <p className="player-card-kicker">Defence</p>
                <h2>Without the ball</h2>
              </div>
              <strong>{formatNumber(totals.defenseImpact)}</strong>
            </div>
            <div className="metric-lines">
              {defenceMetrics.map((metric) => (
                <MetricLineCard key={metric.label} metric={metric} maxValue={defenceMax} />
              ))}
            </div>
          </article>

          <article className="panel player-card">
            <div className="player-card-head">
              <div>
                <p className="player-card-kicker">Kick Outs</p>
                <h2>Contest contribution</h2>
              </div>
              <strong>{formatPercent(safeDivide(totals.koWinsOur, totals.koContestsOur) * 100)}</strong>
            </div>
            <div className="metric-lines">
              {kickoutMetrics.map((metric) => (
                <MetricLineCard key={metric.label} metric={metric} maxValue={100} formatValue={metric.label.includes("%") ? formatPercent : formatNumber} />
              ))}
            </div>
          </article>

          <article className="panel player-card">
            <div className="player-card-head">
              <div>
                <p className="player-card-kicker">Turnovers</p>
                <h2>Ball security</h2>
              </div>
              <strong>{formatNumber(totals.turnovers)}</strong>
            </div>
            <div className="metric-lines">
              {turnoverMetrics.map((metric) => (
                <MetricLineCard key={metric.label} metric={metric} maxValue={turnoverMax} />
              ))}
            </div>
          </article>
        </section>

        <section className="panel player-breakdown-section">
          <div className="panel-inner player-breakdown-head">
            <h3>Match history</h3>
            <p>{activeFilterId === "all" ? "Showing every match appearance with the impact split by phase." : "Showing the selected match only."}</p>
          </div>
          <div className="panel-inner manager-table manager-table-shell">
            <SortableTable rows={breakdownRows} columns={columns} getRowKey={(row) => row.key} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MetricLineCard({
  metric,
  maxValue,
  formatValue = formatNumber
}: {
  metric: MetricLine;
  maxValue: number;
  formatValue?: (value: number) => string;
}) {
  const width = Math.max(0, Math.min(100, safeDivide(metric.value, maxValue) * 100));
  const fillStyle = metric.accent === "blue" ? { background: "linear-gradient(90deg, #6f83c7 0%, #90a3eb 100%)" } : undefined;

  return (
    <div className={`metric-line player-metric-line player-metric-${metric.accent ?? "gold"}`}>
      <div className="label-row">
        <span>{metric.label}</span>
        <span>{formatValue(metric.value)}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${width}%`, ...fillStyle }} />
      </div>
    </div>
  );
}

function HistoryMetricCell({ value, bars, accent = "gold" }: { value: number; bars: number[]; accent?: "gold" | "blue" }) {
  return (
    <div className={`manager-metric-cell manager-metric-${accent}`}>
      <strong>{formatNumber(value)}</strong>
      <div className="manager-mini-bars" aria-hidden="true">
        {bars.map((bar, index) => (
          <span key={`${accent}-${index}`} style={{ height: `${bar}%` }} />
        ))}
      </div>
    </div>
  );
}

function sumBy(items: MatchStatRecord[], accessor: (item: MatchStatRecord) => number): number {
  return items.reduce((total, item) => total + accessor(item), 0);
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
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

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function buildMiniBarValues(values: number[]): number[] {
  const source = values.length ? values : [0, 0, 0, 0];
  const normalized = source.slice(0, 6);
  while (normalized.length < 6) normalized.push(0);
  const max = Math.max(...normalized, 1);
  return normalized.map((value) => 28 + Math.round((Math.max(0, value) / max) * 72));
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "P";
}

function getMatchBadge(label: string): string {
  const match = label.match(/AFL\s*\d+/i);
  if (match) return match[0].replace(/\s+/g, "");
  return label.slice(0, 3).toUpperCase();
}

