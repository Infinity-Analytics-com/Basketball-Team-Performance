import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { refreshSnapshot } from "@/api/client";

export function AppShell({ children, title, titlePrefix }: { children: React.ReactNode; title: string; titlePrefix?: React.ReactNode }) {
  const { session, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (!session || refreshing) return;
    try {
      setRefreshing(true);
      await refreshSnapshot(session);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="app-bg">
      <header className="topbar panel">
        <div className="topbar-title">
          {titlePrefix}
          <h1>{title}</h1>
        </div>
        <nav>
          {session?.role === "player" && session?.playerId && <Link to={`/player/${session.playerId}`}>My Profile</Link>}
          {session && (
            <button onClick={() => void onRefresh()} className="icon-link" aria-label="Refresh Data" title="Refresh Data" type="button" disabled={refreshing}>
              <span aria-hidden="true">↻</span>
            </button>
          )}
          {session?.role === "admin" && (
            <Link to="/admin/users" className="icon-link" aria-label="Admin">
              <span aria-hidden="true">⚙</span>
            </Link>
          )}
          <button onClick={logout} className="ghost-btn" type="button">
            Logout
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
