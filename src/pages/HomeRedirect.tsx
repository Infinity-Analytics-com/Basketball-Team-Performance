import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function HomeRedirect() {
  const { session } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role === "admin" || session.role === "manager") {
    return <Navigate to="/manager/dashboard" replace />;
  }

  if (session.playerId) {
    return <Navigate to={`/player/${session.playerId}`} replace />;
  }

  return <Navigate to="/player" replace />;
}
