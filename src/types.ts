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

export interface DashboardFilterOption {
  id: string;
  label: string;
  description: string;
}

export interface PlayerDirectoryEntry {
  playerId: string;
  name: string;
  number: string;
  position: string;
}

export interface MatchStatRecord {
  key: string;
  matchId: string;
  matchLabel: string;
  opposition: string;
  date: string;
  playerId: string;
  playerName: string;
  totalMinutes: number;
  pts: number;
  goalsScored: number;
  tackles: number;
  duelsContested: number;
  duelsLost: number;
  simplePass: number;
  advancePass: number;
  carries: number;
  turnoversInContact: number;
  turnoverSkillError: number;
  turnoversKickedAway: number;
  turnovers: number;
  assistsShots: number;
  assistsGoals: number;
  assists: number;
  onePointerAttempts: number;
  onePointerScored: number;
  twoPointerAttempts: number;
  twoPointerScored: number;
  goalAttempts: number;
  attackImpact: number;
  transitionImpact: number;
  defenseImpact: number;
  totalImpact: number;
  koWinsOur: number;
  koContestsOur: number;
  koWinsOpp: number;
  koContestsOpp: number;
}

export interface PerformanceLeaderboardRecord {
  key: string;
  matchId: string;
  playerId: string;
  playerName: string;
  minutes: number;
  overallImpact: number;
  attackImpact: number;
  defenseImpact: number;
  transitionImpact: number;
}

export interface ShootingLeaderboardRecord {
  key: string;
  matchId: string;
  playerId: string;
  playerName: string;
  minutes: number;
  playOverallEvPerShot: number;
  freeOverallEvPerShot: number;
  playOnePointerEv: number;
  freeOnePointerEv: number;
}

export interface SnapshotResponse {
  meta: {
    sourceSheetId: string;
    fetchedAt: string;
    version: string;
    sourceTabs?: {
      input?: string;
      performance?: string;
      shooting?: string;
      impact?: string;
      categories?: string;
    };
  };
  auth: AuthContext;
  permissions: Permission[];
  visiblePlayerIds: string[];
  players: Record<string, PlayerDirectoryEntry>;
  filters: {
    defaultOptionId: string;
    options: DashboardFilterOption[];
  };
  records: MatchStatRecord[];
  performanceLeaderboard: PerformanceLeaderboardRecord[];
  shootingLeaderboard: ShootingLeaderboardRecord[];
}
