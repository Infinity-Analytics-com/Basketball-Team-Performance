import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { LoadingCard } from "@/components/LoadingCard";
import { SortableTable, type SortableTableColumn } from "@/components/SortableTable";
import { useAuth } from "@/auth/AuthContext";
import { getSnapshot, refreshSnapshot, SNAPSHOT_CACHE_UPDATED_EVENT } from "@/api/client";
import type { MatchStatRecord, SnapshotResponse } from "@/types";

const DATA_ERROR_MESSAGE = "Unable to load data. Please check your API key or connection.";
const dashboardTabs = ["All Impact", "Attack", "Transition", "Defence", "Turnovers", "Kick Outs"] as const;
type DashboardTab = (typeof dashboardTabs)[number];

type AggregatedPlayerRow = {
  playerId: string;
  name: string;
  gamesPlayed: number;
  totalMinutes: number;
  totalImpact: number;
  attackImpact: number;
  transitionImpact: number;
  defenseImpact: number;
  onePointAtt: number;
  onePointScored: number;
  twoPointAtt: number;
  twoPointScored: number;
  goalAtt: number;
  goalsScored: number;
  freeScores: number;
  assists: number;
  simplePass: number;
  advancePass: number;
  carries: number;
  turnovers: number;
  turnoversInContact: number;
  turnoverSkillError: number;
  turnoversKickedAway: number;
  forceTurnoverWin: number;
  tackles: number;
  duelsContested: number;
  duelsLost: number;
  koWinsOur: number;
  koContestsOur: number;
  koWinsOpp: number;
  koContestsOpp: number;
  matchTrend: Array<{ matchId: string; totalImpact: number; attackImpact: number; transitionImpact: number; defenseImpact: number }>;
};

type SummaryCard = {
  label: string;
  value: string;
  subtitle: string;
};

type LeaderCard = {
  title: string;
  playerName: string;
  value: number;
  rounds: number[];
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

  const visibleRecords = useMemo(
    () => (activeMatchFilter === "all" ? snapshot?.records ?? [] : (snapshot?.records ?? []).filter((record) => record.matchId === activeMatchFilter)),
    [snapshot, activeMatchFilter]
  );
  const aggregatedRows = useMemo(() => aggregateRows(visibleRecords), [visibleRecords]);
  const summaryCards = useMemo(() => buildSummaryCards(visibleRecords, aggregatedRows), [visibleRecords, aggregatedRows]);
  const topPerformers = useMemo(() => buildLeaderCards(aggregatedRows), [aggregatedRows]);
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
              <h2 className="toolbar-title manager-dashboard-title">Staff performance view with the six coaching tabs requested in the meeting</h2>
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
            <SortableTable rows={aggregatedRows} columns={columns} getRowKey={(row) => row.playerId} />
          </section>

          <section className="performers-grid">
            {topPerformers.map((top) => (
              <article className="performer panel-inner" key={top.title}>
                <h4>{top.title}</h4>
                <p>{top.playerName}</p>
                <strong>{formatNumber(top.value)}</strong>
                <small className="performer-subtitle">{top.subtitle}</small>
                <div className="leader-mini-bar" aria-hidden="true">
                  {buildMiniBarValues(top.rounds).map((bar, index) => (
                    <span key={`${top.title}-bar-${index}`} style={{ height: `${bar}%` }} />
                  ))}
                </div>
                <div className="round-strip">
                  {top.rounds.map((value, index) => (
                    <span key={`${top.title}-${index}`}>{top.rounds.length ? `AFL ${index + 1}` : "AFL"} {formatNumber(value)}</span>
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

function aggregateRows(records: MatchStatRecord[]): AggregatedPlayerRow[] {
  const byPlayer = new Map<string, AggregatedPlayerRow & { matchIds: Set<string> }>();

  for (const record of records) {
    const current = byPlayer.get(record.playerId) ?? {
      playerId: record.playerId,
      name: record.playerName,
      gamesPlayed: 0,
      totalMinutes: 0,
      totalImpact: 0,
      attackImpact: 0,
      transitionImpact: 0,
      defenseImpact: 0,
      onePointAtt: 0,
      onePointScored: 0,
      twoPointAtt: 0,
      twoPointScored: 0,
      goalAtt: 0,
      goalsScored: 0,
      freeScores: 0,
      assists: 0,
      simplePass: 0,
      advancePass: 0,
      carries: 0,
      turnovers: 0,
      turnoversInContact: 0,
      turnoverSkillError: 0,
      turnoversKickedAway: 0,
      forceTurnoverWin: 0,
      tackles: 0,
      duelsContested: 0,
      duelsLost: 0,
      koWinsOur: 0,
      koContestsOur: 0,
      koWinsOpp: 0,
      koContestsOpp: 0,
      matchTrend: [],
      matchIds: new Set<string>()
    };

    current.matchIds.add(record.matchId);
    current.totalMinutes += record.totalMinutes;
    current.totalImpact += record.totalImpact;
    current.attackImpact += record.attackImpact;
    current.transitionImpact += record.transitionImpact;
    current.defenseImpact += record.defenseImpact;
    current.onePointAtt += record.onePointerAttempts;
    current.onePointScored += record.onePointerScored;
    current.twoPointAtt += record.twoPointerAttempts;
    current.twoPointScored += record.twoPointerScored;
    current.goalAtt += record.goalAttempts;
    current.goalsScored += record.goalsScored;
    current.freeScores += record.freeOnePointerScored + record.freeTwoPointerScored + record.freeGoalsScored;
    current.assists += record.assists;
    current.simplePass += record.simplePass;
    current.advancePass += record.advancePass;
    current.carries += record.carries;
    current.turnovers += record.turnovers;
    current.turnoversInContact += record.turnoversInContact;
    current.turnoverSkillError += record.turnoverSkillError;
    current.turnoversKickedAway += record.turnoversKickedAway;
    current.forceTurnoverWin += record.forceTurnoverWin;
    current.tackles += record.tackles;
    current.duelsContested += record.duelsContested;
    current.duelsLost += record.duelsLost;
    current.koWinsOur += record.koWinsOur;
    current.koContestsOur += record.koContestsOur;
    current.koWinsOpp += record.koWinsOpp;
    current.koContestsOpp += record.koContestsOpp;
    current.matchTrend.push({
      matchId: record.matchId,
      totalImpact: record.totalImpact,
      attackImpact: record.attackImpact,
      transitionImpact: record.transitionImpact,
      defenseImpact: record.defenseImpact
    });

    byPlayer.set(record.playerId, current);
  }

  return Array.from(byPlayer.values())
    .map(({ matchIds, ...row }) => ({ ...row, gamesPlayed: matchIds.size }))
    .sort((left, right) => right.totalImpact - left.totalImpact || left.name.localeCompare(right.name));
}

function buildSummaryCards(records: MatchStatRecord[], rows: AggregatedPlayerRow[]): SummaryCard[] {
  const matchesPlayed = new Set(records.map((record) => record.matchId)).size || 1;
  const koOurWins = records.reduce((sum, record) => sum + record.koWinsOur, 0);
  const koOurContests = records.reduce((sum, record) => sum + record.koContestsOur, 0);
  const koOppWins = records.reduce((sum, record) => sum + record.koWinsOpp, 0);
  const koOppContests = records.reduce((sum, record) => sum + record.koContestsOpp, 0);

  return [
    {
      label: "All Impact",
      value: formatNumber(rows.reduce((sum, row) => sum + row.totalImpact, 0) / (rows.length || 1)),
      subtitle: "Average overall impact across players"
    },
    {
      label: "TO Per Game",
      value: formatNumber(records.reduce((sum, record) => sum + record.forceTurnoverWin + record.turnoversKickedAway, 0) / matchesPlayed),
      subtitle: "Force Turnover Win + Kick Away Turnover"
    },
    {
      label: "KO % OUR",
      value: `${Math.round(safeDivide(koOurWins, koOurContests) * 100)}%`,
      subtitle: "Our kickout win rate"
    },
    {
      label: "KO % OPP",
      value: `${Math.round(safeDivide(koOppWins, koOppContests) * 100)}%`,
      subtitle: "Opposition kickout win rate"
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
    rounds: winner ? winner.matchTrend.slice(0, 4).map((trend) => trendAccessor(trend)) : [],
    subtitle
  };
}

function buildColumns(activeTab: DashboardTab): Array<SortableTableColumn<AggregatedPlayerRow>> {
  const playerColumn: SortableTableColumn<AggregatedPlayerRow> = {
    id: "name",
    label: "Player",
    sortAccessor: (row) => row.name,
    cell: (row, index) => (
      <div className="manager-player-cell">
        <span className="manager-player-rank">{index + 1}</span>
        <span className="manager-player-avatar" aria-hidden="true">{getInitials(row.name)}</span>
        <span className="manager-player-meta">
          <Link to={`/player/${row.playerId}`} className="manager-player-link">{row.name}</Link>
          <small>{row.gamesPlayed} games • {formatNumber(row.totalMinutes)} min</small>
        </span>
      </div>
    )
  };

  const numeric = (
    id: string,
    label: string,
    accessor: (row: AggregatedPlayerRow) => number,
    formatter: (value: number) => string = formatNumber
  ): SortableTableColumn<AggregatedPlayerRow> => ({
    id,
    label,
    sortAccessor: accessor,
    cell: (row) => formatter(accessor(row)),
    headerClassName: "num",
    cellClassName: "num"
  });

  switch (activeTab) {
    case "Attack":
      return [
        playerColumn,
        numeric("onePointScored", "1PT", (row) => row.onePointScored),
        numeric("twoPointScored", "2PT", (row) => row.twoPointScored),
        numeric("goalsScored", "Goals", (row) => row.goalsScored),
        numeric("freeScores", "Frees", (row) => row.freeScores),
        {
          id: "attackImpact",
          label: "Impact",
          sortAccessor: (row) => row.attackImpact,
          cell: (row) => <MetricCell value={row.attackImpact} bars={buildMiniBarValues([row.onePointScored, row.twoPointScored, row.goalsScored, row.assists])} />,
          headerClassName: "num",
          cellClassName: "num"
        }
      ];
    case "Transition":
      return [
        playerColumn,
        numeric("simplePass", "Simple Pass", (row) => row.simplePass),
        numeric("advancePass", "Advance Pass", (row) => row.advancePass),
        numeric("carries", "Carries", (row) => row.carries),
        numeric("turnovers", "Turnovers", (row) => row.turnovers),
        {
          id: "transitionImpact",
          label: "Impact",
          sortAccessor: (row) => row.transitionImpact,
          cell: (row) => <MetricCell value={row.transitionImpact} bars={buildMiniBarValues([row.simplePass, row.advancePass, row.carries, row.koContestsOur])} />,
          headerClassName: "num",
          cellClassName: "num"
        }
      ];
    case "Defence":
      return [
        playerColumn,
        numeric("tackles", "Tackles", (row) => row.tackles),
        numeric("duelsContested", "Duels", (row) => row.duelsContested),
        numeric("duelsLost", "Duels Lost", (row) => row.duelsLost),
        numeric("oppKickouts", "Opp KOs", (row) => row.koContestsOpp),
        {
          id: "defenseImpact",
          label: "Impact",
          sortAccessor: (row) => row.defenseImpact,
          cell: (row) => <MetricCell value={row.defenseImpact} bars={buildMiniBarValues([row.tackles, row.duelsContested, row.koContestsOpp, row.koWinsOpp])} accent="blue" />,
          headerClassName: "num",
          cellClassName: "num"
        }
      ];
    case "Turnovers":
      return [
        playerColumn,
        numeric("forceTurnoverWin", "Force TO Win", (row) => row.forceTurnoverWin),
        numeric("turnoversKickedAway", "Kick Away TO", (row) => row.turnoversKickedAway),
        numeric("turnoverSkillError", "Skill Error TO", (row) => row.turnoverSkillError),
        numeric("turnoversInContact", "Contact TO", (row) => row.turnoversInContact),
        numeric("toPerGame", "TO / Game", (row) => safeDivide(row.forceTurnoverWin + row.turnoversKickedAway, row.gamesPlayed))
      ];
    case "Kick Outs":
      return [
        playerColumn,
        numeric("koContestsOur", "Our KO", (row) => row.koContestsOur),
        numeric("koOurPct", "Our KO %", (row) => safeDivide(row.koWinsOur, row.koContestsOur) * 100, (value) => `${Math.round(value)}%`),
        numeric("koContestsOpp", "Opp KO", (row) => row.koContestsOpp),
        {
          id: "kickoutSplit",
          label: "Split",
          sortAccessor: (row) => safeDivide(row.koWinsOur, row.koContestsOur) - safeDivide(row.koWinsOpp, row.koContestsOpp),
          cell: (row) => (
            <SplitPercentCell
              leftValue={safeDivide(row.koWinsOur, row.koContestsOur) * 100}
              rightValue={safeDivide(row.koWinsOpp, row.koContestsOpp) * 100}
            />
          )
        },
        numeric("gamesPlayed", "Games", (row) => row.gamesPlayed)
      ];
    case "All Impact":
    default:
      return [
        playerColumn,
        {
          id: "totalImpact",
          label: "Total Impact",
          sortAccessor: (row) => row.totalImpact,
          cell: (row) => <MetricCell value={row.totalImpact} bars={buildMiniBarValues(row.matchTrend.map((trend) => trend.totalImpact))} />,
          headerClassName: "num",
          cellClassName: "num"
        },
        {
          id: "attackImpact",
          label: "Attack",
          sortAccessor: (row) => row.attackImpact,
          cell: (row) => <MetricCell value={row.attackImpact} bars={buildMiniBarValues(row.matchTrend.map((trend) => trend.attackImpact))} />,
          headerClassName: "num",
          cellClassName: "num"
        },
        {
          id: "transitionImpact",
          label: "Transition",
          sortAccessor: (row) => row.transitionImpact,
          cell: (row) => <MetricCell value={row.transitionImpact} bars={buildMiniBarValues(row.matchTrend.map((trend) => trend.transitionImpact))} />,
          headerClassName: "num",
          cellClassName: "num"
        },
        {
          id: "defenseImpact",
          label: "Defence",
          sortAccessor: (row) => row.defenseImpact,
          cell: (row) => <MetricCell value={row.defenseImpact} bars={buildMiniBarValues(row.matchTrend.map((trend) => trend.defenseImpact))} accent="blue" />,
          headerClassName: "num",
          cellClassName: "num"
        },
        {
          id: "gamesPlayed",
          label: "Form",
          sortAccessor: (row) => row.gamesPlayed,
          cell: (row) => (
            <SplitPercentCell
              leftValue={safeDivide(row.koWinsOur, row.koContestsOur) * 100}
              rightValue={safeDivide(row.koWinsOpp, row.koContestsOpp) * 100}
            />
          )
        }
      ];
  }
}

function MetricCell({ value, bars, accent = "gold" }: { value: number; bars: number[]; accent?: "gold" | "blue" }) {
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

function SplitPercentCell({ leftValue, rightValue }: { leftValue: number; rightValue: number }) {
  return (
    <div className="manager-percent-split">
      <span className="manager-percent-value">{Math.round(leftValue)}%</span>
      <div className="manager-percent-bars" aria-hidden="true">
        <i style={{ width: `${Math.max(6, Math.min(100, leftValue))}%` }} />
        <b style={{ width: `${Math.max(6, Math.min(100, rightValue))}%` }} />
      </div>
      <span className="manager-percent-value manager-percent-blue">{Math.round(rightValue)}%</span>
    </div>
  );
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

function safeDivide(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

