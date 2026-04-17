import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { LoadingCard } from "@/components/LoadingCard";
import { SortableTable, type SortableTableColumn } from "@/components/SortableTable";
import { useAuth } from "@/auth/AuthContext";
import { getSnapshot, refreshSnapshot, SNAPSHOT_CACHE_UPDATED_EVENT } from "@/api/client";
import { buildMatchOrder, buildSparklineBars } from "@/data/performanceModel";
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
  kickoutImpact: number;
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

type TrendCard = {
  label: string;
  total: number;
  accent?: "gold" | "blue";
  sparkline: ReturnType<typeof buildSparklineBars>;
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

  const allPlayerRecords = snapshot.records.filter((record) => record.playerId === playerId).sort(sortByDateThenMatch);
  const filteredRecords = activeFilterId === "all" ? allPlayerRecords : allPlayerRecords.filter((record) => record.matchId === activeFilterId);
  const player = snapshot.players[playerId] ?? (allPlayerRecords[0] ? { playerId, name: allPlayerRecords[0].playerName, number: "", position: "" } : null);

  if (!player) {
    return (
      <AppShell title="Player Detail">
        <div className="panel error">No player data available for this player.</div>
      </AppShell>
    );
  }

  const seasonTotals = buildTotals(allPlayerRecords);
  const visibleTotals = buildTotals(filteredRecords);
  const hasVisibleStats = filteredRecords.length > 0;
  const matchOrder = buildMatchOrder(allPlayerRecords);

  const breakdownRows: BreakdownRow[] = filteredRecords.map((record) => ({
    key: record.key,
    matchLabel: record.matchLabel,
    date: record.date,
    totalImpact: record.totalImpact,
    attackImpact: record.attackImpact,
    transitionImpact: record.transitionImpact,
    defenseImpact: record.defenseImpact,
    kickoutImpact: record.kickoutImpact,
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
    { label: "Season Total Impact", value: seasonTotals.totalImpact, subtitle: "Attack + Transition + Defence across all matches" },
    { label: "Season Attack", value: seasonTotals.attackImpact, subtitle: "Weighted attack total" },
    { label: "Season Transition", value: seasonTotals.transitionImpact, subtitle: "Weighted transition total" },
    { label: "Season Defence", value: seasonTotals.defenseImpact, subtitle: "Weighted defence total" },
    { label: "Season Kick Outs", value: seasonTotals.kickoutImpact, subtitle: "Weighted kickout contribution" }
  ];

  const totalMetrics: MetricLine[] = [
    { label: "Total Impact", value: seasonTotals.totalImpact },
    { label: "Appearances", value: seasonTotals.appearances },
    { label: "Minutes", value: seasonTotals.minutes },
    { label: "Visible Impact", value: visibleTotals.totalImpact },
    { label: "Visible Minutes", value: visibleTotals.minutes }
  ];

  const attackMetrics: MetricLine[] = [
    { label: "Attack Impact", value: seasonTotals.attackImpact },
    { label: "Points", value: seasonTotals.points },
    { label: "Goals", value: seasonTotals.goals },
    { label: "1-Pointers", value: seasonTotals.onePointers },
    { label: "2-Pointers", value: seasonTotals.twoPointers },
    { label: "Frees Scored", value: seasonTotals.frees },
    { label: "Assists", value: seasonTotals.assists }
  ];

  const transitionMetrics: MetricLine[] = [
    { label: "Transition Impact", value: seasonTotals.transitionImpact },
    { label: "Simple Pass", value: seasonTotals.simplePass },
    { label: "Advance Pass", value: seasonTotals.advancePass },
    { label: "Carries", value: seasonTotals.carries },
    { label: "Assist Shots", value: seasonTotals.assistsShots },
    { label: "Assist Goals", value: seasonTotals.assistsGoals }
  ];

  const defenceMetrics: MetricLine[] = [
    { label: "Defence Impact", value: seasonTotals.defenseImpact, accent: "blue" },
    { label: "Tackles", value: seasonTotals.tackles },
    { label: "Duels Contested", value: seasonTotals.duelsContested },
    { label: "Duels Lost", value: seasonTotals.duelsLost },
    { label: "Force TO Win", value: seasonTotals.forceTurnoverWin }
  ];

  const kickoutMetrics: MetricLine[] = [
    { label: "Kickout Impact", value: seasonTotals.kickoutImpact },
    { label: "KO % OUR", value: safeDivide(seasonTotals.koWinsOur, seasonTotals.koContestsOur) * 100 },
    { label: "OUR Contests", value: seasonTotals.koContestsOur },
    { label: "OUR Wins", value: seasonTotals.koWinsOur },
    { label: "KO % OPP", value: safeDivide(seasonTotals.koWinsOpp, seasonTotals.koContestsOpp) * 100, accent: "blue" },
    { label: "OPP Wins", value: seasonTotals.koWinsOpp }
  ];

  const totalMax = Math.max(...totalMetrics.map((item) => item.value), 1);
  const attackMax = Math.max(...attackMetrics.map((item) => item.value), 1);
  const transitionMax = Math.max(...transitionMetrics.map((item) => item.value), 1);
  const defenceMax = Math.max(...defenceMetrics.map((item) => item.value), 1);
  const kickoutMax = Math.max(...kickoutMetrics.map((item) => item.value), 100);
  const trendCards: TrendCard[] = [
    {
      label: "Total Impact",
      total: seasonTotals.totalImpact,
      sparkline: buildSparklineBars(new Map(allPlayerRecords.map((record) => [record.matchId, record.totalImpact])), matchOrder)
    },
    {
      label: "Attack",
      total: seasonTotals.attackImpact,
      sparkline: buildSparklineBars(new Map(allPlayerRecords.map((record) => [record.matchId, record.attackImpact])), matchOrder)
    },
    {
      label: "Transition",
      total: seasonTotals.transitionImpact,
      sparkline: buildSparklineBars(new Map(allPlayerRecords.map((record) => [record.matchId, record.transitionImpact])), matchOrder)
    },
    {
      label: "Defence",
      total: seasonTotals.defenseImpact,
      accent: "blue",
      sparkline: buildSparklineBars(new Map(allPlayerRecords.map((record) => [record.matchId, record.defenseImpact])), matchOrder)
    }
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
      minWidth: "17rem",
      maxWidth: "22rem",
      truncate: true,
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
    numericColumn("totalImpact", "Total Impact", (row) => row.totalImpact),
    numericColumn("attackImpact", "Attack", (row) => row.attackImpact),
    numericColumn("transitionImpact", "Transition", (row) => row.transitionImpact),
    numericColumn("defenseImpact", "Defence", (row) => row.defenseImpact),
    { id: "kickoutImpact", label: "Kick Outs", minWidth: "8rem", sortAccessor: (row) => row.kickoutImpact, cell: (row) => formatNumber(row.kickoutImpact), headerClassName: "num", cellClassName: "num" },
    { id: "minutes", label: "Minutes", minWidth: "7rem", sortAccessor: (row) => row.minutes, cell: (row) => formatNumber(row.minutes), headerClassName: "num", cellClassName: "num" }
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
            <p className="player-page-meta">Season totals stay fixed to the full campaign. The match filter only changes the per-game breakdown below.</p>
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

        {hasVisibleStats ? (
          <>
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
                    <p className="player-card-kicker">Season Total</p>
                    <h2>Overall impact</h2>
                  </div>
                  <strong>{formatNumber(seasonTotals.totalImpact)}</strong>
                </div>
                <div className="metric-lines">
                  {totalMetrics.map((metric) => (
                    <MetricLineCard key={metric.label} metric={metric} maxValue={totalMax} />
                  ))}
                </div>
              </article>

              <article className="panel player-card">
                <div className="player-card-head">
                  <div>
                    <p className="player-card-kicker">Attack</p>
                    <h2>Output and scoring</h2>
                  </div>
                  <strong>{formatNumber(seasonTotals.attackImpact)}</strong>
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
                  <strong>{formatNumber(seasonTotals.transitionImpact)}</strong>
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
                  <strong>{formatNumber(seasonTotals.defenseImpact)}</strong>
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
                  <strong>{formatNumber(seasonTotals.kickoutImpact)}</strong>
                </div>
                <div className="metric-lines">
                  {kickoutMetrics.map((metric) => (
                    <MetricLineCard key={metric.label} metric={metric} maxValue={kickoutMax} formatValue={metric.label.includes("%") ? formatPercent : formatNumber} />
                  ))}
                </div>
              </article>
            </section>

            <section className="panel player-trend-section">
              <div className="panel-inner player-breakdown-head">
                <h3>Season Trend</h3>
                <p>Each bar is one game in order. Hover to see the match and value. The selected match stays highlighted.</p>
              </div>
              <div className="player-trend-grid">
                {trendCards.map((card) => (
                  <article key={card.label} className="panel-inner player-trend-card">
                    <div className="player-trend-head">
                      <p className="player-card-kicker">{card.label}</p>
                      <strong className={card.accent === "blue" ? "player-trend-total player-trend-total-blue" : "player-trend-total"}>
                        {formatNumber(card.total)}
                      </strong>
                    </div>
                    <div className={`leader-mini-bar player-trend-bars ${card.accent === "blue" ? "player-trend-blue" : ""}`} aria-label={`${card.label} season trend`}>
                      {card.sparkline.map((bar, index) => (
                        <span
                          key={`${card.label}-${bar.label}-${index}`}
                          className={`${bar.empty ? "empty" : ""} ${activeFilterId !== "all" && bar.matchId === activeFilterId ? "selected" : ""}`.trim()}
                          style={{ height: `${Math.max(18, bar.height)}%` }}
                          title={bar.value == null ? `${bar.label}: not played` : `${bar.label}: ${formatNumber(bar.value)}`}
                        />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel player-breakdown-section">
              <div className="panel-inner player-breakdown-head">
                <h3>Per-game breakdown</h3>
                <p>{activeFilterId === "all" ? "Showing every match appearance with category values by game." : "Showing the selected match only with clear category values."}</p>
              </div>
              <div className="panel-inner manager-table manager-table-shell">
                <SortableTable rows={breakdownRows} columns={columns} getRowKey={(row) => row.key} />
              </div>
            </section>
          </>
        ) : (
          <section className="panel player-empty-state" role="status">
            <div className="panel-inner player-breakdown-head">
              <h3>No stats available</h3>
              <p>This player did not appear in the selected match, so there are no stats to display.</p>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function numericColumn<T extends BreakdownRow>(
  id: string,
  label: string,
  accessor: (row: T) => number,
  minWidth = "8rem"
): SortableTableColumn<T> {
  return {
    id,
    label,
    sortAccessor: accessor,
    cell: (row) => formatNumber(accessor(row)),
    headerClassName: "num",
    cellClassName: "num",
    minWidth
  };
}

function buildTotals(records: MatchStatRecord[]) {
  return {
    appearances: records.length,
    minutes: sumBy(records, (record) => record.totalMinutes),
    points: sumBy(records, (record) => record.pts),
    goals: sumBy(records, (record) => record.goalsScored),
    onePointers: sumBy(records, (record) => record.onePointerScored),
    twoPointers: sumBy(records, (record) => record.twoPointerScored),
    frees: sumBy(records, (record) => record.freeOnePointerScored + record.freeTwoPointerScored + record.freeGoalsScored),
    tackles: sumBy(records, (record) => record.tackles),
    duelsContested: sumBy(records, (record) => record.duelsContested),
    duelsLost: sumBy(records, (record) => record.duelsLost),
    simplePass: sumBy(records, (record) => record.simplePass),
    advancePass: sumBy(records, (record) => record.advancePass),
    carries: sumBy(records, (record) => record.carries),
    turnovers: sumBy(records, (record) => record.turnovers),
    turnoversInContact: sumBy(records, (record) => record.turnoversInContact),
    turnoverSkillError: sumBy(records, (record) => record.turnoverSkillError),
    turnoversKickedAway: sumBy(records, (record) => record.turnoversKickedAway),
    forceTurnoverWin: sumBy(records, (record) => record.forceTurnoverWin),
    assists: sumBy(records, (record) => record.assists),
    assistsShots: sumBy(records, (record) => record.assistsShots),
    assistsGoals: sumBy(records, (record) => record.assistsGoals),
    attackImpact: sumBy(records, (record) => record.attackImpact),
    transitionImpact: sumBy(records, (record) => record.transitionImpact),
    defenseImpact: sumBy(records, (record) => record.defenseImpact),
    kickoutImpact: sumBy(records, (record) => record.kickoutImpact),
    totalImpact: sumBy(records, (record) => record.totalImpact),
    koWinsOur: sumBy(records, (record) => record.koWinsOur),
    koContestsOur: sumBy(records, (record) => record.koContestsOur),
    koWinsOpp: sumBy(records, (record) => record.koWinsOpp),
    koContestsOpp: sumBy(records, (record) => record.koContestsOpp)
  };
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "P";
}

function getMatchBadge(label: string): string {
  const match = label.match(/AFL\s*\d+/i);
  if (match) return match[0].replace(/\s+/g, "");
  return label.slice(0, 3).toUpperCase();
}
