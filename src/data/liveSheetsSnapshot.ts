import type { DashboardFilterOption, DashboardView, PlayerRow, PlayerView, SnapshotResponse, TopPerformer } from "@/types";
import { permissionsForRole } from "@/rbac/permissions";

const SHEET_ID = "1MP0mzEPAxo-Z9g0lmcipxLepjap6Vu3FSCXhbzaRpSU";
const TAB_CANDIDATES = {
  input: ["Input Sheet AFL"],
  impact: ["Inpact Score AFL", "Impact Score AFL"],
  categories: ["CategoryScores"]
};
const TABS_CACHE_KEY = "afl-live-sheets-tabs-cache:v1";
const DASHBOARD_TABS = ["All Impact", "Attack", "Transition", "Defence", "Turnovers", "Kickouts", "More"];

type Grid = string[][];
type ParsedRow = Record<string, string>;
type CachedTabsPayload = {
  sheetId: string;
  fetchedAt: string;
  tabs: {
    input: { tab: string; values: Grid };
    impact: { tab: string; values: Grid };
    categories: { tab: string; values: Grid };
  };
};

type GameAccumulator = {
  matchId: string;
  matchOrder: number;
  playerName: string;
  minutes: number;
  attack: number;
  transition: number;
  defence: number;
  totalImpact: number;
  koWinsOur: number;
  koTotalOur: number;
  koWinsOpp: number;
  koTotalOpp: number;
  koOurP1: number;
  koOurP2: number;
  koOurP3: number;
  koOurBreak: number;
  koOppP1: number;
  koOppP2: number;
  koOppP3: number;
  koOppBreak: number;
  onePtAttempts: number;
  onePtScored: number;
  twoPtAttempts: number;
  twoPtScored: number;
  goalAttempts: number;
  goalsScored: number;
  freeOnePtAttempts: number;
  freeOnePtScored: number;
  freeTwoPtAttempts: number;
  freeTwoPtScored: number;
  freeGoalAttempts: number;
  freeGoalsScored: number;
  assistsShots: number;
  assistsGoals: number;
  assistsTwoPoints: number;
  assistsTotalScores: number;
  turnovers: number;
};

type AggregatedPlayer = PlayerRow & {
  games: number;
  koWinsOur: number;
  koContestsOur: number;
  koOurP1: number;
  koOurP2: number;
  koOurP3: number;
  koOurBreak: number;
  koWinsOpp: number;
  koContestsOpp: number;
  koOppP1: number;
  koOppP2: number;
  koOppP3: number;
  koOppBreak: number;
  onePtAttempts: number;
  onePtScored: number;
  twoPtAttempts: number;
  twoPtScored: number;
  goalAttempts: number;
  goalsScored: number;
  freeAttempts: number;
  freeScored: number;
  assists: number;
  turnovers: number;
};

type SnapshotSlice = {
  dashboard: DashboardView;
  playerViews: Record<string, PlayerView>;
  players: Record<string, { playerId: string; name: string; number: string; position: string }>;
  visiblePlayerIds: string[];
  resolvedOwnPlayerId?: string;
};

function encodeRange(range: string): string {
  return encodeURIComponent(range);
}

async function fetchTab(sheetId: string, apiKey: string, tab: string): Promise<Grid | null> {
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

async function fetchFirstAvailable(sheetId: string, apiKey: string, tabs: string[]): Promise<{ tab: string; values: Grid }> {
  const misses: string[] = [];
  for (const tab of tabs) {
    try {
      const values = await fetchTab(sheetId, apiKey, tab);
      if (values && values.length > 0) {
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
  const tried = misses.length ? misses.join(", ") : tabs.join(", ");
  throw new Error(`Could not read any tab from: ${tried}`);
}

function findHeaderRow(values: Grid): number {
  for (let i = 0; i < Math.min(5, values.length); i += 1) {
    const row = values[i] ?? [];
    const nonEmpty = row.filter((cell) => String(cell ?? "").trim() !== "").length;
    if (nonEmpty >= 5 && row.some((cell) => /player|match|total/i.test(String(cell)))) {
      return i;
    }
  }
  return 0;
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((raw, i) => {
    const base = (raw || `col_${i + 1}`).trim() || `col_${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}__${count + 1}`;
  });
}

function parseRows(values: Grid): ParsedRow[] {
  if (!values.length) return [];
  const headerIndex = findHeaderRow(values);
  const headers = uniqueHeaders(values[headerIndex] ?? []);
  const rows = values.slice(headerIndex + 1);

  return rows
    .map((row) => {
      const record: ParsedRow = {};
      headers.forEach((header, idx) => {
        record[header] = (row[idx] ?? "").toString().trim();
      });
      return record;
    })
    .filter((row) => Object.values(row).some((value) => value !== ""));
}

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function pick(row: ParsedRow, candidates: string[]): string {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hit = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
    if (hit && hit[1] !== "") return hit[1];
  }
  return "";
}

function playerId(name: string): string {
  return `p-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown"}`;
}

function readTabsCache(sheetId: string): CachedTabsPayload["tabs"] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TABS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedTabsPayload>;
    if (!parsed || parsed.sheetId !== sheetId || !parsed.tabs) return null;
    if (!parsed.tabs.input?.tab || !parsed.tabs.impact?.tab || !parsed.tabs.categories?.tab) return null;
    if (!Array.isArray(parsed.tabs.input.values) || !Array.isArray(parsed.tabs.impact.values) || !Array.isArray(parsed.tabs.categories.values)) return null;
    return parsed.tabs as CachedTabsPayload["tabs"];
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
    // Ignore storage errors (private mode / quota).
  }
}

async function fetchSnapshotTabs(sheetId: string, apiKey: string): Promise<CachedTabsPayload["tabs"]> {
  const [input, impact, categories] = await Promise.all([
    fetchFirstAvailable(sheetId, apiKey, TAB_CANDIDATES.input),
    fetchFirstAvailable(sheetId, apiKey, TAB_CANDIDATES.impact),
    fetchFirstAvailable(sheetId, apiKey, TAB_CANDIDATES.categories)
  ]);
  return { input, impact, categories };
}

function makeTopPerformer(rows: AggregatedPlayer[], title: string, accessor: (row: AggregatedPlayer) => number): TopPerformer {
  const top = rows.slice().sort((a, b) => accessor(b) - accessor(a))[0];
  return {
    title,
    playerId: top?.playerId ?? "",
    playerName: top?.name ?? "-",
    number: top?.number ?? "",
    position: top?.position ?? "",
    value: top ? accessor(top) : 0,
    rounds: [0, 0, 0, 0]
  };
}

function buildPlayerView(row: AggregatedPlayer): PlayerView {
  return {
    playerId: row.playerId,
    header: {
      playerName: row.name,
      subtitle: `${row.position}${row.number ? ` ${row.number}` : ""}`,
      scoresFor: Math.round(row.att60 + row.trans60),
      turnoversAgainst: Math.round(row.def60)
    },
    cards: [
      {
        id: "overall",
        title: "Total Impact Score",
        metric: row.totalImpact.toFixed(1),
        lines: [
          { label: "Attack / 60", value: row.att60.toFixed(2), ratio: Math.min(1, row.att60 / 20) },
          { label: "Transition / 60", value: row.trans60.toFixed(2), ratio: Math.min(1, row.trans60 / 20) },
          { label: "Defence / 60", value: row.def60.toFixed(2), ratio: Math.min(1, row.def60 / 20) }
        ]
      },
      {
        id: "attack",
        title: "Attack Performance",
        metric: row.att60.toFixed(2),
        lines: [
          {
            label: "1PT EV",
            value: `${formatPct(safeDivide(row.onePtScored, row.onePtAttempts) * 100)} (${row.onePtScored}/${row.onePtAttempts})`,
            ratio: clamp01(safeDivide(row.onePtScored, row.onePtAttempts))
          },
          {
            label: "2PT EV",
            value: `${formatPct(safeDivide(row.twoPtScored, row.twoPtAttempts) * 100)} (${row.twoPtScored}/${row.twoPtAttempts})`,
            ratio: clamp01(safeDivide(row.twoPtScored, row.twoPtAttempts))
          },
          {
            label: "Goal EV",
            value: `${formatPct(safeDivide(row.goalsScored, row.goalAttempts) * 100)} (${row.goalsScored}/${row.goalAttempts})`,
            ratio: clamp01(safeDivide(row.goalsScored, row.goalAttempts))
          },
          { label: "Frees", value: `${row.freeScored}/${row.freeAttempts}`, ratio: clamp01(safeDivide(row.freeScored, row.freeAttempts)) },
          { label: "Assists", value: `${Math.round(row.assists)}`, ratio: clamp01(row.assists / 25) },
          { label: "Total Impact", value: row.totalImpact.toFixed(1), ratio: clamp01(row.totalImpact / 25) }
        ]
      },
      {
        id: "transition",
        title: "Transition Performance",
        metric: row.trans60.toFixed(2),
        lines: [{ label: "TRANS 60", value: row.trans60.toFixed(2), ratio: Math.min(1, row.trans60 / 20) }]
      },
      {
        id: "defence",
        title: "Defence Performance",
        metric: row.def60.toFixed(2),
        lines: [{ label: "DEF 60", value: row.def60.toFixed(2), ratio: Math.min(1, row.def60 / 20) }]
      },
      {
        id: "kickouts",
        title: "Kickout Performance",
        metric: `${row.koOurPct.toFixed(0)}%`,
        lines: [
          { label: "KO Wins", value: `${Math.round(row.koWinsOur)}`, ratio: clamp01(row.koWinsOur / 40) },
          { label: "KO Contests", value: `${Math.round(row.koContestsOur)}`, ratio: clamp01(row.koContestsOur / 40) },
          { label: "KO Win %", value: `${row.koOurPct.toFixed(0)}%`, ratio: clamp01(row.koOurPct / 100) },
          { label: "Opp KO Win %", value: `${row.koOppPct.toFixed(0)}%`, ratio: clamp01(row.koOppPct / 100) }
        ]
      },
      {
        id: "ourKickouts",
        title: "Our Kickouts",
        metric: `${Math.round(row.koContestsOur)}`,
        lines: [
          { label: "KO Contests", value: `${Math.round(row.koContestsOur)}`, ratio: clamp01(row.koContestsOur / 40) },
          { label: "Clean P1", value: `${Math.round(row.koOurP1)}`, ratio: clamp01(row.koOurP1 / 20) },
          { label: "Clean P2", value: `${Math.round(row.koOurP2)}`, ratio: clamp01(row.koOurP2 / 20) },
          { label: "Clean P3", value: `${Math.round(row.koOurP3)}`, ratio: clamp01(row.koOurP3 / 20) },
          { label: "Break", value: `${Math.round(row.koOurBreak)}`, ratio: clamp01(row.koOurBreak / 20) },
          { label: "KO Wins", value: `${Math.round(row.koWinsOur)} (${row.koOurPct.toFixed(0)}%)`, ratio: clamp01(row.koOurPct / 100) }
        ]
      },
      {
        id: "oppKickouts",
        title: "Opp Kickouts",
        metric: `${Math.round(row.koContestsOpp)}`,
        lines: [
          { label: "KO Contests", value: `${Math.round(row.koContestsOpp)}`, ratio: clamp01(row.koContestsOpp / 40) },
          { label: "P1", value: `${Math.round(row.koOppP1)}`, ratio: clamp01(row.koOppP1 / 20) },
          { label: "P2", value: `${Math.round(row.koOppP2)}`, ratio: clamp01(row.koOppP2 / 20) },
          { label: "P3", value: `${Math.round(row.koOppP3)}`, ratio: clamp01(row.koOppP3 / 20) },
          { label: "Break", value: `${Math.round(row.koOppBreak)}`, ratio: clamp01(row.koOppBreak / 20) },
          { label: "Opp KO Wins", value: `${Math.round(row.koWinsOpp)} (${row.koOppPct.toFixed(0)}%)`, ratio: clamp01(row.koOppPct / 100) }
        ]
      }
    ]
  };
}

function aggregatePlayers(games: GameAccumulator[]): AggregatedPlayer[] {
  const aggregatedByPlayer = new Map<string, Omit<AggregatedPlayer, "rank" | "playerId" | "name" | "position" | "number" | "minutes" | "att60" | "trans60" | "def60" | "koOurPct" | "koOppPct" | "totalImpact"> & {
    playerName: string;
    minutes: number;
    att60Sum: number;
    trans60Sum: number;
    def60Sum: number;
    koOurPctSum: number;
    koOppPctSum: number;
    totalImpactSum: number;
  }>();

  for (const game of games) {
    if (!game.playerName) continue;
    const key = playerId(game.playerName);
    const existing = aggregatedByPlayer.get(key) ?? {
      playerName: game.playerName,
      games: 0,
      minutes: 0,
      att60Sum: 0,
      trans60Sum: 0,
      def60Sum: 0,
      koOurPctSum: 0,
      koOppPctSum: 0,
      totalImpactSum: 0,
      koWinsOur: 0,
      koContestsOur: 0,
      koOurP1: 0,
      koOurP2: 0,
      koOurP3: 0,
      koOurBreak: 0,
      koWinsOpp: 0,
      koContestsOpp: 0,
      koOppP1: 0,
      koOppP2: 0,
      koOppP3: 0,
      koOppBreak: 0,
      onePtAttempts: 0,
      onePtScored: 0,
      twoPtAttempts: 0,
      twoPtScored: 0,
      goalAttempts: 0,
      goalsScored: 0,
      freeAttempts: 0,
      freeScored: 0,
      assists: 0,
      turnovers: 0
    };

    const gameAtt60 = game.minutes ? (game.attack / game.minutes) * 60 : 0;
    const gameTrans60 = game.minutes ? (game.transition / game.minutes) * 60 : 0;
    const gameDef60 = game.minutes ? (game.defence / game.minutes) * 60 : 0;
    const gameKoOurPct = game.koTotalOur > 0 ? (game.koWinsOur / game.koTotalOur) * 100 : 0;
    const gameKoOppPct = game.koTotalOpp > 0 ? (game.koWinsOpp / game.koTotalOpp) * 100 : Math.max(0, 100 - gameKoOurPct);

    existing.games += 1;
    existing.minutes += game.minutes;
    existing.att60Sum += gameAtt60;
    existing.trans60Sum += gameTrans60;
    existing.def60Sum += gameDef60;
    existing.koOurPctSum += gameKoOurPct;
    existing.koOppPctSum += gameKoOppPct;
    existing.totalImpactSum += game.totalImpact;
    existing.koWinsOur += game.koWinsOur;
    existing.koContestsOur += game.koTotalOur;
    existing.koOurP1 += game.koOurP1;
    existing.koOurP2 += game.koOurP2;
    existing.koOurP3 += game.koOurP3;
    existing.koOurBreak += game.koOurBreak;
    existing.koWinsOpp += game.koWinsOpp;
    existing.koContestsOpp += game.koTotalOpp;
    existing.koOppP1 += game.koOppP1;
    existing.koOppP2 += game.koOppP2;
    existing.koOppP3 += game.koOppP3;
    existing.koOppBreak += game.koOppBreak;
    existing.onePtAttempts += game.onePtAttempts;
    existing.onePtScored += game.onePtScored;
    existing.twoPtAttempts += game.twoPtAttempts;
    existing.twoPtScored += game.twoPtScored;
    existing.goalAttempts += game.goalAttempts;
    existing.goalsScored += game.goalsScored;
    existing.freeAttempts += game.freeOnePtAttempts + game.freeTwoPtAttempts + game.freeGoalAttempts;
    existing.freeScored += game.freeOnePtScored + game.freeTwoPtScored + game.freeGoalsScored;
    existing.assists += game.assistsTotalScores || game.assistsShots + game.assistsGoals + game.assistsTwoPoints;
    existing.turnovers += game.turnovers;

    aggregatedByPlayer.set(key, existing);
  }

  return Array.from(aggregatedByPlayer.entries())
    .map(([id, player]) => {
      const gamesPlayed = Math.max(1, player.games);
      return {
        rank: 0,
        playerId: id,
        name: player.playerName,
        position: "Player",
        number: "",
        games: player.games,
        minutes: player.minutes / gamesPlayed,
        att60: player.att60Sum / gamesPlayed,
        trans60: player.trans60Sum / gamesPlayed,
        def60: player.def60Sum / gamesPlayed,
        koOurPct: player.koOurPctSum / gamesPlayed,
        koOppPct: player.koOppPctSum / gamesPlayed,
        totalImpact: player.totalImpactSum / gamesPlayed,
        koWinsOur: player.koWinsOur,
        koContestsOur: player.koContestsOur,
        koOurP1: player.koOurP1,
        koOurP2: player.koOurP2,
        koOurP3: player.koOurP3,
        koOurBreak: player.koOurBreak,
        koWinsOpp: player.koWinsOpp,
        koContestsOpp: player.koContestsOpp,
        koOppP1: player.koOppP1,
        koOppP2: player.koOppP2,
        koOppP3: player.koOppP3,
        koOppBreak: player.koOppBreak,
        onePtAttempts: player.onePtAttempts,
        onePtScored: player.onePtScored,
        twoPtAttempts: player.twoPtAttempts,
        twoPtScored: player.twoPtScored,
        goalAttempts: player.goalAttempts,
        goalsScored: player.goalsScored,
        freeAttempts: player.freeAttempts,
        freeScored: player.freeScored,
        assists: player.assists,
        turnovers: player.turnovers
      };
    })
    .sort((a, b) => b.totalImpact - a.totalImpact)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildSlice(games: GameAccumulator[], role: SnapshotResponse["auth"]["role"], ownPlayerId?: string): SnapshotSlice {
  const aggregated = aggregatePlayers(games);
  const fallbackPlayerId = aggregated[0]?.playerId;
  const resolvedOwnPlayerId = role === "player" ? ownPlayerId ?? fallbackPlayerId : ownPlayerId;
  const visiblePlayerIds = role === "player" ? (resolvedOwnPlayerId ? [resolvedOwnPlayerId] : []) : aggregated.map((row) => row.playerId);
  const rows = role === "player" ? aggregated.filter((row) => row.playerId === resolvedOwnPlayerId) : aggregated;
  const players = Object.fromEntries(rows.map((row) => [row.playerId, { playerId: row.playerId, name: row.name, number: row.number, position: row.position }]));
  const playerViews = Object.fromEntries(rows.map((row) => [row.playerId, buildPlayerView(row)]));

  const dashboard: DashboardView = {
    kpis: [
      {
        label: "All Impact",
        value: rows.length ? (rows.reduce((sum, row) => sum + row.totalImpact, 0) / rows.length).toFixed(2) : "0.00",
        subtitle: "Average Total Impact"
      },
      {
        label: "TO Per Game",
        value: rows.length ? (rows.reduce((sum, row) => sum + row.turnovers, 0) / rows.length).toFixed(1) : "0.0",
        subtitle: "Average turnovers across selected games"
      },
      {
        label: "KO % OUR",
        value: `${rows.length ? (rows.reduce((sum, row) => sum + row.koOurPct, 0) / rows.length).toFixed(0) : "0"}%`,
        subtitle: "Our kickout win %"
      },
      {
        label: "KO % OPP",
        value: `${rows.length ? (rows.reduce((sum, row) => sum + row.koOppPct, 0) / rows.length).toFixed(0) : "0"}%`,
        subtitle: "Opp kickout win %"
      }
    ],
    tabs: DASHBOARD_TABS,
    rows,
    topPerformers: [
      makeTopPerformer(rows, "Top Total Impact", (row) => row.totalImpact),
      makeTopPerformer(rows, "Top Attack Impact", (row) => row.att60),
      makeTopPerformer(rows, "Top Transition Impact", (row) => row.trans60),
      makeTopPerformer(rows, "Top Defence Impact", (row) => row.def60)
    ]
  };

  return {
    dashboard,
    playerViews,
    players,
    visiblePlayerIds,
    resolvedOwnPlayerId
  };
}

function buildFilterOptions(matchIds: string[]): DashboardFilterOption[] {
  const options: DashboardFilterOption[] = [
    { id: "all", label: "All Matches", description: `Combined view across ${matchIds.length || 1} matches` }
  ];

  if (matchIds.length >= 3) {
    options.push({ id: "last-3", label: "Last 3", description: "Rolling view for the three most recent matches" });
  }

  if (matchIds.length >= 2) {
    options.push({ id: "last-1", label: "Last Match", description: "Latest match only" });
  }

  return options;
}

export async function primeLiveSheetsCache(): Promise<void> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || import.meta.env.VITE_SHEETS_API_KEY;
  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID || SHEET_ID;
  if (!apiKey) return;
  if (readTabsCache(sheetId)) return;
  try {
    const tabs = await fetchSnapshotTabs(sheetId, apiKey);
    writeTabsCache(sheetId, tabs);
  } catch {
    // Ignore warm-up errors. Regular snapshot fetch will still handle fallback.
  }
}

export async function buildLiveSnapshot(role: SnapshotResponse["auth"]["role"], userId: string, ownPlayerId?: string): Promise<SnapshotResponse> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || import.meta.env.VITE_SHEETS_API_KEY;
  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID || SHEET_ID;

  if (!apiKey) {
    throw new Error("Missing VITE_GOOGLE_SHEETS_API_KEY (or VITE_SHEETS_API_KEY)");
  }

  let tabs: CachedTabsPayload["tabs"];
  try {
    tabs = await fetchSnapshotTabs(sheetId, apiKey);
    writeTabsCache(sheetId, tabs);
  } catch (error) {
    const cached = readTabsCache(sheetId);
    if (!cached) {
      throw error;
    }
    tabs = cached;
  }

  const inputTab = tabs.input;
  const impactTab = tabs.impact;
  const categoriesTab = tabs.categories;

  const inputRows = parseRows(inputTab.values);
  const impactRows = parseRows(impactTab.values);
  const categoryRows = parseRows(categoriesTab.values);

  const byGame = new Map<string, GameAccumulator>();
  const matchOrder = new Map<string, number>();

  const resolveMatchId = (row: ParsedRow, key: string) => {
    const raw = pick(row, ["MatchID", "Match", "Game", "Round", "Fixture"]) || key.split("|")[0];
    return raw || `match-${matchOrder.size + 1}`;
  };

  const getMatchOrder = (matchId: string) => {
    const existing = matchOrder.get(matchId);
    if (existing != null) return existing;
    const next = matchOrder.size;
    matchOrder.set(matchId, next);
    return next;
  };

  const touch = (key: string, name: string, matchId: string) => {
    const existing = byGame.get(key);
    if (existing) return existing;
    const created: GameAccumulator = {
      matchId,
      matchOrder: getMatchOrder(matchId),
      playerName: name,
      minutes: 0,
      attack: 0,
      transition: 0,
      defence: 0,
      totalImpact: 0,
      koWinsOur: 0,
      koTotalOur: 0,
      koWinsOpp: 0,
      koTotalOpp: 0,
      koOurP1: 0,
      koOurP2: 0,
      koOurP3: 0,
      koOurBreak: 0,
      koOppP1: 0,
      koOppP2: 0,
      koOppP3: 0,
      koOppBreak: 0,
      onePtAttempts: 0,
      onePtScored: 0,
      twoPtAttempts: 0,
      twoPtScored: 0,
      goalAttempts: 0,
      goalsScored: 0,
      freeOnePtAttempts: 0,
      freeOnePtScored: 0,
      freeTwoPtAttempts: 0,
      freeTwoPtScored: 0,
      freeGoalAttempts: 0,
      freeGoalsScored: 0,
      assistsShots: 0,
      assistsGoals: 0,
      assistsTwoPoints: 0,
      assistsTotalScores: 0,
      turnovers: 0
    };
    byGame.set(key, created);
    return created;
  };

  for (const row of categoryRows) {
    const name = pick(row, ["Player", "PlayerName"]);
    if (!name) continue;
    const key = pick(row, ["KEY"]) || `${pick(row, ["MatchID"])}|${name}`;
    const matchId = resolveMatchId(row, key);
    const player = touch(key, name, matchId);
    player.minutes += toNumber(pick(row, ["Total Minutes"]));
    player.attack += toNumber(pick(row, ["Attack Impact"]));
    player.transition += toNumber(pick(row, ["Transition Impact"]));
    player.defence += toNumber(pick(row, ["Defensive Impact"]));
    player.totalImpact += toNumber(pick(row, ["Total IMPACT", "Total Impact"]));
  }

  for (const row of inputRows) {
    const name = pick(row, ["Player", "PlayerName"]);
    if (!name) continue;
    const key = pick(row, ["KEY"]) || `${pick(row, ["MatchID"])}|${name}`;
    const matchId = resolveMatchId(row, key);
    const player = touch(key, name, matchId);
    const ourP1 = toNumber(pick(row, ["Won Clean P1_OUR"]));
    const ourP2 = toNumber(pick(row, ["Won Clean P2_OUR"]));
    const ourP3 = toNumber(pick(row, ["Won Clean P3_OUR"]));
    const ourBreak = toNumber(pick(row, ["Won Break_OUR"]));
    const oppP1 = toNumber(pick(row, ["Won Clean P1_OPP"]));
    const oppP2 = toNumber(pick(row, ["Won Clean P2_OPP"]));
    const oppP3 = toNumber(pick(row, ["Won Clean P3_OPP"]));
    const oppBreak = toNumber(pick(row, ["Won Break_OPP"]));
    const ourContest = toNumber(pick(row, ["Ko_Contest_Us"]));
    const oppContest = toNumber(pick(row, ["KO_Contest_Opp"]));

    player.koOurP1 += ourP1;
    player.koOurP2 += ourP2;
    player.koOurP3 += ourP3;
    player.koOurBreak += ourBreak;
    player.koOppP1 += oppP1;
    player.koOppP2 += oppP2;
    player.koOppP3 += oppP3;
    player.koOppBreak += oppBreak;

    const ourWins = ourP1 + ourP2 + ourP3 + ourBreak;
    const oppWins = oppP1 + oppP2 + oppP3 + oppBreak;
    player.koWinsOur += ourWins;
    player.koWinsOpp += oppWins;
    player.koTotalOur += ourContest > 0 ? ourContest : ourWins;
    player.koTotalOpp += oppContest > 0 ? oppContest : oppWins;

    player.onePtAttempts += toNumber(pick(row, ["One_Pointer_Attempts"]));
    player.onePtScored += toNumber(pick(row, ["One_Pointer_Scored"]));
    player.twoPtAttempts += toNumber(pick(row, ["Two_Pointer_Attempts"]));
    player.twoPtScored += toNumber(pick(row, ["Two_Pointer_Scored"]));
    player.goalAttempts += toNumber(pick(row, ["Goal_Attempts"]));
    player.goalsScored += toNumber(pick(row, ["Goals_Scored"]));
    player.freeOnePtAttempts += toNumber(pick(row, ["One_Pointer_Attempts_F"]));
    player.freeOnePtScored += toNumber(pick(row, ["One_Pointer_Scored_F"]));
    player.freeTwoPtAttempts += toNumber(pick(row, ["Two_Pointer_Attempts_F"]));
    player.freeTwoPtScored += toNumber(pick(row, ["Two_Pointer_Scored_F"]));
    player.freeGoalAttempts += toNumber(pick(row, ["Goal_Attempts_F"]));
    player.freeGoalsScored += toNumber(pick(row, ["Goals_Scored_F"]));
    player.assistsShots += toNumber(pick(row, ["Assists_Shots"]));
    player.assistsGoals += toNumber(pick(row, ["Assists_Goals"]));
    player.assistsTwoPoints += toNumber(pick(row, ["Assists_2 Points"]));
    player.assistsTotalScores += toNumber(pick(row, ["Total Scores"]));
    player.turnovers += toNumber(pick(row, ["Total"]));
  }

  for (const row of impactRows) {
    const name = pick(row, ["Player", "PlayerName"]);
    if (!name) continue;
    const key = pick(row, ["KEY"]) || `${pick(row, ["MatchID"])}|${name}`;
    const matchId = resolveMatchId(row, key);
    const player = touch(key, name, matchId);
    if (player.minutes === 0) {
      player.minutes += toNumber(pick(row, ["Total Minutes"]));
    }
  }

  const games = Array.from(byGame.values()).sort((a, b) => a.matchOrder - b.matchOrder || a.playerName.localeCompare(b.playerName));
  const matchIds = Array.from(new Set(games.map((game) => game.matchId)));
  const filterOptions = buildFilterOptions(matchIds);
  const dashboardsByFilter: Record<string, DashboardView> = {};
  const playerViewsByFilter: Record<string, Record<string, PlayerView>> = {};

  const allSlice = buildSlice(games, role, ownPlayerId);
  dashboardsByFilter.all = allSlice.dashboard;
  playerViewsByFilter.all = allSlice.playerViews;

  if (filterOptions.some((option) => option.id === "last-3")) {
    const selected = new Set(matchIds.slice(-3));
    const slice = buildSlice(games.filter((game) => selected.has(game.matchId)), role, allSlice.resolvedOwnPlayerId);
    dashboardsByFilter["last-3"] = slice.dashboard;
    playerViewsByFilter["last-3"] = slice.playerViews;
  }

  if (filterOptions.some((option) => option.id === "last-1")) {
    const selected = new Set(matchIds.slice(-1));
    const slice = buildSlice(games.filter((game) => selected.has(game.matchId)), role, allSlice.resolvedOwnPlayerId);
    dashboardsByFilter["last-1"] = slice.dashboard;
    playerViewsByFilter["last-1"] = slice.playerViews;
  }

  return {
    meta: {
      sourceSheetId: sheetId,
      fetchedAt: new Date().toISOString(),
      version: "v3-live",
      sourceTabs: { input: inputTab.tab, impact: impactTab.tab, categories: categoriesTab.tab }
    },
    auth: { userId, role, playerId: allSlice.resolvedOwnPlayerId },
    permissions: permissionsForRole(role),
    visiblePlayerIds: allSlice.visiblePlayerIds,
    dashboard: allSlice.dashboard,
    filters: {
      defaultOptionId: "all",
      options: filterOptions,
      dashboards: dashboardsByFilter,
      playerViews: playerViewsByFilter
    },
    players: allSlice.players,
    playerViews: allSlice.playerViews
  };
}
