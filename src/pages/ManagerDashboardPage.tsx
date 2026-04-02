import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { LoadingCard } from "@/components/LoadingCard";
import { SortableTable, type SortableTableColumn } from "@/components/SortableTable";
import { useAuth } from "@/auth/AuthContext";
import { getSnapshot, refreshSnapshot, SNAPSHOT_CACHE_UPDATED_EVENT } from "@/api/client";
import type { SnapshotResponse } from "@/types";
import type { ManagerTableRow } from "@/pages/managerDashboardSorting";

export function ManagerDashboardPage() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilterId, setActiveFilterId] = useState("all");

  useEffect(() => {
    if (!session) return;
    const load = () => {
      getSnapshot(session)
        .then((data) => {
          setSnapshot(data);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Could not load cached snapshot"));
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

  const activeDashboard = snapshot?.filters?.dashboards[activeFilterId] ?? snapshot?.dashboard ?? null;
  const filterOptions = snapshot?.filters?.options ?? [{ id: "all", label: "All Matches", description: "Combined view across all available matches" }];

  const rows = useMemo<ManagerTableRow[]>(() => {
    if (!activeDashboard) return [];
    return activeDashboard.rows.map((row) => {
      const totalMinutes = toNumericValue(row.minutes);
      const totalImpact = toNumericValue(row.totalImpact);
      const totalImpact60 = totalMinutes > 0 ? (totalImpact / totalMinutes) * 60 : 0;

      return {
        ...row,
        totalMinutes,
        totalImpact60
      };
    });
  }, [activeDashboard]);

  const orderedTopPerformers = useMemo(() => {
    if (!activeDashboard) return [];
    const orderForTitle = (title: string) => {
      const normalized = title.toLowerCase();
      if (normalized.includes("total") && normalized.includes("impact")) return 0;
      if (normalized.includes("attack")) return 1;
      if (normalized.includes("transition")) return 2;
      if (normalized.includes("defence") || normalized.includes("defense")) return 3;
      return 99;
    };
    return activeDashboard.topPerformers
      .slice()
      .sort((a, b) => orderForTitle(a.title) - orderForTitle(b.title) || a.title.localeCompare(b.title));
  }, [activeDashboard]);

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
          <h2>Cached data is unavailable.</h2>
          <p>{error}</p>
          <button type="button" className="fetch-retry-btn" onClick={() => session && void refreshSnapshot(session)}>
            Refresh Data
          </button>
        </section>
      )}
      {snapshot && activeDashboard && (
        <div className="dashboard-wrap panel">
          <section className="dashboard-toolbar">
            <div>
              <p className="toolbar-kicker">Performance Filter</p>
              <h2 className="toolbar-title">Update the full dashboard by recent match window</h2>
            </div>
            <div className="filter-chip-group" role="tablist" aria-label="Manager dashboard filter">
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
          <section className="kpi-grid">
            {activeDashboard.kpis.map((kpi) => (
              <article key={kpi.label} className="kpi-card panel-inner">
                <h3>{kpi.label}</h3>
                <p className="kpi-value">{kpi.value}</p>
                <span>{kpi.subtitle}</span>
              </article>
            ))}
          </section>

          <section className="table panel-inner manager-table">
            <SortableTable rows={rows} columns={columns} getRowKey={(row) => row.playerId} />
          </section>

          <section className="performers-grid">
            {orderedTopPerformers.map((top) => (
              <article className="performer panel-inner" key={top.title}>
                <h4>{top.title}</h4>
                <p>{top.playerName}</p>
                <strong>{top.value.toFixed(1)}</strong>
                <div className="round-strip">
                  {top.rounds.map((v, i) => (
                    <span key={`${top.title}-${i}`}>R{i + 1} {v}</span>
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

function toNumericValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
