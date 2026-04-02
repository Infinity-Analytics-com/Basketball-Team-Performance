import { useMemo, useState } from "react";

const users = [
  { id: "u-admin", email: "admin@club.test", role: "admin" },
  { id: "u-manager", email: "manager@club.test", role: "manager" },
  { id: "u-player-jack", email: "jack@club.test", role: "player" }
];

const roleRows = [
  { role: "admin", description: "full system admin" },
  { role: "manager", description: "dashboard + all players" },
  { role: "player", description: "self-view only" }
];

const auditRows = [
  { at: "2026-03-03 12:00", action: "admin changed role mapping" },
  { at: "2026-03-03 11:50", action: "manager viewed player profile p-jack" },
  { at: "2026-03-03 11:42", action: "player accessed own dashboard" }
];

export function AdminUsersPage() {
  const [sortBy, setSortBy] = useState<"email" | "role">("email");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const rows = useMemo(() => {
    const next = users.slice().sort((a, b) => a[sortBy].localeCompare(b[sortBy]));
    return dir === "asc" ? next : next.reverse();
  }, [sortBy, dir]);
  const toggle = (column: "email" | "role") => {
    if (sortBy === column) setDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(column);
      setDir("asc");
    }
  };
  const indicator = (column: "email" | "role") => (sortBy === column ? (dir === "asc" ? " ▲" : " ▼") : "");
  return (
    <section className="panel-inner">
      <h3>Users</h3>
      <div className="table-head admin-table-head">
        <button type="button" className="column-sort" onClick={() => toggle("email")}>Email{indicator("email")}</button>
        <button type="button" className="column-sort" onClick={() => toggle("role")}>Role{indicator("role")}</button>
      </div>
      {rows.map((u) => (
        <div className="table-row" key={u.id}>
          <span>{u.email}</span>
          <span>{u.role}</span>
        </div>
      ))}
    </section>
  );
}

export function AdminRolesPage() {
  const [sortBy, setSortBy] = useState<"role" | "description">("role");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const rows = useMemo(() => {
    const next = roleRows.slice().sort((a, b) => a[sortBy].localeCompare(b[sortBy]));
    return dir === "asc" ? next : next.reverse();
  }, [sortBy, dir]);
  const toggle = (column: "role" | "description") => {
    if (sortBy === column) setDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(column);
      setDir("asc");
    }
  };
  const indicator = (column: "role" | "description") => (sortBy === column ? (dir === "asc" ? " ▲" : " ▼") : "");
  return (
    <section className="panel-inner">
      <h3>Roles & Permissions</h3>
      <div className="table-head admin-table-head">
        <button type="button" className="column-sort" onClick={() => toggle("role")}>Role{indicator("role")}</button>
        <button type="button" className="column-sort" onClick={() => toggle("description")}>Description{indicator("description")}</button>
      </div>
      {rows.map((r) => (
        <div className="table-row" key={r.role}>
          <span>{r.role}</span>
          <span>{r.description}</span>
        </div>
      ))}
    </section>
  );
}

export function AdminSettingsPage() {
  return (
    <section className="panel-inner">
      <h3>Data Source Settings</h3>
      <div className="setting-line"><span>Sheet ID</span><code>1MP0mzEPAxo-Z9g0lmcipxLepjap6Vu3FSCXhbzaRpSU</code></div>
      <div className="setting-line"><span>Tabs</span><code>Input Sheet AFL, Inpact Score AFL, CategoryScores</code></div>
      <div className="setting-line"><span>Cache TTL</span><code>300s</code></div>
    </section>
  );
}

export function AdminAuditPage() {
  const [sortBy, setSortBy] = useState<"at" | "action">("at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const rows = useMemo(() => {
    const next = auditRows.slice().sort((a, b) => a[sortBy].localeCompare(b[sortBy]));
    return dir === "asc" ? next : next.reverse();
  }, [sortBy, dir]);
  const toggle = (column: "at" | "action") => {
    if (sortBy === column) setDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(column);
      setDir(column === "at" ? "desc" : "asc");
    }
  };
  const indicator = (column: "at" | "action") => (sortBy === column ? (dir === "asc" ? " ▲" : " ▼") : "");
  return (
    <section className="panel-inner">
      <h3>Audit Log</h3>
      <div className="table-head admin-table-head">
        <button type="button" className="column-sort" onClick={() => toggle("at")}>When{indicator("at")}</button>
        <button type="button" className="column-sort" onClick={() => toggle("action")}>Action{indicator("action")}</button>
      </div>
      {rows.map((r) => (
        <div className="table-row" key={`${r.at}-${r.action}`}>
          <span>{r.at}</span>
          <span>{r.action}</span>
        </div>
      ))}
    </section>
  );
}
