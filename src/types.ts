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
  simpleReceive: number;
  advanceReceive: number;
  goalsScored: number;
  tackles: number;
  kickawayToReceived: number;
  duelsContested: number;
  defensiveDuelsWon: number;
  dne: number;
  duelsLost: number;
  breach1v1: number;
  shotFreeConceded: number;
  twoPointFreeConceded: number;
  blackCard: number;
  redCard: number;
  simplePass: number;
  advancePass: number;
  carries: number;
  turnoversInContact: number;
  turnoverSkillError: number;
  turnoversKickedAway: number;
  acceptableTurnover: number;
  forceTurnoverWin: number;
  turnovers: number;
  assistsShots: number;
  assistsGoals: number;
  assistsTwoPoints: number;
  assists: number;
  onePointerAttempts: number;
  onePointerScored: number;
  onePointerWide: number;
  twoPointerAttempts: number;
  twoPointerScored: number;
  twoPointerWide: number;
  goalAttempts: number;
  goalsWide: number;
  dropShorts: number;
  freeOnePointerAttempts: number;
  freeOnePointerScored: number;
  freeTwoPointerAttempts: number;
  freeTwoPointerScored: number;
  freeGoalAttempts: number;
  freeGoalsScored: number;
  attackImpact: number;
  transitionImpact: number;
  defenseImpact: number;
  turnoverImpact: number;
  kickoutImpact: number;
  totalImpact: number;
  koWonCleanP1Our: number;
  koWonCleanP2Our: number;
  koWonCleanP3Our: number;
  koWonBreakOur: number;
  koWonCleanP1Opp: number;
  koWonCleanP2Opp: number;
  koWonCleanP3Opp: number;
  koWonBreakOpp: number;
  koTargetWonClean: number;
  koTargetWonBreak: number;
  koTargetLostClean: number;
  koTargetLostContest: number;
  ourKoContestUs: number;
  ourKoContestOpp: number;
  theirKoContestUs: number;
  theirKoContestOpp: number;
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
