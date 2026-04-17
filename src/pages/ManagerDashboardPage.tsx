import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { LoadingCard } from "@/components/LoadingCard";
import { SortableTable, type SortableTableColumn } from "@/components/SortableTable";
import { useAuth } from "@/auth/AuthContext";
import { getSnapshot, refreshSnapshot, SNAPSHOT_CACHE_UPDATED_EVENT } from "@/api/client";
import {
  aggregatePlayerRecords,
  buildMatchOrder,
  type AggregatedPlayerRow
} from "@/data/performanceModel";
import type { MatchStatRecord, SnapshotResponse } from "@/types";

const DATA_ERROR_MESSAGE = "Unable to load data. Please check your API key or connection.";
const dashboardTabs = ["All Impact", "Attack", "Transition", "Defence", "Turnovers", "Kick Outs"] as const;
type DashboardTab = (typeof dashboardTabs)[number];

type SummaryCard = {
  label: string;
  value: string;
  subtitle: string;
};

type LeaderCard = {
  title: string;
  playerName: string;
  value: number;
  rounds: Array<{ label: string; value: number }>;
  subtitle: string;
};

export function ManagerDashboardPage() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchFilter, setActiveMatchFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<DashboardTab>("All Impact");

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
    setActiveMatchFilter((current) => (options.includes(current) ? current : "all"));
  }, [snapshot]);

  const allRecords = snapshot?.records ?? [];
  const visibleRecords = useMemo(
    () => (activeMatchFilter === "all" ? allRecords : allRecords.filter((record) => record.matchId === activeMatchFilter)),
    [allRecords, activeMatchFilter]
  );
  const matchOrder = useMemo(() => buildMatchOrder(allRecords), [allRecords]);
  const aggregatedRows = useMemo(() => aggregatePlayerRecords(visibleRecords, allRecords, matchOrder), [visibleRecords, allRecords, matchOrder]);
  const sortedRows = useMemo(() => sortRowsForTab(aggregatedRows, activeTab), [aggregatedRows, activeTab]);
  const summaryCards = useMemo(() => buildSummaryCards(visibleRecords, sortedRows), [visibleRecords, sortedRows]);
  const topPerformers = useMemo(() => buildLeaderCards(sortedRows), [sortedRows]);
  const columns = useMemo(() => buildColumns(activeTab), [activeTab]);

  if (!session) return null;

  return (
    <AppShell title="Manager Dashboard">
      {!snapshot && !error && <LoadingCard label="Loading snapshot" />}
      {error && (
        <section className="panel fetch-status-card" role="alert">
          <h2>Unable to load data. Please check your API key or connection.</h2>
          <p className="fetch-status-detail">{error}</p>
          <button type="button" className="fetch-retry-btn" onClick={() => void refreshSnapshot(session)}>
            Refresh Data
          </button>
        </section>
      )}
      {snapshot && !error && (
        <div className="dashboard-wrap panel manager-dashboard-shell">
          <section className="dashboard-toolbar">
            <div>
              <p className="toolbar-kicker">Manager Dashboard</p>
              <h2 className="toolbar-title manager-dashboard-title">Staff performance view with live Excel scoring and shared season aggregates</h2>
            </div>
            <div className="filter-toolbar-row">
              <label className="filter-select-inline">
                <span className="filter-select-label">Match</span>
                <select className="filter-select" aria-label="Manager dashboard match filter" value={activeMatchFilter} onChange={(event) => setActiveMatchFilter(event.target.value)}>
                  {snapshot.filters.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="kpi-grid">
            {summaryCards.map((card, index) => (
              <article key={card.label} className={`kpi-card panel-inner kpi-card-${index + 1}`}>
                <h3>{card.label}</h3>
                <p className="kpi-value">{card.value}</p>
                <span>{card.subtitle}</span>
              </article>
            ))}
          </section>

          <section className="panel-inner dashboard-section-heading">
            <div className="tabs-row" role="tablist" aria-label="Manager dashboard tabs">
              {dashboardTabs.map((tab) => (
                <button key={tab} type="button" className={activeTab === tab ? "tab active" : "tab"} onClick={() => setActiveTab(tab)}>
                  {tab}
                </button>
              ))}
            </div>
          </section>

          <section className="table panel-inner manager-table manager-table-shell">
            <SortableTable rows={sortedRows} columns={columns} getRowKey={(row) => row.playerId} />
          </section>

          <section className="panel-inner player-breakdown-head">
            <h3>Season Trends</h3>
            <p>These cards show the leading player in each phase and how their values moved across recent matches.</p>
          </section>

          <section className="performers-grid">
            {topPerformers.map((top) => (
              <article className="performer panel-inner" key={top.title}>
                <h4>{top.title}</h4>
                <p>{top.playerName}</p>
                <strong>{formatNumber(top.value)}</strong>
                <small className="performer-subtitle">{top.subtitle}</small>
                <div className="leader-mini-bar" aria-label={`${top.title} per-game trend`}>
                  {buildMiniBarValues(top.rounds.map((round) => round.value)).map((bar, index) => (
                    <span key={`${top.title}-bar-${index}`} style={{ height: `${bar}%` }} title={`${top.rounds[index]?.label ?? `AFL ${index + 1}`}: ${formatNumber(top.rounds[index]?.value ?? 0)}`} />
                  ))}
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function buildSummaryCards(records: MatchStatRecord[], rows: AggregatedPlayerRow[]): SummaryCard[] {
  const matchesPlayed = new Set(records.map((record) => record.matchId)).size || 1;
  const koOurWins = records.reduce((sum, record) => sum + record.koWinsOur, 0);
  const koOurContests = records.reduce((sum, record) => sum + record.koContestsOur, 0);

  return [
    {
      label: "Total Impact",
      value: formatNumber(rows.reduce((sum, row) => sum + row.totalImpact, 0)),
      subtitle: "Visible squad season impact"
    },
    {
      label: "Attack Impact",
      value: formatNumber(rows.reduce((sum, row) => sum + row.attackImpact, 0)),
      subtitle: "Weighted attack contribution"
    },
    {
      label: "Defence Impact",
      value: formatNumber(rows.reduce((sum, row) => sum + row.defenseImpact, 0)),
      subtitle: "Weighted defence contribution"
    },
    {
      label: "KO % OUR",
      value: `${Math.round(safeDivide(koOurWins, koOurContests) * 100)}%`,
      subtitle: `Across ${matchesPlayed} visible match${matchesPlayed === 1 ? "" : "es"}`
    }
  ];
}

function buildLeaderCards(rows: AggregatedPlayerRow[]): LeaderCard[] {
  return [
    buildLeaderCard(rows, "Top Total Impact", "Best overall output", (row) => row.totalImpact, (trend) => trend.totalImpact),
    buildLeaderCard(rows, "Top Attack Impact", "Best attack profile", (row) => row.attackImpact, (trend) => trend.attackImpact),
    buildLeaderCard(rows, "Top Transition Impact", "Best transition profile", (row) => row.transitionImpact, (trend) => trend.transitionImpact),
    buildLeaderCard(rows, "Top Defence Impact", "Best defence profile", (row) => row.defenseImpact, (trend) => trend.defenseImpact)
  ];
}

function buildLeaderCard(
  rows: AggregatedPlayerRow[],
  title: string,
  subtitle: string,
  accessor: (row: AggregatedPlayerRow) => number,
  trendAccessor: (trend: AggregatedPlayerRow["matchTrend"][number]) => number
): LeaderCard {
  const winner = rows.slice().sort((left, right) => accessor(right) - accessor(left) || left.name.localeCompare(right.name))[0];
  return {
    title,
    playerName: winner?.name ?? "-",
    value: winner ? accessor(winner) : 0,
    rounds: winner
      ? winner.matchTrend.slice(-6).map((trend) => ({
          label: trend.matchLabel,
          value: trendAccessor(trend)
        }))
      : [],
    subtitle
  };
}

function buildColumns(activeTab: DashboardTab): Array<SortableTableColumn<AggregatedPlayerRow>> {
  const playerColumn: SortableTableColumn<AggregatedPlayerRow> = {
    id: "name",
    label: "Player",
    minWidth: "18rem",
    maxWidth: "24rem",
    truncate: true,
    sortAccessor: (row) => row.name,
    cell: (row, index) => (
      <div className={`manager-player-cell ${activeTab === "All Impact" ? "manager-player-cell-featured" : ""}`}>
        <span className="manager-player-rank">{index + 1}</span>
        <span className="manager-player-avatar" aria-hidden="true">{getInitials(row.name)}</span>
        <span className="manager-player-meta">
          <Link to={`/player/${row.playerId}`} className="manager-player-link">{row.name}</Link>
          <small>{row.gamesPlayed} games / {formatNumber(row.totalMinutes)} min</small>
        </span>
      </div>
    )
  };

  const numeric = (
    id: string,
    label: string,
    accessor: (row: AggregatedPlayerRow) => number,
    formatter: (value: number) => string = formatNumber,
    minWidth = "8rem"
  ): SortableTableColumn<AggregatedPlayerRow> => ({
    id,
    label,
    sortAccessor: accessor,
    cell: (row) => formatter(accessor(row)),
    headerClassName: "num",
    cellClassName: "num",
    minWidth
  });

  switch (activeTab) {
    case "Attack":
      return [
        playerColumn,
        numeric("attackImpact", "Attack", (row) => row.attackImpact),
        numeric("attackImpact60", "ATT 60", (row) => per60(row.attackImpact, row.totalMinutes)),
        numeric("onePointScored", "1PT", (row) => row.onePointScored),
        numeric("twoPointScored", "2PT", (row) => row.twoPointScored),
        numeric("goalsScored", "Goals", (row) => row.goalsScored),
        numeric("freeScores", "Frees", (row) => row.freeScores)
      ];
    case "Transition":
      return [
        playerColumn,
        numeric("transitionImpact", "Transition", (row) => row.transitionImpact),
        numeric("transitionImpact60", "TRANS 60", (row) => per60(row.transitionImpact, row.totalMinutes)),
        numeric("simplePass", "Simple Pass", (row) => row.simplePass),
        numeric("advancePass", "Advance Pass", (row) => row.advancePass),
        numeric("carries", "Carries", (row) => row.carries),
        numeric("turnovers", "Turnovers", (row) => row.turnovers)
      ];
    case "Defence":
      return [
        playerColumn,
        numeric("defenseImpact", "Defence", (row) => row.defenseImpact),
        numeric("defenseImpact60", "DEF 60", (row) => per60(row.defenseImpact, row.totalMinutes)),
        numeric("tackles", "Tackles", (row) => row.tackles),
        numeric("duelsContested", "Duels", (row) => row.duelsContested),
        numeric("duelsLost", "Duels Lost", (row) => row.duelsLost),
        numeric("forceTurnoverWin", "Forced TO", (row) => row.forceTurnoverWin)
      ];
    case "Turnovers":
      return [
        playerColumn,
        numeric("turnoverImpact", "TO Score", (row) => row.turnoverImpact),
        numeric("forceTurnoverWin", "Forced TO", (row) => row.forceTurnoverWin),
        numeric("turnoversInContact", "Contact TO", (row) => row.turnoversInContact),
        numeric("turnoverSkillError", "Skill Error TO", (row) => row.turnoverSkillError),
        numeric("turnoversKickedAway", "Kick Away TO", (row) => row.turnoversKickedAway)
      ];
    case "Kick Outs":
      return [
        playerColumn,
        numeric("kickoutImpact", "KO Score", (row) => row.kickoutImpact),
        numeric("koContestsOur", "Our KO", (row) => row.koContestsOur),
        numeric("koOurPct", "Our KO %", (row) => safeDivide(row.koWinsOur, row.koContestsOur) * 100, formatPercent),
        numeric("koContestsOpp", "Opp KO", (row) => row.koContestsOpp),
        numeric("koOppPct", "Opp KO %", (row) => safeDivide(row.koWinsOpp, row.koContestsOpp) * 100, formatPercent)
      ];
    case "All Impact":
    default:
      return [
        playerColumn,
        numeric("totalImpact", "Total Impact", (row) => row.totalImpact),
        numeric("attackImpact60", "ATT 60", (row) => per60(row.attackImpact, row.totalMinutes)),
        numeric("transitionImpact60", "TRANS 60", (row) => per60(row.transitionImpact, row.totalMinutes)),
        numeric("defenseImpact60", "DEF 60", (row) => per60(row.defenseImpact, row.totalMinutes)),
        numeric("koOurPct", "KO OUR %", (row) => safeDivide(row.koWinsOur, row.koContestsOur) * 100, formatPercent),
        numeric("koOppPct", "KO OPP %", (row) => safeDivide(row.koWinsOpp, row.koContestsOpp) * 100, formatPercent),
        {
          id: "form",
          label: "Form",
          minWidth: "12rem",
          sortAccessor: (row) => row.formLast3 ?? row.formSeason ?? -1,
          cell: (row) => <FormCell last3={row.formLast3} season={row.formSeason} />,
          headerClassName: "num",
          cellClassName: "num"
        }
      ];
  }
}

function FormCell({ last3, season }: { last3: number | null; season: number | null }) {
  if (last3 == null || season == null) {
    return <span className="manager-form-na">N/A</span>;
  }

  return (
    <div className="manager-form-cell">
      <FormMetric value={last3} />
      <FormMetric value={season} />
    </div>
  );
}

function FormMetric({ value }: { value: number }) {
  const delta = Math.max(-100, Math.min(100, value - 100));
  const width = Math.max(6, Math.min(100, Math.abs(delta)));
  const side = delta >= 0 ? "right" : "left";
  const tone = delta >= 0 ? "amber" : "blue";

  return (
    <div className="manager-form-metric" title={`${formatPercent(value)} vs team average`}>
      <span className={`manager-form-value ${tone === "amber" ? "" : "manager-percent-blue"}`}>{formatPercent(value)}</span>
      <div className="manager-form-bar" aria-hidden="true">
        <i className="manager-form-center" />
        <b className={`manager-form-fill ${side} ${tone}`} style={{ width: `${width / 2}%` }} />
      </div>
    </div>
  );
}

function sortRowsForTab(rows: AggregatedPlayerRow[], activeTab: DashboardTab): AggregatedPlayerRow[] {
  const accessor: Record<DashboardTab, (row: AggregatedPlayerRow) => number> = {
    "All Impact": (row) => row.totalImpact,
    Attack: (row) => row.attackImpact,
    Transition: (row) => row.transitionImpact,
    Defence: (row) => row.defenseImpact,
    Turnovers: (row) => row.turnoverImpact,
    "Kick Outs": (row) => row.kickoutImpact
  };

  return rows.slice().sort((left, right) => accessor[activeTab](right) - accessor[activeTab](left) || left.name.localeCompare(right.name));
}

function buildMiniBarValues(values: number[]): number[] {
  const source = values.length ? values : [0, 0, 0, 0];
  const normalized = source.slice(0, 6);
  while (normalized.length < 6) normalized.push(0);
  const max = Math.max(...normalized.map((value) => Math.abs(value)), 1);
  return normalized.map((value) => 28 + Math.round((Math.abs(value) / max) * 72));
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "P";
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

function per60(value: number, minutes: number): number {
  return safeDivide(value, minutes) * 60;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}
