import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { Role } from "@/types";

interface GuardedRouteProps {
  allowedRoles: Role[];
  enforcePlayerMatch?: boolean;
  children: React.ReactNode;
}

export function GuardedRoute({ allowedRoles, enforcePlayerMatch, children }: GuardedRouteProps) {
  const { session } = useAuth();
  const location = useLocation();
  const { playerId } = useParams();

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!allowedRoles.includes(session.role)) {
    return <Navigate to="/" replace />;
  }

  if (enforcePlayerMatch && session.role === "player" && session.playerId && session.playerId !== playerId) {
    return <Navigate to={`/player/${session.playerId}`} replace />;
  }

  return <>{children}</>;
}
