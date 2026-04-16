import type { DashboardFilterOption, MatchStatRecord } from "@/types";

export const MATCH_SLOT_COUNT = 15;

export const IMPACT_WEIGHTS = {
  defense: {
    tackles: 0.25,
    forceTurnoverWin: 2,
    kickawayToReceived: 1,
    duelsContested: 0.25,
    defensiveDuelsWon: 0.75,
    dne: -1,
    duelsLost: -0.25,
    breach1v1: -0.75,
    shotFreeConceded: -1,
    twoPointFreeConceded: -1.75,
    blackCard: -3,
    redCard: -6
  },
  attack: {
    onePointerScored: 1,
    twoPointerScored: 2,
    goalsScored: 3,
    freeOnePointerScored: 1,
    freeTwoPointerScored: 2.5,
    freeGoalsScored: 4,
    assistsShots: 0.5,
    assistsGoals: 2,
    assistsTwoPoints: 1,
    onePointerWide: -0.2,
    twoPointerWide: -0.1,
    goalsWide: -0.4,
    dropShorts: -1.25
  },
  transition: {
    simplePass: 0.15,
    simpleReceive: 0.1,
    advancePass: 0.25,
    advanceReceive: 0.3,
    carries: 0.5,
    turnoversInContact: -1,
    turnoverSkillError: -1,
    turnoversKickedAway: -1,
    acceptableTurnover: 0
  },
  kickout: {
    koWonCleanP1Our: 0.25,
    koWonCleanP2Our: 0.5,
    koWonCleanP3Our: 1,
    koWonBreakOur: 0.75,
    koWonCleanP1Opp: 0.75,
    koWonCleanP2Opp: 1,
    koWonCleanP3Opp: 1.5,
    koWonBreakOpp: 1,
    koTargetWonClean: 1.25,
    koTargetWonBreak: 0.75,
    koTargetLostClean: -1.25,
    koTargetLostContest: -0.5,
    ourKoContestUs: 0.5,
    ourKoContestOpp: -0.25,
    theirKoContestUs: 0.75,
    theirKoContestOpp: -0.1
  }
} as const;

export type AggregatedPlayerRow = {
  playerId: string;
  name: string;
  gamesPlayed: number;
  totalMinutes: number;
  totalImpact: number;
  attackImpact: number;
  transitionImpact: number;
  defenseImpact: number;
  turnoverImpact: number;
  kickoutImpact: number;
  onePointAtt: number;
  onePointScored: number;
  twoPointAtt: number;
  twoPointScored: number;
  goalAtt: number;
  goalsScored: number;
  freeScores: number;
  assists: number;
  simplePass: number;
  advancePass: number;
  carries: number;
  turnovers: number;
  turnoversInContact: number;
  turnoverSkillError: number;
  turnoversKickedAway: number;
  forceTurnoverWin: number;
  tackles: number;
  duelsContested: number;
  duelsLost: number;
  koWinsOur: number;
  koContestsOur: number;
  koWinsOpp: number;
  koContestsOpp: number;
  matchTrend: Array<{
    matchId: string;
    matchLabel: string;
    minutes: number;
    totalImpact: number;
    attackImpact: number;
    transitionImpact: number;
    defenseImpact: number;
    turnoverImpact: number;
    kickoutImpact: number;
  }>;
  formLast3: number | null;
  formSeason: number | null;
};

export type FormMetrics = {
  last3: number | null;
  season: number | null;
};

type MatchOrderEntry = {
  matchId: string;
  opposition: string;
  date: string;
  order: number;
};

function scoreWeighted(values: Array<[number, number]>): number {
  return values.reduce((sum, [value, weight]) => sum + value * weight, 0);
}

export function calculateImpactScores(record: MatchStatRecord) {
  const attackImpact = scoreWeighted([
    [record.onePointerScored, IMPACT_WEIGHTS.attack.onePointerScored],
    [record.twoPointerScored, IMPACT_WEIGHTS.attack.twoPointerScored],
    [record.goalsScored, IMPACT_WEIGHTS.attack.goalsScored],
    [record.freeOnePointerScored, IMPACT_WEIGHTS.attack.freeOnePointerScored],
    [record.freeTwoPointerScored, IMPACT_WEIGHTS.attack.freeTwoPointerScored],
    [record.freeGoalsScored, IMPACT_WEIGHTS.attack.freeGoalsScored],
    [record.assistsShots, IMPACT_WEIGHTS.attack.assistsShots],
    [record.assistsGoals, IMPACT_WEIGHTS.attack.assistsGoals],
    [record.assistsTwoPoints, IMPACT_WEIGHTS.attack.assistsTwoPoints],
    [record.onePointerWide, IMPACT_WEIGHTS.attack.onePointerWide],
    [record.twoPointerWide, IMPACT_WEIGHTS.attack.twoPointerWide],
    [record.goalsWide, IMPACT_WEIGHTS.attack.goalsWide],
    [record.dropShorts, IMPACT_WEIGHTS.attack.dropShorts]
  ]);

  const transitionImpact = scoreWeighted([
    [record.simplePass, IMPACT_WEIGHTS.transition.simplePass],
    [record.simpleReceive, IMPACT_WEIGHTS.transition.simpleReceive],
    [record.advancePass, IMPACT_WEIGHTS.transition.advancePass],
    [record.advanceReceive, IMPACT_WEIGHTS.transition.advanceReceive],
    [record.carries, IMPACT_WEIGHTS.transition.carries],
    [record.turnoversInContact, IMPACT_WEIGHTS.transition.turnoversInContact],
    [record.turnoverSkillError, IMPACT_WEIGHTS.transition.turnoverSkillError],
    [record.turnoversKickedAway, IMPACT_WEIGHTS.transition.turnoversKickedAway],
    [record.acceptableTurnover, IMPACT_WEIGHTS.transition.acceptableTurnover]
  ]);

  const defenseImpact = scoreWeighted([
    [record.tackles, IMPACT_WEIGHTS.defense.tackles],
    [record.forceTurnoverWin, IMPACT_WEIGHTS.defense.forceTurnoverWin],
    [record.kickawayToReceived, IMPACT_WEIGHTS.defense.kickawayToReceived],
    [record.duelsContested, IMPACT_WEIGHTS.defense.duelsContested],
    [record.defensiveDuelsWon, IMPACT_WEIGHTS.defense.defensiveDuelsWon],
    [record.dne, IMPACT_WEIGHTS.defense.dne],
    [record.duelsLost, IMPACT_WEIGHTS.defense.duelsLost],
    [record.breach1v1, IMPACT_WEIGHTS.defense.breach1v1],
    [record.shotFreeConceded, IMPACT_WEIGHTS.defense.shotFreeConceded],
    [record.twoPointFreeConceded, IMPACT_WEIGHTS.defense.twoPointFreeConceded],
    [record.blackCard, IMPACT_WEIGHTS.defense.blackCard],
    [record.redCard, IMPACT_WEIGHTS.defense.redCard]
  ]);

  const kickoutImpact = scoreWeighted([
    [record.koWonCleanP1Our, IMPACT_WEIGHTS.kickout.koWonCleanP1Our],
    [record.koWonCleanP2Our, IMPACT_WEIGHTS.kickout.koWonCleanP2Our],
    [record.koWonCleanP3Our, IMPACT_WEIGHTS.kickout.koWonCleanP3Our],
    [record.koWonBreakOur, IMPACT_WEIGHTS.kickout.koWonBreakOur],
    [record.koWonCleanP1Opp, IMPACT_WEIGHTS.kickout.koWonCleanP1Opp],
    [record.koWonCleanP2Opp, IMPACT_WEIGHTS.kickout.koWonCleanP2Opp],
    [record.koWonCleanP3Opp, IMPACT_WEIGHTS.kickout.koWonCleanP3Opp],
    [record.koWonBreakOpp, IMPACT_WEIGHTS.kickout.koWonBreakOpp],
    [record.koTargetWonClean, IMPACT_WEIGHTS.kickout.koTargetWonClean],
    [record.koTargetWonBreak, IMPACT_WEIGHTS.kickout.koTargetWonBreak],
    [record.koTargetLostClean, IMPACT_WEIGHTS.kickout.koTargetLostClean],
    [record.koTargetLostContest, IMPACT_WEIGHTS.kickout.koTargetLostContest],
    [record.ourKoContestUs, IMPACT_WEIGHTS.kickout.ourKoContestUs],
    [record.ourKoContestOpp, IMPACT_WEIGHTS.kickout.ourKoContestOpp],
    [record.theirKoContestUs, IMPACT_WEIGHTS.kickout.theirKoContestUs],
    [record.theirKoContestOpp, IMPACT_WEIGHTS.kickout.theirKoContestOpp]
  ]);

  const turnoverImpact =
    record.turnoversInContact * IMPACT_WEIGHTS.transition.turnoversInContact +
    record.turnoverSkillError * IMPACT_WEIGHTS.transition.turnoverSkillError +
    record.turnoversKickedAway * IMPACT_WEIGHTS.transition.turnoversKickedAway +
    record.forceTurnoverWin * IMPACT_WEIGHTS.defense.forceTurnoverWin +
    record.kickawayToReceived * IMPACT_WEIGHTS.defense.kickawayToReceived;

  return {
    attackImpact,
    transitionImpact,
    defenseImpact,
    kickoutImpact,
    turnoverImpact,
    totalImpact: attackImpact + transitionImpact + defenseImpact
  };
}

export function applyImpactScores(record: MatchStatRecord): MatchStatRecord {
  return { ...record, ...calculateImpactScores(record) };
}

export function normalizeMatchId(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

export function matchDedupKey(value: string): string {
  return normalizeMatchId(value).replace(/[^A-Z0-9]/g, "");
}

export function isInvalidMatchId(value: string): boolean {
  const normalized = normalizeMatchId(value);
  if (!normalized) return true;
  if (/^BATCH\b/i.test(normalized)) return true;
  if (/^PLAYER\b/i.test(normalized)) return true;
  return false;
}

function parseDateValue(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMatchSequence(matchId: string): number | null {
  const aflMatch = normalizeMatchId(matchId).match(/\bAFL\s*(\d+)\b/i);
  if (!aflMatch) return null;
  const parsed = Number(aflMatch[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMatchLabel(matchId: string, opposition: string): string {
  return opposition ? `${matchId} - vs ${opposition}` : matchId;
}

export function buildMatchOrder(records: MatchStatRecord[]): MatchOrderEntry[] {
  const seen = new Map<string, MatchOrderEntry & { hasActivity: boolean }>();

  records.forEach((record, index) => {
    const key = matchDedupKey(record.matchId);
    if (!key || isInvalidMatchId(record.matchId)) return;
    const hasActivity =
      record.totalMinutes > 0 ||
      record.totalImpact !== 0 ||
      record.attackImpact !== 0 ||
      record.transitionImpact !== 0 ||
      record.defenseImpact !== 0 ||
      record.kickoutImpact !== 0 ||
      record.turnoverImpact !== 0;
    const current = seen.get(key);
    if (!current) {
      seen.set(key, {
        matchId: normalizeMatchId(record.matchId),
        opposition: record.opposition,
        date: record.date,
        order: index,
        hasActivity
      });
      return;
    }
    current.hasActivity = current.hasActivity || hasActivity;
    if (!current.opposition && record.opposition) current.opposition = record.opposition;
    if (!current.date && record.date) current.date = record.date;
  });

  return Array.from(seen.values())
    .filter((entry) => entry.hasActivity)
    .sort((left, right) => {
      const leftSequence = parseMatchSequence(left.matchId);
      const rightSequence = parseMatchSequence(right.matchId);
      if (leftSequence != null && rightSequence != null && leftSequence !== rightSequence) {
        return leftSequence - rightSequence;
      }
      const leftDate = parseDateValue(left.date);
      const rightDate = parseDateValue(right.date);
      if (leftDate != null && rightDate != null && leftDate !== rightDate) {
        return leftDate - rightDate;
      }
      return left.order - right.order;
    })
    .map(({ hasActivity: _hasActivity, ...entry }) => entry);
}

export function buildFilterOptions(records: MatchStatRecord[]): DashboardFilterOption[] {
  const matches = buildMatchOrder(records);
  return [
    {
      id: "all",
      label: "All",
      description: `Combined view across ${matches.length || 1} matches`
    },
    ...matches.map((match) => ({
      id: match.matchId,
      label: formatMatchLabel(match.matchId, match.opposition),
      description: match.date ? `${match.matchId} on ${match.date}` : `Filter to ${match.matchId}`
    }))
  ];
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

function averageImpactPerMinute(records: MatchStatRecord[]): number {
  return safeDivide(records.reduce((sum, record) => sum + record.totalImpact, 0), records.reduce((sum, record) => sum + record.totalMinutes, 0));
}

export function calculatePlayerForm(playerRecords: MatchStatRecord[], allRecords: MatchStatRecord[], matchOrder = buildMatchOrder(allRecords)): FormMetrics {
  const orderedMatches = matchOrder.map((match) => match.matchId);
  const playedByPlayer = playerRecords
    .slice()
    .sort((left, right) => orderedMatches.indexOf(left.matchId) - orderedMatches.indexOf(right.matchId))
    .filter((record) => record.totalMinutes > 0);

  if (playedByPlayer.length < 3) {
    return { last3: null, season: null };
  }

  const last3 = playedByPlayer.slice(-3);
  const last3MatchIds = new Set(last3.map((record) => record.matchId));
  const teamLast3Records = allRecords.filter((record) => last3MatchIds.has(record.matchId));
  const playerLast3ImpactPerMinute = averageImpactPerMinute(last3);
  const teamLast3ImpactPerMinute = averageImpactPerMinute(teamLast3Records);
  const playerSeasonImpactPerMinute = averageImpactPerMinute(playedByPlayer);
  const teamSeasonImpactPerMinute = averageImpactPerMinute(allRecords.filter((record) => orderedMatches.includes(record.matchId)));

  return {
    last3: teamLast3ImpactPerMinute > 0 ? (playerLast3ImpactPerMinute / teamLast3ImpactPerMinute) * 100 : null,
    season: teamSeasonImpactPerMinute > 0 ? (playerSeasonImpactPerMinute / teamSeasonImpactPerMinute) * 100 : null
  };
}

export function aggregatePlayerRecords(records: MatchStatRecord[], allRecords = records, matchOrder = buildMatchOrder(allRecords)): AggregatedPlayerRow[] {
  const byPlayer = new Map<string, AggregatedPlayerRow & { matchIds: Set<string> }>();
  const matchIndex = new Map(matchOrder.map((match, index) => [match.matchId, index]));

  for (const record of records) {
    const current = byPlayer.get(record.playerId) ?? {
      playerId: record.playerId,
      name: record.playerName,
      gamesPlayed: 0,
      totalMinutes: 0,
      totalImpact: 0,
      attackImpact: 0,
      transitionImpact: 0,
      defenseImpact: 0,
      turnoverImpact: 0,
      kickoutImpact: 0,
      onePointAtt: 0,
      onePointScored: 0,
      twoPointAtt: 0,
      twoPointScored: 0,
      goalAtt: 0,
      goalsScored: 0,
      freeScores: 0,
      assists: 0,
      simplePass: 0,
      advancePass: 0,
      carries: 0,
      turnovers: 0,
      turnoversInContact: 0,
      turnoverSkillError: 0,
      turnoversKickedAway: 0,
      forceTurnoverWin: 0,
      tackles: 0,
      duelsContested: 0,
      duelsLost: 0,
      koWinsOur: 0,
      koContestsOur: 0,
      koWinsOpp: 0,
      koContestsOpp: 0,
      matchTrend: [],
      formLast3: null,
      formSeason: null,
      matchIds: new Set<string>()
    };

    current.matchIds.add(record.matchId);
    current.totalMinutes += record.totalMinutes;
    current.totalImpact += record.totalImpact;
    current.attackImpact += record.attackImpact;
    current.transitionImpact += record.transitionImpact;
    current.defenseImpact += record.defenseImpact;
    current.turnoverImpact += record.turnoverImpact;
    current.kickoutImpact += record.kickoutImpact;
    current.onePointAtt += record.onePointerAttempts;
    current.onePointScored += record.onePointerScored;
    current.twoPointAtt += record.twoPointerAttempts;
    current.twoPointScored += record.twoPointerScored;
    current.goalAtt += record.goalAttempts;
    current.goalsScored += record.goalsScored;
    current.freeScores += record.freeOnePointerScored + record.freeTwoPointerScored + record.freeGoalsScored;
    current.assists += record.assists;
    current.simplePass += record.simplePass;
    current.advancePass += record.advancePass;
    current.carries += record.carries;
    current.turnovers += record.turnovers;
    current.turnoversInContact += record.turnoversInContact;
    current.turnoverSkillError += record.turnoverSkillError;
    current.turnoversKickedAway += record.turnoversKickedAway;
    current.forceTurnoverWin += record.forceTurnoverWin;
    current.tackles += record.tackles;
    current.duelsContested += record.duelsContested;
    current.duelsLost += record.duelsLost;
    current.koWinsOur += record.koWinsOur;
    current.koContestsOur += record.koContestsOur;
    current.koWinsOpp += record.koWinsOpp;
    current.koContestsOpp += record.koContestsOpp;
    current.matchTrend.push({
      matchId: record.matchId,
      matchLabel: record.matchLabel,
      minutes: record.totalMinutes,
      totalImpact: record.totalImpact,
      attackImpact: record.attackImpact,
      transitionImpact: record.transitionImpact,
      defenseImpact: record.defenseImpact,
      turnoverImpact: record.turnoverImpact,
      kickoutImpact: record.kickoutImpact
    });

    byPlayer.set(record.playerId, current);
  }

  return Array.from(byPlayer.values())
    .map(({ matchIds, ...row }) => {
      const playerRecords = records.filter((record) => record.playerId === row.playerId);
      const form = calculatePlayerForm(playerRecords, allRecords, matchOrder);
      return {
        ...row,
        gamesPlayed: matchIds.size,
        formLast3: form.last3,
        formSeason: form.season,
        matchTrend: row.matchTrend.sort((left, right) => (matchIndex.get(left.matchId) ?? Number.MAX_SAFE_INTEGER) - (matchIndex.get(right.matchId) ?? Number.MAX_SAFE_INTEGER))
      };
    })
    .sort((left, right) => right.totalImpact - left.totalImpact || left.name.localeCompare(right.name));
}

export function buildSparklineBars(
  valuesByMatchId: Map<string, number>,
  matchOrder: MatchOrderEntry[],
  slotCount = MATCH_SLOT_COUNT
): Array<{ matchId: string | null; label: string; value: number | null; height: number; empty: boolean }> {
  const slots: Array<{ matchId: string | null; label: string; value: number | null }> = matchOrder.slice(0, slotCount).map((match) => ({
    matchId: match.matchId,
    label: match.matchId,
    value: valuesByMatchId.get(match.matchId) ?? null
  }));

  while (slots.length < slotCount) {
    slots.push({
      matchId: null,
      label: `AFL ${slots.length + 1}`,
      value: null
    });
  }

  const maxValue = Math.max(
    ...slots.map((slot) => Math.abs(slot.value ?? 0)),
    1
  );

  return slots.map((slot) => ({
    ...slot,
    height: slot.value == null ? 18 : 24 + Math.round((Math.abs(slot.value) / maxValue) * 76),
    empty: slot.value == null
  }));
}
