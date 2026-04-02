import { Link, Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/Layout";

const tabs = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/roles", label: "Roles" },
  { to: "/admin/settings", label: "Settings" },
  { to: "/admin/audit", label: "Audit" }
];

export function AdminPage() {
  const location = useLocation();
  return (
    <AppShell title="Admin Console">
      <div className="panel admin-shell">
        <div className="tabs-row">
          {tabs.map((tab) => (
            <Link className={location.pathname === tab.to ? "tab active" : "tab"} key={tab.to} to={tab.to}>
              {tab.label}
            </Link>
          ))}
        </div>
        <Outlet />
      </div>
    </AppShell>
  );
}
