import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearSession, readSession, writeSession, type Session } from "@/auth/session";
import type { Role } from "@/types";
import { clearSnapshotCache, hasSnapshotCacheForSession, refreshSnapshot } from "@/api/client";

interface AuthState {
  session: Session | null;
  login: (role: Role) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());

  useEffect(() => {
    if (!session) return;
    void refreshSnapshot(session).catch(() => {
      // Keep the existing session and any usable cache if background refresh fails.
    });
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      async login(role) {
        const next: Session = {
          userId: role === "player" ? "u-player-jack" : role === "admin" ? "u-admin" : "u-manager",
          role,
          playerId: undefined,
          token: btoa(JSON.stringify({ role }))
        };

        try {
          const snapshot = await refreshSnapshot(next);
          next.playerId = snapshot.auth.playerId ?? next.playerId;
        } catch (error) {
          if (!hasSnapshotCacheForSession(next)) {
            throw error;
          }
        }

        writeSession(next);
        setSession(next);
      },
      logout() {
        clearSession();
        clearSnapshotCache();
        setSession(null);
      }
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
