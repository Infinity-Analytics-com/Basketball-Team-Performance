import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { LoadingCard } from "@/components/LoadingCard";
import { SortableTable, type SortableTableColumn } from "@/components/SortableTable";
import { useAuth } from "@/auth/AuthContext";
import { getSnapshot, refreshSnapshot, SNAPSHOT_CACHE_UPDATED_EVENT } from "@/api/client";
import type { MatchStatRecord, SnapshotResponse } from "@/types";

const DATA_ERROR_MESSAGE = "Unable to load data. Please check your API key or connection.";

type ManagerTableRow = {
  playerId: string;
  name: string;
  totalMinutes: number;
  totalImpact60: number;
  att60: number;
  trans60: number;
  def60: number;
  koOurPct: number;
  koOppPct: number;
  totalImpact: number;
  turnovers: number;
  rounds: Array<{ matchId: string; totalImpact: number; attackImpact: number; transitionImpact: number; defenseImpact: number }>;
};

type SummaryCard = {
  label: string;
  value: string;
  subtitle: string;
};

type LeaderCard = {
  title: string;
  playerId: string;
  playerName: string;
  value: number;
  rounds: number[];
};

export function ManagerDashboardPage() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchFilter, setActiveMatchFilter] = useState("all");

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

  const tableRows = useMemo(() => aggregateRows(visibleRecords), [visibleRecords]);
  const summaryCards = useMemo<SummaryCard[]>(() => buildSummaryCards(tableRows), [tableRows]);
  const topPerformers = useMemo<LeaderCard[]>(() => buildLeaderCards(tableRows), [tableRows]);

  if (!session) return null;

  const columns: Array<SortableTableColumn<ManagerTableRow>> = [
    {
      id: "name",
      label: "Player",
      sortAccessor: (row) => row.name,
      cell: (row, index) => (
        <span>
          {index + 1}. <Link to={`/player/${row.playerId}`}>{row.name}</Link>
        </span>
      )
    },
    {
      id: "totalMinutes",
      label: "Total Min",
      sortAccessor: (row) => row.totalMinutes,
      cell: (row) => row.totalMinutes.toFixed(1),
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "totalImpact60",
      label: "Total Impact 60",
      sortAccessor: (row) => row.totalImpact60,
      cell: (row) => row.totalImpact60.toFixed(2),
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "att60",
      label: "ATT 60",
      sortAccessor: (row) => row.att60,
      cell: (row) => row.att60.toFixed(1),
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "trans60",
      label: "TRANS 60",
      sortAccessor: (row) => row.trans60,
      cell: (row) => row.trans60.toFixed(1),
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "def60",
      label: "DEF 60",
      sortAccessor: (row) => row.def60,
      cell: (row) => row.def60.toFixed(1),
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "koOurPct",
      label: "KO OUR %",
      sortAccessor: (row) => row.koOurPct,
      cell: (row) => `${row.koOurPct.toFixed(0)}%`,
      headerClassName: "num",
      cellClassName: "num"
    },
    {
      id: "koOppPct",
      label: "KO OPP %",
      sortAccessor: (row) => row.koOppPct,
      cell: (row) => `${row.koOppPct.toFixed(0)}%`,
      headerClassName: "num",
      cellClassName: "num"
    }
  ];

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
        <div className="dashboard-wrap panel">
          <section className="dashboard-toolbar">
            <div>
              <p className="toolbar-kicker">Match Filter</p>
              <h2 className="toolbar-title">Select a played match to update the full dashboard</h2>
            </div>
            <div className="filter-toolbar-row">
              <label className="filter-select-inline">
                <span className="filter-select-label">Match</span>
                <select
                  className="filter-select"
                  aria-label="Manager dashboard match filter"
                  value={activeMatchFilter}
                  onChange={(event) => setActiveMatchFilter(event.target.value)}
                >
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
            {summaryCards.map((card) => (
              <article key={card.label} className="kpi-card panel-inner">
                <h3>{card.label}</h3>
                <p className="kpi-value">{card.value}</p>
                <span>{card.subtitle}</span>
              </article>
            ))}
          </section>

          <section className="table panel-inner manager-table">
            <SortableTable rows={tableRows} columns={columns} getRowKey={(row) => row.playerId} />
          </section>

          <section className="performers-grid">
            {topPerformers.map((top) => (
              <article className="performer panel-inner" key={top.title}>
                <h4>{top.title}</h4>
                <p>{top.playerName}</p>
                <strong>{top.value.toFixed(1)}</strong>
                <div className="round-strip">
                  {top.rounds.map((value, index) => (
                    <span key={`${top.title}-${index}`}>R{index + 1} {value.toFixed(1)}</span>
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

function aggregateRows(records: MatchStatRecord[]): ManagerTableRow[] {
  const byPlayer = new Map<string, ManagerTableRow>();

  for (const record of records) {
    const current = byPlayer.get(record.playerId) ?? {
      playerId: record.playerId,
      name: record.playerName,
      totalMinutes: 0,
      totalImpact60: 0,
      att60: 0,
      trans60: 0,
      def60: 0,
      koOurPct: 0,
      koOppPct: 0,
      totalImpact: 0,
      turnovers: 0,
      rounds: []
    };

    current.totalMinutes += record.totalMinutes;
    current.totalImpact += record.totalImpact;
    current.turnovers += record.turnovers;
    current.att60 += record.attackImpact;
    current.trans60 += record.transitionImpact;
    current.def60 += record.defenseImpact;
    current.koOurPct += record.koWinsOur;
    current.koOppPct += record.koWinsOpp;
    current.rounds.push({
      matchId: record.matchId,
      totalImpact: record.totalImpact,
      attackImpact: record.attackImpact,
      transitionImpact: record.transitionImpact,
      defenseImpact: record.defenseImpact
    });

    (current as ManagerTableRow & { koOurContests?: number; koOppContests?: number }).koOurContests = ((current as ManagerTableRow & { koOurContests?: number }).koOurContests ?? 0) + record.koContestsOur;
    (current as ManagerTableRow & { koOurContests?: number; koOppContests?: number }).koOppContests = ((current as ManagerTableRow & { koOppContests?: number }).koOppContests ?? 0) + record.koContestsOpp;

    byPlayer.set(record.playerId, current);
  }

  return Array.from(byPlayer.values())
    .map((row) => {
      const koOurContests = (row as ManagerTableRow & { koOurContests?: number }).koOurContests ?? 0;
      const koOppContests = (row as ManagerTableRow & { koOppContests?: number }).koOppContests ?? 0;
      return {
        ...row,
        totalImpact60: row.totalMinutes > 0 ? (row.totalImpact / row.totalMinutes) * 60 : 0,
        att60: row.totalMinutes > 0 ? (row.att60 / row.totalMinutes) * 60 : 0,
        trans60: row.totalMinutes > 0 ? (row.trans60 / row.totalMinutes) * 60 : 0,
        def60: row.totalMinutes > 0 ? (row.def60 / row.totalMinutes) * 60 : 0,
        koOurPct: koOurContests > 0 ? (row.koOurPct / koOurContests) * 100 : 0,
        koOppPct: koOppContests > 0 ? (row.koOppPct / koOppContests) * 100 : 0
      };
    })
    .sort((left, right) => right.totalImpact - left.totalImpact || left.name.localeCompare(right.name));
}

function buildSummaryCards(rows: ManagerTableRow[]): SummaryCard[] {
  const count = rows.length || 1;
  return [
    {
      label: "All Impact",
      value: (rows.reduce((sum, row) => sum + row.totalImpact, 0) / count).toFixed(2),
      subtitle: "Average Total Impact"
    },
    {
      label: "TO Per Game",
      value: (rows.reduce((sum, row) => sum + averageTurnoversFromRounds(row), 0) / count).toFixed(1),
      subtitle: "Average turnovers across selected games"
    },
    {
      label: "KO % OUR",
      value: `${(rows.reduce((sum, row) => sum + row.koOurPct, 0) / count).toFixed(0)}%`,
      subtitle: "Our kickout win %"
    },
    {
      label: "KO % OPP",
      value: `${(rows.reduce((sum, row) => sum + row.koOppPct, 0) / count).toFixed(0)}%`,
      subtitle: "Opp kickout win %"
    }
  ];
}

function buildLeaderCards(rows: ManagerTableRow[]): LeaderCard[] {
  return [
    buildLeaderCard(rows, "Top Total Impact", (row) => row.totalImpact, (round) => round.totalImpact),
    buildLeaderCard(rows, "Top Attack Impact", (row) => row.att60, (round) => round.attackImpact),
    buildLeaderCard(rows, "Top Transition Impact", (row) => row.trans60, (round) => round.transitionImpact),
    buildLeaderCard(rows, "Top Defence Impact", (row) => row.def60, (round) => round.defenseImpact)
  ];
}

function buildLeaderCard(
  rows: ManagerTableRow[],
  title: string,
  accessor: (row: ManagerTableRow) => number,
  roundAccessor: (round: ManagerTableRow["rounds"][number]) => number
): LeaderCard {
  const winner = rows.slice().sort((left, right) => accessor(right) - accessor(left) || left.name.localeCompare(right.name))[0];
  return {
    title,
    playerId: winner?.playerId ?? "",
    playerName: winner?.name ?? "-",
    value: winner ? accessor(winner) : 0,
    rounds: winner ? winner.rounds.slice(0, 4).map((round) => roundAccessor(round)) : []
  };
}

function averageTurnoversFromRounds(row: ManagerTableRow): number {
  if (!row.rounds.length) return 0;
  return row.turnovers / row.rounds.length;
}
