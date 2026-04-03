import { getSettings } from "./store";
import type { ApiUser } from "./types";
import { permissionsForRole } from "../../src/rbac/permissions";
import type { DashboardFilterOption, MatchStatRecord, SnapshotResponse } from "../../src/types";

const sheetTabs = {
  input: ["Input Sheet AFL"],
  impact: ["Inpact Score AFL", "Impact Score AFL"],
  categories: ["CategoryScores"]
} as const;

type Grid = string[][];
type ParsedRow = Record<string, string>;

type SnapshotPayload = SnapshotResponse;

async function fetchTabValues(sheetId: string, tab: string, apiKey: string): Promise<Grid> {
  const encoded = encodeURIComponent(`${tab}!A1:ZZ`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encoded}?key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Tab fetch failed: ${tab}`);
  }
  const body = (await response.json()) as { values?: string[][] };
  return body.values ?? [];
}

async function fetchFirstAvailable(sheetId: string, apiKey: string, tabs: readonly string[]): Promise<{ tab: string; values: Grid }> {
  for (const tab of tabs) {
    try {
      const values = await fetchTabValues(sheetId, tab, apiKey);
      if (values.length > 0) return { tab, values };
    } catch {
      // try next tab
    }
  }
  throw new Error(`Could not read any tab from: ${tabs.join(", ")}`);
}

async function fetchOptionalTab(sheetId: string, apiKey: string, tabs: readonly string[]): Promise<{ tab: string; values: Grid } | null> {
  try {
    return await fetchFirstAvailable(sheetId, apiKey, tabs);
  } catch {
    return null;
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
    if (hit && hit[1] !== "") return hit[1];
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
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function matchDedupKey(value: string): string {
  return normalizeMatchId(value).replace(/[^A-Z0-9]/g, "");
}

function isInvalidMatchId(value: string): boolean {
  const normalized = normalizeMatchId(value);
  if (!normalized) return true;
  if (/^BATCH\b/i.test(normalized)) return true;
  if (/^PLAYER\b/i.test(normalized)) return true;
  return false;
}

function parseDateValue(value: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatMatchLabel(matchId: string, opposition: string): string {
  return opposition ? `${matchId} — vs ${opposition}` : matchId;
}

function parseLeaderboardMatchId(row: ParsedRow): string {
  const matchId = normalizeMatchId(pick(row, ["MatchID", "Match Id", "Match", "Game", "Round", "Fixture"]));
  return isInvalidMatchId(matchId) ? "" : matchId;
}

function parseInputRecords(inputRows: ParsedRow[]): MatchStatRecord[] {
  return inputRows
    .map((row, index) => {
      const playerName = pick(row, ["PlayerName", "Player", "Name"]);
      if (!playerName) return null;
      const matchId = normalizeMatchId(pick(row, ["MatchID", "Match Id", "Match", "Game", "Round", "Fixture"]));
      if (isInvalidMatchId(matchId)) return null;
      const opposition = pick(row, ["Opposition", "Opponent", "Opp"]);
      const assistsShots = toNumber(pick(row, ["Assists_Shots", "Assists Shots"]));
      const assistsGoals = toNumber(pick(row, ["Assists_Goals", "Assists Goals"]));
      const turnoversInContact = toNumber(pick(row, ["Turnovers in Contact", "Turnovers \n in Contact", "Turnovers\nin Contact", "Turnovers inContact"]));
      const turnoverSkillError = toNumber(pick(row, ["Turnover Skill Error", "Turnover_Skill_Error"]));
      const turnoversKickedAway = toNumber(pick(row, ["Turnovers Kicked Away", "Turnovers \n Kicked Away", "Turnovers\nKicked Away"]));
      const koOurP1 = toNumber(pick(row, ["Won Clean P1_OUR"]));
      const koOurP2 = toNumber(pick(row, ["Won Clean P2_OUR"]));
      const koOurP3 = toNumber(pick(row, ["Won Clean P3_OUR"]));
      const koOurBreak = toNumber(pick(row, ["Won Break_OUR"]));
      const koOppP1 = toNumber(pick(row, ["Won Clean P1_OPP"]));
      const koOppP2 = toNumber(pick(row, ["Won Clean P2_OPP"]));
      const koOppP3 = toNumber(pick(row, ["Won Clean P3_OPP"]));
      const koOppBreak = toNumber(pick(row, ["Won Break_OPP"]));
      const koWinsOur = koOurP1 + koOurP2 + koOurP3 + koOurBreak;
      const koWinsOpp = koOppP1 + koOppP2 + koOppP3 + koOppBreak;
      const koContestsOur = toNumber(pick(row, ["Ko_Contest_Us", "KO Contest Us"])) || koWinsOur;
      const koContestsOpp = toNumber(pick(row, ["KO_Contest_Opp", "KO Contest Opp"])) || koWinsOpp;

      return {
        key: `${matchDedupKey(matchId)}|${playerName}|${index}`,
        matchId,
        matchLabel: formatMatchLabel(matchId, opposition),
        opposition,
        date: pick(row, ["Date", "Match Date", "Game Date"]),
        playerId: pick(row, ["PlayerID", "Player Id"]) || playerId(playerName),
        playerName,
        totalMinutes: toNumber(pick(row, ["Total Minutes", "TotalMinutes", "Minutes Played", "Minutes"])),
        pts: toNumber(pick(row, ["Pts", "Points"])),
        goalsScored: toNumber(pick(row, ["Goals_Scored", "Goals Scored"])),
        tackles: toNumber(pick(row, ["Tackles", "Tackles (no TO)", "Tackles no TO"])),
        duelsContested: toNumber(pick(row, ["Duels Contested", "Duels – Contested", "Duels - Contested"])),
        duelsLost: toNumber(pick(row, ["Duels Lost", "Duels_Lost"])),
        simplePass: toNumber(pick(row, ["Simple Pass", "Simple_Pass"])),
        advancePass: toNumber(pick(row, ["Advance Pass", "Advance_Pass"])),
        carries: toNumber(pick(row, ["Carries"])),
        turnoversInContact,
        turnoverSkillError,
        turnoversKickedAway,
        turnovers: turnoversInContact + turnoverSkillError + turnoversKickedAway,
        assistsShots,
        assistsGoals,
        assists: assistsShots + assistsGoals,
        onePointerAttempts: toNumber(pick(row, ["One_Pointer_Attempts", "One Pointer Attempts"])),
        onePointerScored: toNumber(pick(row, ["One_Pointer_Scored", "One Pointer Scored"])),
        twoPointerAttempts: toNumber(pick(row, ["Two_Pointer_Attempts", "Two Pointer Attempts"])),
        twoPointerScored: toNumber(pick(row, ["Two_Pointer_Scored", "Two Pointer Scored"])),
        goalAttempts: toNumber(pick(row, ["Goal_Attempts", "Goal Attempts"])),
        attackImpact: 0,
        transitionImpact: 0,
        defenseImpact: 0,
        totalImpact: 0,
        koWinsOur,
        koContestsOur,
        koWinsOpp,
        koContestsOpp
      };
    })
    .filter((record): record is MatchStatRecord => Boolean(record));
}

function enrichRecords(records: MatchStatRecord[], categoryRows: ParsedRow[], impactRows: ParsedRow[]): MatchStatRecord[] {
  const categoryByKey = new Map<string, ParsedRow>();
  const impactByKey = new Map<string, ParsedRow>();

  for (const row of categoryRows) {
    const playerName = pick(row, ["PlayerName", "Player", "Name"]);
    const matchId = parseLeaderboardMatchId(row);
    if (!playerName || !matchId) continue;
    categoryByKey.set(`${matchId}|${playerName}`, row);
  }

  for (const row of impactRows) {
    const playerName = pick(row, ["PlayerName", "Player", "Name"]);
    const matchId = parseLeaderboardMatchId(row);
    if (!playerName || !matchId) continue;
    impactByKey.set(`${matchId}|${playerName}`, row);
  }

  return records.map((record) => {
    const lookupKey = `${record.matchId}|${record.playerName}`;
    const category = categoryByKey.get(lookupKey);
    const impact = impactByKey.get(lookupKey);
    const attackImpact = category ? toNumber(pick(category, ["Attack Impact", "Attack"])) : record.pts + record.assists;
    const defenseImpact = category ? toNumber(pick(category, ["Defensive Impact", "Defense Impact", "Defence Impact"])) : record.tackles + record.duelsContested - record.duelsLost;
    const transitionImpact = category ? toNumber(pick(category, ["Transition Impact", "Transition"])) : record.carries + record.advancePass + record.simplePass * 0.25 - record.turnovers;
    const totalImpact = impact ? toNumber(pick(impact, ["Total Impact", "Total IMPACT", "Impact"])) : attackImpact + defenseImpact + transitionImpact;
    return { ...record, attackImpact, defenseImpact, transitionImpact, totalImpact };
  });
}

function buildMatchOptions(records: MatchStatRecord[]): DashboardFilterOption[] {
  const seen = new Map<string, { matchId: string; opposition: string; date: string; order: number; hasActivity: boolean }>();
  records.forEach((record, index) => {
    const key = matchDedupKey(record.matchId);
    if (!key || isInvalidMatchId(record.matchId)) return;
    const hasActivity =
      record.totalMinutes > 0 ||
      record.pts > 0 ||
      record.goalsScored > 0 ||
      record.tackles > 0 ||
      record.duelsContested > 0 ||
      record.simplePass > 0 ||
      record.advancePass > 0 ||
      record.carries > 0 ||
      record.turnovers > 0 ||
      record.assists > 0 ||
      record.totalImpact > 0 ||
      record.koContestsOur > 0 ||
      record.koContestsOpp > 0;
    const current = seen.get(key);
    if (!current) {
      seen.set(key, { matchId: record.matchId, opposition: record.opposition, date: record.date, order: index, hasActivity });
      return;
    }
    current.hasActivity = current.hasActivity || hasActivity;
    if (!current.opposition && record.opposition) current.opposition = record.opposition;
    if (!current.date && record.date) current.date = record.date;
  });

  const matches = Array.from(seen.values())
    .filter((match) => match.hasActivity)
    .sort((left, right) => {
      const leftDate = parseDateValue(left.date);
      const rightDate = parseDateValue(right.date);
      if (leftDate != null && rightDate != null && leftDate !== rightDate) return leftDate - rightDate;
      return left.order - right.order;
    });

  return [
    { id: "all", label: "All", description: `Combined view across ${matches.length || 1} matches` },
    ...matches.map((match) => ({
      id: match.matchId,
      label: formatMatchLabel(match.matchId, match.opposition),
      description: match.date ? `${match.matchId} on ${match.date}` : `Filter to ${match.matchId}`
    }))
  ];
}

function parsePerformanceLeaderboardRows(rows: ParsedRow[]) {
  return rows
    .map((row, index) => {
      const playerName = pick(row, ["PlayerName", "Player", "Name"]);
      const matchId = parseLeaderboardMatchId(row);
      if (!playerName || !matchId) return null;
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
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function parseShootingLeaderboardRows(rows: ParsedRow[]) {
  return rows
    .map((row, index) => {
      const playerName = pick(row, ["PlayerName", "Player", "Name"]);
      const matchId = parseLeaderboardMatchId(row);
      if (!playerName || !matchId) return null;
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
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function buildFallbackShooting(inputRows: ParsedRow[], records: MatchStatRecord[]) {
  const freeByKey = new Map<string, ReturnType<typeof getFreeShotCounts>>();
  inputRows.forEach((row) => {
    const playerName = pick(row, ["PlayerName", "Player", "Name"]);
    const matchId = normalizeMatchId(pick(row, ["MatchID", "Match Id", "Match", "Game", "Round", "Fixture"]));
    if (!playerName || !matchId || isInvalidMatchId(matchId)) return;
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

function getFreeShotCounts(row: ParsedRow) {
  const freeOnePointerAttempts = toNumber(pick(row, ["One_Pointer_Attempts_F", "Free One_Pointer_Attempts", "Free One Pointer Attempts"]));
  const freeOnePointerScored = toNumber(pick(row, ["One_Pointer_Scored_F", "Free One_Pointer_Scored", "Free One Pointer Scored"]));
  const freeTwoPointerAttempts = toNumber(pick(row, ["Two_Pointer_Attempts_F", "Free Two_Pointer_Attempts", "Free Two Pointer Attempts"]));
  const freeTwoPointerScored = toNumber(pick(row, ["Two_Pointer_Scored_F", "Free Two_Pointer_Scored", "Free Two Pointer Scored"]));
  const freeGoalAttempts = toNumber(pick(row, ["Goal_Attempts_F", "Free Goal_Attempts", "Free Goal Attempts"]));
  const freeGoalsScored = toNumber(pick(row, ["Goals_Scored_F", "Free Goals_Scored", "Free Goals Scored"]));
  return { freeOnePointerAttempts, freeOnePointerScored, freeTwoPointerAttempts, freeTwoPointerScored, freeGoalAttempts, freeGoalsScored };
}

export async function buildSnapshot(user: ApiUser): Promise<SnapshotPayload> {
  const settings = getSettings();
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error("Unable to load data. Please check your API key or connection.");
  }

  const [inputTab, impactTab, categoriesTab, performanceTab, shootingTab] = await Promise.all([
    fetchFirstAvailable(settings.sheetId, apiKey, sheetTabs.input),
    fetchFirstAvailable(settings.sheetId, apiKey, sheetTabs.impact),
    fetchFirstAvailable(settings.sheetId, apiKey, sheetTabs.categories),
    fetchOptionalTab(settings.sheetId, apiKey, ["Performance Leaderboard"]),
    fetchOptionalTab(settings.sheetId, apiKey, ["Shooting Leaderboard"])
  ]);

  const inputRows = parseRows(inputTab.values);
  const impactRows = parseRows(impactTab.values);
  const categoryRows = parseRows(categoriesTab.values);
  const performanceRows = performanceTab ? parseRows(performanceTab.values) : [];
  const shootingRows = shootingTab ? parseRows(shootingTab.values) : [];

  const records = enrichRecords(parseInputRecords(inputRows), categoryRows, impactRows);
  const validPlayedMatchIds = new Set(buildMatchOptions(records).filter((option) => option.id !== "all").map((option) => option.id));
  const playedRecords = records.filter((record) => validPlayedMatchIds.has(record.matchId));
  const availablePlayerIds = Array.from(new Set(playedRecords.map((record) => record.playerId)));
  const resolvedPlayerId = user.role === "player" ? user.playerId ?? availablePlayerIds[0] : user.playerId;
  const scopedRecords = user.role === "player" ? playedRecords.filter((record) => record.playerId === resolvedPlayerId) : playedRecords;
  const visiblePlayerIds = user.role === "player" ? (resolvedPlayerId ? [resolvedPlayerId] : []) : availablePlayerIds;
  const scopedPlayerIds = new Set(scopedRecords.map((record) => record.playerId));

  const players = Object.fromEntries(
    playedRecords
      .filter((record) => scopedPlayerIds.has(record.playerId))
      .map((record) => [record.playerId, { playerId: record.playerId, name: record.playerName, number: "", position: "" }])
  );

  const performanceLeaderboard = (performanceRows.length
    ? parsePerformanceLeaderboardRows(performanceRows)
    : scopedRecords.map((record, index) => ({
        key: `${record.key}|perf-fallback|${index}`,
        matchId: record.matchId,
        playerId: record.playerId,
        playerName: record.playerName,
        minutes: record.totalMinutes,
        overallImpact: record.totalImpact,
        attackImpact: record.attackImpact,
        defenseImpact: record.defenseImpact,
        transitionImpact: record.transitionImpact
      }))
  ).filter((entry) => (user.role === "player" ? entry.playerId === resolvedPlayerId : true) && validPlayedMatchIds.has(entry.matchId));

  const shootingLeaderboard = (shootingRows.length ? parseShootingLeaderboardRows(shootingRows) : buildFallbackShooting(inputRows, playedRecords)).filter(
    (entry) => (user.role === "player" ? entry.playerId === resolvedPlayerId : true) && validPlayedMatchIds.has(entry.matchId)
  );

  return {
    meta: {
      sourceSheetId: settings.sheetId,
      fetchedAt: new Date().toISOString(),
      version: "v4-api",
      sourceTabs: {
        input: inputTab.tab,
        impact: impactTab.tab,
        categories: categoriesTab.tab,
        performance: performanceTab?.tab,
        shooting: shootingTab?.tab
      }
    },
    auth: { ...user, playerId: resolvedPlayerId },
    permissions: permissionsForRole(user.role),
    visiblePlayerIds,
    players,
    filters: {
      defaultOptionId: "all",
      options: buildMatchOptions(playedRecords)
    },
    records: scopedRecords,
    performanceLeaderboard,
    shootingLeaderboard
  };
}
