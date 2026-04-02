export type Role = "admin" | "manager" | "player";

export type Permission =
  | "dashboard:view"
  | "player:view:any"
  | "player:view:self"
  | "admin:users:manage"
  | "admin:roles:manage"
  | "admin:settings:manage"
  | "admin:audit:view";

export interface AuthContext {
  userId: string;
  role: Role;
  playerId?: string;
}

export interface DashboardKpi {
  label: string;
  value: string;
  subtitle: string;
}

export interface DashboardFilterOption {
  id: string;
  label: string;
  description: string;
}

export interface PlayerRow {
  rank: number;
  playerId: string;
  name: string;
  position: string;
  number: string;
  minutes?: number;
  att60: number;
  trans60: number;
  def60: number;
  koOurPct: number;
  koOppPct: number;
  totalImpact: number;
}

export interface TopPerformer {
  title: string;
  playerId: string;
  playerName: string;
  number: string;
  position: string;
  value: number;
  rounds: number[];
}

export interface DashboardView {
  kpis: DashboardKpi[];
  tabs: string[];
  rows: PlayerRow[];
  topPerformers: TopPerformer[];
}

export interface PlayerView {
  playerId: string;
  header: {
    playerName: string;
    subtitle: string;
    scoresFor: number;
    turnoversAgainst: number;
  };
  cards: Array<{
    id: string;
    title: string;
    metric: string;
    lines: Array<{ label: string; value: string; ratio?: number }>;
  }>;
}

export interface SnapshotResponse {
  meta: {
    sourceSheetId: string;
    fetchedAt: string;
    version: string;
    sourceTabs?: {
      input: string;
      impact: string;
      categories: string;
    };
  };
  auth: AuthContext;
  permissions: Permission[];
  visiblePlayerIds: string[];
  dashboard: DashboardView;
  filters?: {
    defaultOptionId: string;
    options: DashboardFilterOption[];
    dashboards: Record<string, DashboardView>;
    playerViews: Record<string, Record<string, PlayerView>>;
  };
  players: Record<string, { playerId: string; name: string; number: string; position: string }>;
  playerViews: Record<string, PlayerView>;
}
