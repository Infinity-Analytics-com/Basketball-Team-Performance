import { Navigate, Route, Routes } from "react-router-dom";
import { GuardedRoute } from "@/components/GuardedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { ManagerDashboardPage } from "@/pages/ManagerDashboardPage";
import { PlayerLandingPage } from "@/pages/PlayerLandingPage";
import { PlayerProfilePage } from "@/pages/PlayerProfilePage";
import { AdminPage } from "@/pages/AdminPage";
import { AdminAuditPage, AdminRolesPage, AdminSettingsPage, AdminUsersPage } from "@/pages/AdminSubpages";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<LoginPage />} />

      <Route
        path="/manager/dashboard"
        element={
          <GuardedRoute allowedRoles={["admin", "manager"]}>
            <ManagerDashboardPage />
          </GuardedRoute>
        }
      />

      <Route
        path="/player"
        element={
          <GuardedRoute allowedRoles={["admin", "manager", "player"]}>
            <PlayerLandingPage />
          </GuardedRoute>
        }
      />

      <Route
        path="/player/:playerId"
        element={
          <GuardedRoute allowedRoles={["admin", "manager", "player"]} enforcePlayerMatch>
            <PlayerProfilePage />
          </GuardedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <GuardedRoute allowedRoles={["admin"]}>
            <AdminPage />
          </GuardedRoute>
        }
      >
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="roles" element={<AdminRolesPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
