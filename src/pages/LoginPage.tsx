import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { Role } from "@/types";

const roles: Role[] = ["admin", "manager", "player"];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (role: Role) => {
    try {
      setError(null);
      setLoadingRole(role);
      await login(role);
      if (role === "admin" || role === "manager") {
        navigate("/manager/dashboard");
        return;
      }
      navigate("/player");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data. Please check your API key or connection.");
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="auth-page app-bg">
      <div className="panel auth-card">
        <h1>AFL Performance</h1>
        <p>Select profile</p>
        {error && <p className="fetch-status-detail">{error}</p>}
        <div className="role-grid">
          {roles.map((role) => (
            <button key={role} onClick={() => void handleLogin(role)} className="role-btn" type="button" disabled={Boolean(loadingRole)}>
              {loadingRole === role ? "LOADING..." : role.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
