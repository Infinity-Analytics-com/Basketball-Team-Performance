import type { DashboardFilterOption, MatchStatRecord, PerformanceLeaderboardRecord, ShootingLeaderboardRecord, SnapshotResponse } from "@/types";
import { permissionsForRole } from "@/rbac/permissions";
import {
  applyImpactScores,
  buildFilterOptions as buildSharedFilterOptions,
  buildMatchOrder,
  formatMatchLabel as formatSharedMatchLabel,
  isInvalidMatchId as isSharedInvalidMatchId,
  matchDedupKey as toMatchDedupKey,
  normalizeMatchId as toMatchId
} from "@/data/performanceModel";

const SHEET_ID = "1MP0mzEPAxo-Z9g0lmcipxLepjap6Vu3FSCXhbzaRpSU";
const TAB_CANDIDATES = {
  input: ["Input Sheet AFL"],
  performance: ["Performance Leaderboard"],
  shooting: ["Shooting Leaderboard"],
  impact: ["Inpact Score AFL", "Impact Score AFL"],
  categories: ["CategoryScores"]
} as const;
const TABS_CACHE_KEY = "afl-live-sheets-tabs-cache:v2";

type Grid = string[][];
type ParsedRow = Record<string, string>;
type TabData = { tab: string; values: Grid };
type CachedTabsPayload = {
  sheetId: string;
  fetchedAt: string;
  tabs: Partial<Record<keyof typeof TAB_CANDIDATES, TabData>>;
};

function encodeRange(range: string): string {
  return encodeURIComponent(range);
}

async function fetchTab(sheetId: string, apiKey: string, tab: string): Promise<Grid> {
  const range = encodeRange(`${tab}!A1:ZZ`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? "";
    } catch {
      detail = "";
    }
    const err = new Error(`Google Sheets request failed (${response.status}) for "${tab}"${detail ? `: ${detail}` : ""}`) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  const body = (await response.json()) as { values?: string[][] };
  return body.values ?? [];
}

async function fetchFirstAvailable(sheetId: string, apiKey: string, tabs: readonly string[]): Promise<TabData> {
  const misses: string[] = [];
  for (const tab of tabs) {
    try {
      const values = await fetchTab(sheetId, apiKey, tab);
      if (values.length > 0) {
        return { tab, values };
      }
      misses.push(tab);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 400 || status === 404) {
        misses.push(tab);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Could not read any tab from: ${misses.length ? misses.join(", ") : tabs.join(", ")}`);
}

async function fetchOptionalTab(sheetId: string, apiKey: string, tabs: readonly string[]): Promise<TabData | null> {
  try {
    return await fetchFirstAvailable(sheetId, apiKey, tabs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/Could not read any tab/.test(message)) {
      return null;
    }
    throw error;
  }
}

function findHeaderRow(values: Grid): number {
  for (let i = 0; i < Math.min(8, values.length); i += 1) {
    const row = values[i] ?? [];
    const nonEmpty = row.filter((cell) => String(cell ?? "").trim() !== "").length;
    if (nonEmpty >= 4 && row.some((cell) => /player|match|minutes|impact|points|goals|tackles/i.test(String(cell)))) {
      return i;
    }
  }
  return 0;
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((raw, index) => {
    const base = (raw || `col_${index + 1}`).trim() || `col_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}__${count + 1}`;
  });
}

function parseRows(values: Grid): ParsedRow[] {
  if (!values.length) return [];
  const headerIndex = findHeaderRow(values);
  const headers = uniqueHeaders(values[headerIndex] ?? []);
  return values
    .slice(headerIndex + 1)
    .map((row) => {
      const record: ParsedRow = {};
      headers.forEach((header, idx) => {
        record[header] = String(row[idx] ?? "").trim();
      });
      return record;
    })
    .filter((row) => Object.values(row).some((value) => value !== ""));
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row: ParsedRow, candidates: string[]): string {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const normalized = normalizeKey(candidate);
    const hit = entries.find(([key]) => normalizeKey(key) === normalized);
    if (hit && hit[1] !== "") {
      return hit[1];
    }
  }
  return "";
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const text = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  if (!text) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

function playerId(name: string): string {
  return `p-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown"}`;
}

function normalizeMatchId(value: string): string {
  return toMatchId(value);
}

function matchDedupKey(value: string): string {
  return toMatchDedupKey(value);
}

function isInvalidMatchId(value: string): boolean {
  return isSharedInvalidMatchId(value);
}

function formatMatchLabel(matchId: string, opposition: string): string {
  return formatSharedMatchLabel(matchId, opposition);
}

function buildFilterOptions(records: MatchStatRecord[]): DashboardFilterOption[] {
  return buildSharedFilterOptions(records);
}

function getFreeShotCounts(row: ParsedRow) {
  const freeOnePointerAttempts = toNumber(pick(row, ["One_Pointer_Attempts_F", "Free One_Pointer_Attempts", "Free One Pointer Attempts"]));
  const freeOnePointerScored = toNumber(pick(row, ["One_Pointer_Scored_F", "Free One_Pointer_Scored", "Free One Pointer Scored"]));
  const freeTwoPointerAttempts = toNumber(pick(row, ["Two_Pointer_Attempts_F", "Free Two_Pointer_Attempts", "Free Two Pointer Attempts"]));
  const freeTwoPointerScored = toNumber(pick(row, ["Two_Pointer_Scored_F", "Free Two_Pointer_Scored", "Free Two Pointer Scored"]));
  const freeGoalAttempts = toNumber(pick(row, ["Goal_Attempts_F", "Free Goal_Attempts", "Free Goal Attempts"]));
  const freeGoalsScored = toNumber(pick(row, ["Goals_Scored_F", "Free Goals_Scored", "Free Goals Scored"]));
  return {
    freeOnePointerAttempts,
    freeOnePointerScored,
    freeTwoPointerAttempts,
    freeTwoPointerScored,
    freeGoalAttempts,
    freeGoalsScored
  };
}

function parseInputRecords(inputRows: ParsedRow[]): MatchStatRecord[] {
  return inputRows
    .map((row, index) => {
      const playerName = pick(row, ["PlayerName", "Player", "Name"]);
      if (!playerName) return null;
      const rawMatchId = pick(row, ["MatchID", "Match Id", "Match", "Game", "Round", "Fixture"]);
      const matchId = normalizeMatchId(rawMatchId);
      if (isInvalidMatchId(matchId)) return null;
      const opposition = pick(row, ["Opposition", "Opponent", "Opp"]);
      const assistsShots = toNumber(pick(row, ["Assists_Shots", "Assists Shots"]));
      const assistsGoals = toNumber(pick(row, ["Assists_Goals", "Assists Goals"]));
      const assistsTwoPoints = toNumber(pick(row, ["Assists_2 Points", "Assists_2_Points", "Assists 2 Points"]));
      const forceTurnoverWin = toNumber(pick(row, ["Force Turnover Win", "Force_Turnover_Win", "Forced TO Win"]));
      const kickawayToReceived = toNumber(pick(row, ["Kickaway TO Received", "Kickaway_TO_Received"]));
      const turnoversInContact = toNumber(pick(row, ["Turnovers in Contact", "Turnovers \n in Contact", "Turnovers\nin Contact", "Turnovers inContact"]));
      const turnoverSkillError = toNumber(pick(row, ["Turnover Skill Error", "Turnover_Skill_Error"]));
      const turnoversKickedAway = toNumber(pick(row, ["Turnovers Kicked Away", "Turnovers \n Kicked Away", "Turnovers\nKicked Away"]));
      const acceptableTurnover = toNumber(pick(row, ["Acceptable Turnover", "Acceptable_Turnover"]));
      const koWonCleanP1Our = toNumber(pick(row, ["Won Clean P1_OUR"]));
      const koWonCleanP2Our = toNumber(pick(row, ["Won Clean P2_OUR"]));
      const koWonCleanP3Our = toNumber(pick(row, ["Won Clean P3_OUR"]));
      const koWonBreakOur = toNumber(pick(row, ["Won Break_OUR"]));
      const koWonCleanP1Opp = toNumber(pick(row, ["Won Clean P1_OPP"]));
      const koWonCleanP2Opp = toNumber(pick(row, ["Won Clean P2_OPP"]));
      const koWonCleanP3Opp = toNumber(pick(row, ["Won Clean P3_OPP"]));
      const koWonBreakOpp = toNumber(pick(row, ["Won Break_OPP"]));
      const koTargetWonClean = toNumber(pick(row, ["KO_TARGET_WON_CLEAN", "KO Target Won Clean"]));
      const koTargetWonBreak = toNumber(pick(row, ["KO_TARGET_WON_BREAK", "KO Target Won Break"]));
      const koTargetLostClean = toNumber(pick(row, ["KO_TARGET_LOST_CLEAN", "KO Target Lost Clean"]));
      const koTargetLostContest = toNumber(pick(row, ["KO_TARGET_LOST_CONTEST", "KO Target Lost Contest"]));
      const ourKoContestUs = toNumber(pick(row, ["OUR_KO_Contest_Us", "OUR KO Contest Us"]));
      const ourKoContestOpp = toNumber(pick(row, ["OUR_KO_Contest_Opp", "OUR KO Contest Opp"]));
      const theirKoContestUs = toNumber(pick(row, ["THEIR_Ko_Contest_Us", "THEIR KO Contest Us"]));
      const theirKoContestOpp = toNumber(pick(row, ["THEIR_KO_Contest_Opp", "THEIR KO Contest Opp"]));
      const koWinsOur = koWonCleanP1Our + koWonCleanP2Our + koWonCleanP3Our + koWonBreakOur;
      const koWinsOpp = koWonCleanP1Opp + koWonCleanP2Opp + koWonCleanP3Opp + koWonBreakOpp;
      const koContestsOur = toNumber(pick(row, ["Ko_Contest_Us", "KO Contest Us"])) || ourKoContestUs + ourKoContestOpp || koWinsOur;
      const koContestsOpp = toNumber(pick(row, ["KO_Contest_Opp", "KO Contest Opp"])) || theirKoContestUs + theirKoContestOpp || koWinsOpp;

      return applyImpactScores({
        key: `${matchDedupKey(matchId)}|${playerName}|${index}`,
        matchId,
        matchLabel: formatMatchLabel(matchId, opposition),
        opposition,
        date: pick(row, ["Date", "Match Date", "Game Date"]),
        playerId: pick(row, ["PlayerID", "Player Id"]) || playerId(playerName),
        playerName,
        totalMinutes: toNumber(pick(row, ["Total Minutes", "TotalMinutes", "Minutes Played", "Minutes"])),
        pts: toNumber(pick(row, ["Pts", "Points"])),
        simpleReceive: toNumber(pick(row, ["Simple Receive", "Simple_Receive"])),
        advanceReceive: toNumber(pick(row, ["Advance Receive", "Advance_Receive"])),
        goalsScored: toNumber(pick(row, ["Goals_Scored", "Goals Scored"])),
        tackles: toNumber(pick(row, ["Tackles", "Tackles (no TO)", "Tackles no TO"])),
        kickawayToReceived,
        duelsContested: toNumber(pick(row, ["Duels Contested", "Duels – Contested", "Duels - Contested"])),
        defensiveDuelsWon: toNumber(pick(row, ["Defensive Duels - Won", "Defensive Duels – Won", "Defensive Duels Won"])),
        dne: toNumber(pick(row, ["DNE", "Non Engagement", "Non-Engagement"])),
        duelsLost: toNumber(pick(row, ["Duels Lost", "Duels_Lost"])),
        breach1v1: toNumber(pick(row, ["Breach 1v1", "Breach_1v1"])),
        shotFreeConceded: toNumber(pick(row, ["Shot Free Conceded", "Shot_Free_Conceded"])),
        twoPointFreeConceded: toNumber(pick(row, ["2pt Free Conceded", "Two Point Free Conceded", "2pt_Free_Conceded"])),
        blackCard: toNumber(pick(row, ["Black Card", "Black_Card"])),
        redCard: toNumber(pick(row, ["Red Card", "Red_Card"])),
        simplePass: toNumber(pick(row, ["Simple Pass", "Simple_Pass"])),
        advancePass: toNumber(pick(row, ["Advance Pass", "Advance_Pass"])),
        carries: toNumber(pick(row, ["Carries"])),
        turnoversInContact,
        turnoverSkillError,
        turnoversKickedAway,
        acceptableTurnover,
        forceTurnoverWin,
        turnovers: turnoversInContact + turnoverSkillError + turnoversKickedAway + acceptableTurnover,
        assistsShots,
        assistsGoals,
        assistsTwoPoints,
        assists: assistsShots + assistsGoals + assistsTwoPoints,
        onePointerAttempts: toNumber(pick(row, ["One_Pointer_Attempts", "One Pointer Attempts"])),
        onePointerScored: toNumber(pick(row, ["One_Pointer_Scored", "One Pointer Scored"])),
        onePointerWide: toNumber(pick(row, ["One_Pointer_Wide", "One Pointer Wide"])),
        twoPointerAttempts: toNumber(pick(row, ["Two_Pointer_Attempts", "Two Pointer Attempts"])),
        twoPointerScored: toNumber(pick(row, ["Two_Pointer_Scored", "Two Pointer Scored"])),
        twoPointerWide: toNumber(pick(row, ["Two_Pointer_Wide", "Two Pointer Wide"])),
        goalAttempts: toNumber(pick(row, ["Goal_Attempts", "Goal Attempts"])),
        goalsWide: toNumber(pick(row, ["Goals_Wide", "Goals Wide"])),
        dropShorts: toNumber(pick(row, ["Drop_Shorts", "Drop Shorts"])),
        freeOnePointerAttempts: toNumber(pick(row, ["One_Pointer_Attempts_F", "Free One_Pointer_Attempts", "Free One Pointer Attempts"])),
        freeOnePointerScored: toNumber(pick(row, ["One_Pointer_Scored_F", "Free One_Pointer_Scored", "Free One Pointer Scored"])),
        freeTwoPointerAttempts: toNumber(pick(row, ["Two_Pointer_Attempts_F", "Free Two_Pointer_Attempts", "Free Two Pointer Attempts"])),
        freeTwoPointerScored: toNumber(pick(row, ["Two_Pointer_Scored_F", "Free Two_Pointer_Scored", "Free Two Pointer Scored"])),
        freeGoalAttempts: toNumber(pick(row, ["Goal_Attempts_F", "Free Goal_Attempts", "Free Goal Attempts"])),
        freeGoalsScored: toNumber(pick(row, ["Goals_Scored_F", "Free Goals_Scored", "Free Goals Scored"])),
        attackImpact: 0,
        transitionImpact: 0,
        defenseImpact: 0,
        turnoverImpact: 0,
        kickoutImpact: 0,
        totalImpact: 0,
        koWonCleanP1Our,
        koWonCleanP2Our,
        koWonCleanP3Our,
        koWonBreakOur,
        koWonCleanP1Opp,
        koWonCleanP2Opp,
        koWonCleanP3Opp,
        koWonBreakOpp,
        koTargetWonClean,
        koTargetWonBreak,
        koTargetLostClean,
        koTargetLostContest,
        ourKoContestUs,
        ourKoContestOpp,
        theirKoContestUs,
        theirKoContestOpp,
        koWinsOur,
        koContestsOur,
        koWinsOpp,
        koContestsOpp
      });
    })
    .filter((record): record is MatchStatRecord => Boolean(record));
}

function parseLeaderboardMatchId(row: ParsedRow): string {
  const matchId = normalizeMatchId(pick(row, ["MatchID", "Match Id", "Match", "Game", "Round", "Fixture"]));
  return isInvalidMatchId(matchId) ? "" : matchId;
}

function parsePerformanceLeaderboardRows(rows: ParsedRow[]): PerformanceLeaderboardRecord[] {
  return rows
    .map((row, index) => {
      const playerName = pick(row, ["PlayerName", "Player", "Name"]);
      if (!playerName) return null;
      const matchId = parseLeaderboardMatchId(row);
      if (!matchId) return null;
      return {
        key: `${matchId}|${playerName}|perf|${index}`,
        matchId,
        playerId: pick(row, ["PlayerID", "Player Id"]) || playerId(playerName),
        playerName,
        minutes: toNumber(pick(row, ["Minutes", "Total Minutes", "Minutes Played"])),
        overallImpact: toNumber(pick(row, ["Overall Impact", "Top Overall Impact", "Total Impact", "Impact", "All Impact"])),
        attackImpact: toNumber(pick(row, ["Attack Impact", "Top Attack Impact", "Attack"])),
        defenseImpact: toNumber(pick(row, ["Defense Impact", "Defence Impact", "Top Defense Impact", "Top Defence Impact", "Defense", "Defence"])),
        transitionImpact: toNumber(pick(row, ["Transition Impact", "Top Transition Impact", "Transition"]))
      };
    })
    .filter((record): record is PerformanceLeaderboardRecord => Boolean(record));
}

function parseShootingLeaderboardRows(rows: ParsedRow[]): ShootingLeaderboardRecord[] {
  return rows
    .map((row, index) => {
      const playerName = pick(row, ["PlayerName", "Player", "Name"]);
      if (!playerName) return null;
      const matchId = parseLeaderboardMatchId(row);
      if (!matchId) return null;
      return {
        key: `${matchId}|${playerName}|shoot|${index}`,
        matchId,
        playerId: pick(row, ["PlayerID", "Player Id"]) || playerId(playerName),
        playerName,
        minutes: toNumber(pick(row, ["Minutes", "Total Minutes", "Minutes Played"])),
        playOverallEvPerShot: toNumber(pick(row, ["Play Overall EV/Shot", "Top Play Overall EV/Shot", "Play Overall EV Shot"])),
        freeOverallEvPerShot: toNumber(pick(row, ["Free Overall EV/Shot", "Top Free Overall EV/Shot", "Free Overall EV Shot"])),
        playOnePointerEv: toNumber(pick(row, ["Play 1-Pointer EV", "Top Play 1-Pointer EV", "Play 1 Pointer EV"])),
        freeOnePointerEv: toNumber(pick(row, ["Free 1-Pointer EV", "Top Free 1-Pointer EV", "Free 1 Pointer EV"]))
      };
    })
    .filter((record): record is ShootingLeaderboardRecord => Boolean(record));
}

function buildFallbackPerformance(records: MatchStatRecord[]): PerformanceLeaderboardRecord[] {
  return records.map((record, index) => ({
    key: `${record.key}|perf-fallback|${index}`,
    matchId: record.matchId,
    playerId: record.playerId,
    playerName: record.playerName,
    minutes: record.totalMinutes,
    overallImpact: record.totalImpact,
    attackImpact: record.attackImpact,
    defenseImpact: record.defenseImpact,
    transitionImpact: record.transitionImpact
  }));
}

function buildFallbackShooting(inputRows: ParsedRow[], records: MatchStatRecord[]): ShootingLeaderboardRecord[] {
  const freeByKey = new Map<string, ReturnType<typeof getFreeShotCounts>>();
  inputRows.forEach((row, index) => {
    const playerName = pick(row, ["PlayerName", "Player", "Name"]);
    if (!playerName) return;
    const matchId = normalizeMatchId(pick(row, ["MatchID", "Match Id", "Match", "Game", "Round", "Fixture"]));
    if (!matchId || isInvalidMatchId(matchId)) return;
    freeByKey.set(`${matchId}|${playerName}`, getFreeShotCounts(row));
  });

  return records.map((record, index) => {
    const free = freeByKey.get(`${record.matchId}|${record.playerName}`) ?? {
      freeOnePointerAttempts: 0,
      freeOnePointerScored: 0,
      freeTwoPointerAttempts: 0,
      freeTwoPointerScored: 0,
      freeGoalAttempts: 0,
      freeGoalsScored: 0
    };
    const playAttempts = record.onePointerAttempts + record.twoPointerAttempts + record.goalAttempts;
    const playScoresValue = record.onePointerScored + record.twoPointerScored * 2 + record.goalsScored * 3;
    const freeAttempts = free.freeOnePointerAttempts + free.freeTwoPointerAttempts + free.freeGoalAttempts;
    const freeScoresValue = free.freeOnePointerScored + free.freeTwoPointerScored * 2 + free.freeGoalsScored * 3;

    return {
      key: `${record.key}|shoot-fallback|${index}`,
      matchId: record.matchId,
      playerId: record.playerId,
      playerName: record.playerName,
      minutes: record.totalMinutes,
      playOverallEvPerShot: safeDivide(playScoresValue, playAttempts),
      freeOverallEvPerShot: safeDivide(freeScoresValue, freeAttempts),
      playOnePointerEv: safeDivide(record.onePointerScored, record.onePointerAttempts),
      freeOnePointerEv: safeDivide(free.freeOnePointerScored, free.freeOnePointerAttempts)
    };
  });
}

function readTabsCache(sheetId: string): CachedTabsPayload["tabs"] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TABS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedTabsPayload>;
    if (!parsed || parsed.sheetId !== sheetId || !parsed.tabs) return null;
    return parsed.tabs;
  } catch {
    return null;
  }
}

function writeTabsCache(sheetId: string, tabs: CachedTabsPayload["tabs"]) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedTabsPayload = {
      sheetId,
      fetchedAt: new Date().toISOString(),
      tabs
    };
    window.localStorage.setItem(TABS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors.
  }
}

async function fetchSnapshotTabs(sheetId: string, apiKey: string): Promise<CachedTabsPayload["tabs"]> {
  const [input, performance, shooting, impact, categories] = await Promise.all([
    fetchFirstAvailable(sheetId, apiKey, TAB_CANDIDATES.input),
    fetchOptionalTab(sheetId, apiKey, TAB_CANDIDATES.performance),
    fetchOptionalTab(sheetId, apiKey, TAB_CANDIDATES.shooting),
    fetchOptionalTab(sheetId, apiKey, TAB_CANDIDATES.impact),
    fetchOptionalTab(sheetId, apiKey, TAB_CANDIDATES.categories)
  ]);
  return {
    input,
    performance: performance ?? undefined,
    shooting: shooting ?? undefined,
    impact: impact ?? undefined,
    categories: categories ?? undefined
  };
}

export async function primeLiveSheetsCache(): Promise<void> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || import.meta.env.VITE_SHEETS_API_KEY;
  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID || SHEET_ID;
  if (!apiKey || readTabsCache(sheetId)) return;
  try {
    const tabs = await fetchSnapshotTabs(sheetId, apiKey);
    writeTabsCache(sheetId, tabs);
  } catch {
    // Ignore warm-up failures.
  }
}

export async function buildLiveSnapshot(role: SnapshotResponse["auth"]["role"], userId: string, ownPlayerId?: string): Promise<SnapshotResponse> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || import.meta.env.VITE_SHEETS_API_KEY;
  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID || SHEET_ID;

  if (!apiKey) {
    throw new Error("Unable to load data. Please check your API key or connection.");
  }

  let tabs: CachedTabsPayload["tabs"];
  try {
    tabs = await fetchSnapshotTabs(sheetId, apiKey);
    writeTabsCache(sheetId, tabs);
  } catch (error) {
    const cached = readTabsCache(sheetId);
    if (!cached?.input) {
      throw error;
    }
    tabs = cached;
  }

  if (!tabs.input) {
    throw new Error("Unable to load data. Please check your API key or connection.");
  }

  const inputRows = parseRows(tabs.input.values);
  const performanceRows = tabs.performance ? parseRows(tabs.performance.values) : [];
  const shootingRows = tabs.shooting ? parseRows(tabs.shooting.values) : [];

  const records = parseInputRecords(inputRows);
  const validPlayedMatchIds = new Set(buildMatchOrder(records).map((match) => match.matchId));
  const playedRecords = records.filter((record) => validPlayedMatchIds.has(normalizeMatchId(record.matchId)));
  const availablePlayerIds = Array.from(new Set(playedRecords.map((record) => record.playerId)));
  const resolvedOwnPlayerId = role === "player" ? ownPlayerId ?? availablePlayerIds[0] : ownPlayerId;
  const visiblePlayerIds = role === "player" ? (resolvedOwnPlayerId ? [resolvedOwnPlayerId] : []) : availablePlayerIds;
  const scopedRecords = role === "player" ? playedRecords.filter((record) => record.playerId === resolvedOwnPlayerId) : playedRecords;

  const scopedPlayerIds = new Set(scopedRecords.map((record) => record.playerId));
  const players = Object.fromEntries(
    playedRecords
      .filter((record) => scopedPlayerIds.has(record.playerId))
      .map((record) => [
        record.playerId,
        {
          playerId: record.playerId,
          name: record.playerName,
          number: "",
          position: ""
        }
      ])
  );

  const performanceLeaderboardSource = parsePerformanceLeaderboardRows(performanceRows);
  const shootingLeaderboardSource = parseShootingLeaderboardRows(shootingRows);
  const fallbackPerformance = buildFallbackPerformance(playedRecords);
  const fallbackShooting = buildFallbackShooting(inputRows, playedRecords);

  const performanceLeaderboard = (performanceLeaderboardSource.length ? performanceLeaderboardSource : fallbackPerformance).filter((entry) =>
    role === "player" ? entry.playerId === resolvedOwnPlayerId : true
  );
  const shootingLeaderboard = (shootingLeaderboardSource.length ? shootingLeaderboardSource : fallbackShooting).filter((entry) =>
    role === "player" ? entry.playerId === resolvedOwnPlayerId : true
  );

  return {
    meta: {
      sourceSheetId: sheetId,
      fetchedAt: new Date().toISOString(),
      version: "v4-live",
      sourceTabs: {
        input: tabs.input.tab,
        performance: tabs.performance?.tab,
        shooting: tabs.shooting?.tab,
        impact: tabs.impact?.tab,
        categories: tabs.categories?.tab
      }
    },
    auth: {
      userId,
      role,
      playerId: resolvedOwnPlayerId
    },
    permissions: permissionsForRole(role),
    visiblePlayerIds,
    players,
    filters: {
      defaultOptionId: "all",
      options: buildFilterOptions(records)
    },
    records: scopedRecords,
    performanceLeaderboard,
    shootingLeaderboard
  };
}
