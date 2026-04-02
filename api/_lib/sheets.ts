import { z } from "zod";
import { getSettings } from "./store";
import type { ApiUser } from "./types";

const sheetTabs = ["Input Sheet AFL", "Inpact Score AFL", "CategoryScores"] as const;

const rowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

type SnapshotRow = {
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
  onePtAttempts?: number;
  onePtScored?: number;
  twoPtAttempts?: number;
  twoPtScored?: number;
  goalAttempts?: number;
  goalsScored?: number;
  freeAttempts?: number;
  freeScored?: number;
  assists?: number;
  koOurP1?: number;
  koOurP2?: number;
  koOurP3?: number;
  koOurBreak?: number;
  koOppP1?: number;
  koOppP2?: number;
  koOppP3?: number;
  koOppBreak?: number;
  koContestsOur?: number;
  koContestsOpp?: number;
};

export interface SnapshotPayload {
  meta: {
    sourceSheetId: string;
    fetchedAt: string;
    version: string;
  };
  auth: ApiUser;
  permissions: string[];
  visiblePlayerIds: string[];
  dashboard: {
    kpis: Array<{ label: string; value: string; subtitle: string }>;
    tabs: string[];
    rows: SnapshotRow[];
    topPerformers: Array<{ title: string; playerId: string; playerName: string; number: string; position: string; value: number; rounds: number[] }>;
  };
  players: Record<string, { playerId: string; name: string; number: string; position: string }>;
  playerViews: Record<string, unknown>;
}

async function fetchTabValues(sheetId: string, tab: string, apiKey: string): Promise<string[][]> {
  const encoded = encodeURIComponent(`${tab}!A1:ZZ`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encoded}?key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Tab fetch failed: ${tab}`);
  }
  const body = (await response.json()) as { values?: string[][] };
  return body.values ?? [];
}

function toRows(values: string[][], tab: string): Array<Record<string, string | number | null>> {
  if (values.length < 2) {
    throw new Error(`SCHEMA_MISMATCH:${tab}:No data rows`);
  }
  const [header, ...rows] = values;
  return rows.map((line) => {
    const record: Record<string, string | number | null> = {};
    header.forEach((h, i) => {
      const value = line[i] ?? "";
      if (value === "") {
        record[h] = null;
        return;
      }
      const n = Number(value);
      record[h] = Number.isNaN(n) ? value : n;
    });
    return rowSchema.parse(record);
  });
}

function buildFallbackRows(): SnapshotRow[] {
  return [
    { rank: 1, playerId: "p-jack", name: "Jack Boden", position: "Midfielder", number: "#12", minutes: 57, att60: 8.4, trans60: 7.2, def60: 6.2, koOurPct: 67, koOppPct: 30, totalImpact: 20.0 },
    { rank: 2, playerId: "p-kelly", name: "A. Kelly", position: "Forward", number: "#11", minutes: 52, att60: 7.0, trans60: 7.2, def60: 5.4, koOurPct: 54, koOppPct: 25, totalImpact: 19.2 },
    { rank: 3, playerId: "p-murphy", name: "S. Murphy", position: "Defender", number: "#6", minutes: 49, att60: 7.2, trans60: 6.8, def60: 7.4, koOurPct: 54, koOppPct: 25, totalImpact: 18.5 }
  ];
}

function toNum(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(scored: number, attempts: number): number {
  if (!attempts) return 0;
  return Math.max(0, Math.min(1, scored / attempts));
}

export async function buildSnapshot(user: ApiUser): Promise<SnapshotPayload> {
  const settings = getSettings();
  let rows: SnapshotRow[] = buildFallbackRows();

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (apiKey) {
    try {
      const [input, impact, categories] = await Promise.all(
        sheetTabs.map((tab) => fetchTabValues(settings.sheetId, tab, apiKey).then((v) => toRows(v, tab)))
      );

      rows = input.slice(0, 20).map((item, index) => ({
        onePtAttempts: toNum(item.One_Pointer_Attempts),
        onePtScored: toNum(item.One_Pointer_Scored),
        twoPtAttempts: toNum(item.Two_Pointer_Attempts),
        twoPtScored: toNum(item.Two_Pointer_Scored),
        goalAttempts: toNum(item.Goal_Attempts),
        goalsScored: toNum(item.Goals_Scored),
        freeAttempts: toNum(item.One_Pointer_Attempts_F) + toNum(item.Two_Pointer_Attempts_F) + toNum(item.Goal_Attempts_F),
        freeScored: toNum(item.One_Pointer_Scored_F) + toNum(item.Two_Pointer_Scored_F) + toNum(item.Goals_Scored_F),
        assists: toNum(item["Total Scores"]) || toNum(item.Assists_Shots) + toNum(item.Assists_Goals) + toNum(item["Assists_2 Points"]),
        koOurP1: toNum(item["Won Clean P1_OUR"]),
        koOurP2: toNum(item["Won Clean P2_OUR"]),
        koOurP3: toNum(item["Won Clean P3_OUR"]),
        koOurBreak: toNum(item["Won Break_OUR"]),
        koOppP1: toNum(item["Won Clean P1_OPP"]),
        koOppP2: toNum(item["Won Clean P2_OPP"]),
        koOppP3: toNum(item["Won Clean P3_OPP"]),
        koOppBreak: toNum(item["Won Break_OPP"]),
        koContestsOur: toNum(item.Ko_Contest_Us),
        koContestsOpp: toNum(item.KO_Contest_Opp),
        rank: index + 1,
        playerId: String(item.PlayerId ?? `p-${index + 1}`),
        name: String(item.Player ?? item.Name ?? `Player ${index + 1}`),
        position: String(item.Position ?? "Unknown"),
        number: String(item.Number ?? "#0"),
        minutes: Number(item.Minutes ?? item.TotalMinutes ?? item["Total Minutes"] ?? 0),
        att60: Number(item.ATT60 ?? impact[index]?.ATT60 ?? 0),
        trans60: Number(item.TRANS60 ?? categories[index]?.TRANS60 ?? 0),
        def60: Number(item.DEF60 ?? categories[index]?.DEF60 ?? 0),
        koOurPct: Number(item.KO_OUR_PCT ?? categories[index]?.KO_OUR_PCT ?? 0),
        koOppPct: Number(item.KO_OPP_PCT ?? categories[index]?.KO_OPP_PCT ?? 0),
        totalImpact: Number(impact[index]?.TotalImpact ?? item.TotalImpact ?? 0)
      }));
    } catch {
      // Keep fallback payload if upstream is unavailable or schema shifts.
    }
  }

  const permissions =
    user.role === "admin"
      ? ["dashboard:view", "player:view:any", "admin:users:manage", "admin:roles:manage", "admin:settings:manage", "admin:audit:view"]
      : user.role === "manager"
        ? ["dashboard:view", "player:view:any"]
        : ["player:view:self"];

  const fallbackPlayerId = rows[0]?.playerId;
  const resolvedPlayerId = user.role === "player" ? fallbackPlayerId : user.playerId;

  const visiblePlayerIds = user.role === "player" ? (resolvedPlayerId ? [resolvedPlayerId] : []) : rows.map((r) => r.playerId);
  const filteredRows = user.role === "player" ? rows.filter((r) => r.playerId === resolvedPlayerId) : rows;

  const players = Object.fromEntries(
    filteredRows.map((r) => [r.playerId, { playerId: r.playerId, name: r.name, number: r.number, position: r.position }])
  );

  const playerViews = Object.fromEntries(
    filteredRows.map((r) => {
      const onePtAttempts = r.onePtAttempts ?? 0;
      const onePtScored = r.onePtScored ?? 0;
      const twoPtAttempts = r.twoPtAttempts ?? 0;
      const twoPtScored = r.twoPtScored ?? 0;
      const goalAttempts = r.goalAttempts ?? 0;
      const goalsScored = r.goalsScored ?? 0;
      const freeAttempts = r.freeAttempts ?? 0;
      const freeScored = r.freeScored ?? 0;
      const assists = r.assists ?? 0;
      const koOurP1 = r.koOurP1 ?? 0;
      const koOurP2 = r.koOurP2 ?? 0;
      const koOurP3 = r.koOurP3 ?? 0;
      const koOurBreak = r.koOurBreak ?? 0;
      const koOppP1 = r.koOppP1 ?? 0;
      const koOppP2 = r.koOppP2 ?? 0;
      const koOppP3 = r.koOppP3 ?? 0;
      const koOppBreak = r.koOppBreak ?? 0;
      const koContestsOur = r.koContestsOur ?? 0;
      const koContestsOpp = r.koContestsOpp ?? 0;
      const koWinsOur = koOurP1 + koOurP2 + koOurP3 + koOurBreak;
      const koWinsOpp = koOppP1 + koOppP2 + koOppP3 + koOppBreak;

      return [
        r.playerId,
        {
          playerId: r.playerId,
          header: { playerName: r.name, subtitle: `${r.position} ${r.number}`, scoresFor: 51, turnoversAgainst: 33 },
          cards: [
          { id: "overall", title: "Total Impact Score", metric: r.totalImpact.toFixed(1), lines: [{ label: "ATT 60", value: r.att60.toFixed(1), ratio: r.att60 / 10 }] },
          {
            id: "attack",
            title: "Attack Performance",
            metric: r.att60.toFixed(1),
            lines: [
              { label: "1PT EV", value: `${Math.round(pct(onePtScored, onePtAttempts) * 100)}% (${onePtScored}/${onePtAttempts})`, ratio: pct(onePtScored, onePtAttempts) },
              { label: "2PT EV", value: `${Math.round(pct(twoPtScored, twoPtAttempts) * 100)}% (${twoPtScored}/${twoPtAttempts})`, ratio: pct(twoPtScored, twoPtAttempts) },
              { label: "Goal EV", value: `${Math.round(pct(goalsScored, goalAttempts) * 100)}% (${goalsScored}/${goalAttempts})`, ratio: pct(goalsScored, goalAttempts) },
              { label: "Frees", value: `${freeScored}/${freeAttempts}`, ratio: pct(freeScored, freeAttempts) },
              { label: "Assists", value: `${Math.round(assists)}`, ratio: Math.min(1, assists / 25) },
              { label: "Total Impact", value: r.totalImpact.toFixed(1), ratio: Math.min(1, r.totalImpact / 25) }
            ]
          },
          { id: "transition", title: "Transition Performance", metric: "3rd", lines: [{ label: "TRANS 60", value: r.trans60.toFixed(1), ratio: r.trans60 / 10 }] },
          { id: "defence", title: "Defence Performance", metric: "2rd", lines: [{ label: "DEF 60", value: r.def60.toFixed(1), ratio: r.def60 / 10 }] },
          {
            id: "kickouts",
            title: "Kickout Performance",
            metric: `${r.koOurPct}%`,
            lines: [
              { label: "KO Wins", value: `${Math.round(koWinsOur)}`, ratio: Math.min(1, koWinsOur / 40) },
              { label: "KO Contests", value: `${Math.round(koContestsOur)}`, ratio: Math.min(1, koContestsOur / 40) },
              { label: "KO Win %", value: `${r.koOurPct}%`, ratio: r.koOurPct / 100 },
              { label: "Opp KO Win %", value: `${r.koOppPct}%`, ratio: r.koOppPct / 100 }
            ]
          },
          {
            id: "ourKickouts",
            title: "Our Kickouts",
            metric: `${Math.round(koContestsOur)}`,
            lines: [
              { label: "KO Contests", value: `${Math.round(koContestsOur)}`, ratio: Math.min(1, koContestsOur / 40) },
              { label: "Clean P1", value: `${Math.round(koOurP1)}`, ratio: Math.min(1, koOurP1 / 20) },
              { label: "Clean P2", value: `${Math.round(koOurP2)}`, ratio: Math.min(1, koOurP2 / 20) },
              { label: "Clean P3", value: `${Math.round(koOurP3)}`, ratio: Math.min(1, koOurP3 / 20) },
              { label: "Break", value: `${Math.round(koOurBreak)}`, ratio: Math.min(1, koOurBreak / 20) },
              { label: "KO Wins", value: `${Math.round(koWinsOur)} (${r.koOurPct}%)`, ratio: r.koOurPct / 100 }
            ]
          },
          {
            id: "oppKickouts",
            title: "Opp Kickouts",
            metric: `${Math.round(koContestsOpp)}`,
            lines: [
              { label: "KO Contests", value: `${Math.round(koContestsOpp)}`, ratio: Math.min(1, koContestsOpp / 40) },
              { label: "P1", value: `${Math.round(koOppP1)}`, ratio: Math.min(1, koOppP1 / 20) },
              { label: "P2", value: `${Math.round(koOppP2)}`, ratio: Math.min(1, koOppP2 / 20) },
              { label: "P3", value: `${Math.round(koOppP3)}`, ratio: Math.min(1, koOppP3 / 20) },
              { label: "Break", value: `${Math.round(koOppBreak)}`, ratio: Math.min(1, koOppBreak / 20) },
              { label: "Opp KO Wins", value: `${Math.round(koWinsOpp)} (${r.koOppPct}%)`, ratio: r.koOppPct / 100 }
            ]
          }
          ]
        }
      ];
    })
  );

  return {
    meta: {
      sourceSheetId: settings.sheetId,
      fetchedAt: new Date().toISOString(),
      version: "v1"
    },
    auth: {
      ...user,
      playerId: resolvedPlayerId
    },
    permissions,
    visiblePlayerIds,
    dashboard: {
      kpis: [
        { label: "All Impact", value: "1.04", subtitle: "Expected Value per Shot" },
        { label: "TO Per Game", value: "25.9", subtitle: "Team Turnovers per Game" },
        { label: "KO % OUR", value: "67%", subtitle: "Kickout Win % - Our Contests" },
        { label: "KO % OPP", value: "32%", subtitle: "Kickout Win % - Opp Contests" }
      ],
      tabs: ["All Impact", "Attack", "Transition", "Defence", "Turnovers", "Kickouts", "More"],
      rows: filteredRows,
      topPerformers: [
        { title: "Top Attack Impact", playerId: filteredRows[0]?.playerId ?? "", playerName: filteredRows[0]?.name ?? "-", number: filteredRows[0]?.number ?? "", position: filteredRows[0]?.position ?? "", value: filteredRows[0]?.att60 ?? 0, rounds: [7.6, 6.1, 8.4, 5.9] },
        { title: "Top Defence Impact", playerId: filteredRows[0]?.playerId ?? "", playerName: filteredRows[0]?.name ?? "-", number: filteredRows[0]?.number ?? "", position: filteredRows[0]?.position ?? "", value: filteredRows[0]?.def60 ?? 0, rounds: [7.1, 6.4, 8.0, 6.2] },
        { title: "Top Transition Impact", playerId: filteredRows[0]?.playerId ?? "", playerName: filteredRows[0]?.name ?? "-", number: filteredRows[0]?.number ?? "", position: filteredRows[0]?.position ?? "", value: filteredRows[0]?.trans60 ?? 0, rounds: [7.6, 6.1, 8.4, 5.9] },
        { title: "Top Total Impact", playerId: filteredRows[0]?.playerId ?? "", playerName: filteredRows[0]?.name ?? "-", number: filteredRows[0]?.number ?? "", position: filteredRows[0]?.position ?? "", value: filteredRows[0]?.totalImpact ?? 0, rounds: [7.6, 6.1, 8.4, 5.9] }
      ]
    },
    players,
    playerViews
  };
}
