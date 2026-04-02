import type { SnapshotResponse } from "@/types";
import { permissionsForRole } from "@/rbac/permissions";

export function buildMockSnapshot(role: SnapshotResponse["auth"]["role"], userId = "u-manager", playerId = "p-jack"): SnapshotResponse {
  const rows = [
    { rank: 1, playerId: "p-jack", name: "Jack Boden", position: "Midfielder", number: "#12", minutes: 57, att60: 8.4, trans60: 7.2, def60: 6.2, koOurPct: 67, koOppPct: 30, totalImpact: 20.0 },
    { rank: 2, playerId: "p-kelly", name: "A. Kelly", position: "Forward", number: "#11", minutes: 52, att60: 7.0, trans60: 7.2, def60: 5.4, koOurPct: 54, koOppPct: 25, totalImpact: 19.2 },
    { rank: 3, playerId: "p-murphy", name: "S. Murphy", position: "Defender", number: "#6", minutes: 49, att60: 7.2, trans60: 6.8, def60: 7.4, koOurPct: 54, koOppPct: 25, totalImpact: 18.5 }
  ];

  const players = Object.fromEntries(
    rows.map((r) => [r.playerId, { playerId: r.playerId, name: r.name, number: r.number, position: r.position }])
  );

  const playerViews = {
    "p-jack": {
      playerId: "p-jack",
      header: { playerName: "Jack Boden", subtitle: "Midfielder #12", scoresFor: 51, turnoversAgainst: 33 },
      cards: [
        {
          id: "overall",
          title: "Total Impact Score",
          metric: "20.0",
          lines: [
            { label: "Scores", value: "51", ratio: 0.73 },
            { label: "Turnovers For", value: "43", ratio: 0.62 },
            { label: "Turnovers Against", value: "33", ratio: 0.49 },
            { label: "1PT Shooting EV", value: "74% | 0.55", ratio: 0.74 },
            { label: "2PT Shooting EV", value: "46% | 0.52", ratio: 0.46 },
            { label: "Goal Shooting EV", value: "57% | 1.10", ratio: 0.57 },
            { label: "Simple Possessions", value: "179", ratio: 0.61 },
            { label: "Advanced Possessions", value: "51", ratio: 0.52 },
            { label: "DNE", value: "18", ratio: 0.3 },
            { label: "Drop Shorts", value: "24", ratio: 0.4 }
          ]
        },
        {
          id: "attack",
          title: "Attack Performance",
          metric: "1.28",
          lines: [
            { label: "1PT EV", value: "74% | 0.55", ratio: 0.74 },
            { label: "2PT EV", value: "46% | 0.52", ratio: 0.46 },
            { label: "Goal EV", value: "57% | 1.10", ratio: 0.57 },
            { label: "1PT xEV", value: "65", ratio: 0.61 },
            { label: "2PT xEV", value: "11", ratio: 0.28 },
            { label: "Total xEV", value: "1113", ratio: 0.83 }
          ]
        },
        {
          id: "transition",
          title: "Transition Performance",
          metric: "3rd",
          lines: [
            { label: "Total Turnovers", value: "76", ratio: 0.66 },
            { label: "Turnovers in Contact", value: "29", ratio: 0.48 },
            { label: "Turnovers After Skiller", value: "22", ratio: 0.37 },
            { label: "Turnovers Kicked Away", value: "19", ratio: 0.31 },
            { label: "Drop Shorts", value: "6", ratio: 0.1 },
            { label: "Simple Passes Received", value: "155", ratio: 0.64 },
            { label: "Simple Passes Make", value: "159", ratio: 0.66 },
            { label: "Advanced Passes Received", value: "26", ratio: 0.29 },
            { label: "Advanced Passes Make", value: "33", ratio: 0.36 }
          ]
        },
        {
          id: "defence",
          title: "Defence Performance",
          metric: "2nd",
          lines: [
            { label: "Duels Contested", value: "8", ratio: 0.52 },
            { label: "Duels Won", value: "8", ratio: 0.51 },
            { label: "Duels Lost", value: "6", ratio: 0.4 },
            { label: "DNE", value: "18", ratio: 0.6 },
            { label: "Forced Turnovers Received", value: "15.3", ratio: 0.66 },
            { label: "Kickaway TO Received", value: "9.3", ratio: 0.45 },
            { label: "Tackles", value: "28", ratio: 0.77 },
            { label: "Breach 1v1", value: "5", ratio: 0.2 },
            { label: "Shot 1PT Conceded", value: "12", ratio: 0.42 },
            { label: "Shot 2PT Conceded", value: "3", ratio: 0.14 },
            { label: "Cards (Y-B-R)", value: "2-0-0", ratio: 0.1 }
          ]
        },
        {
          id: "kickouts",
          title: "Kickout Performance",
          metric: "20.0",
          lines: [
            { label: "KO Wins", value: "27", ratio: 0.59 },
            { label: "Kickout Contests", value: "41", ratio: 0.68 },
            { label: "KO Win %", value: "66%", ratio: 0.66 },
            { label: "Our Kickouts Score", value: "20.0", ratio: 0.78 }
          ]
        },
        {
          id: "ourKickouts",
          title: "Our Kickouts",
          metric: "41",
          lines: [
            { label: "KO Contests", value: "41 Wins", ratio: 0.68 },
            { label: "Clean P1", value: "10", ratio: 0.64 },
            { label: "Clean P2", value: "1", ratio: 0.2 },
            { label: "Break", value: "3", ratio: 0.29 },
            { label: "KO Wins", value: "66%", ratio: 0.66 },
            { label: "P1 Contribution", value: "14", ratio: 0.58 },
            { label: "P2 Contribution", value: "1.4", ratio: 0.32 }
          ]
        },
        {
          id: "oppKickouts",
          title: "Opp Kickouts",
          metric: "34",
          lines: [
            { label: "KO Contests", value: "34 Wins", ratio: 0.57 },
            { label: "P1", value: "7", ratio: 0.35 },
            { label: "P2", value: "2", ratio: 0.21 },
            { label: "P3", value: "3", ratio: 0.24 },
            { label: "Opp KO Wins", value: "32%", ratio: 0.32 },
            { label: "Opp P1", value: "7", ratio: 0.4 },
            { label: "Opp P2", value: "9", ratio: 0.52 },
            { label: "Opp P3", value: "1", ratio: 0.12 },
            { label: "Opp Contest", value: "16", ratio: 0.44 }
          ]
        }
      ]
    }
  };

  const allVisible = rows.map((r) => r.playerId);
  const visiblePlayerIds = role === "player" ? [playerId] : allVisible;

  return {
    meta: {
      sourceSheetId: "1MP0mzEPAxo-Z9g0lmcipxLepjap6Vu3FSCXhbzaRpSU",
      fetchedAt: new Date().toISOString(),
      version: "v1"
    },
    auth: { userId, role, playerId: role === "player" ? playerId : undefined },
    permissions: permissionsForRole(role),
    visiblePlayerIds,
    dashboard: {
      kpis: [
        { label: "All Impact", value: "1.04", subtitle: "Expected Value per Shot" },
        { label: "TO Per Game", value: "25.9", subtitle: "Team Turnovers per Game" },
        { label: "KO % OUR", value: "67%", subtitle: "Kickout Win % - Our Contests" },
        { label: "KO % OPP", value: "32%", subtitle: "Kickout Win % - Opp Contests" }
      ],
      tabs: ["All Impact", "Attack", "Transition", "Defence", "Turnovers", "Kickouts", "More"],
      rows,
      topPerformers: [
        { title: "Top Attack Impact", playerId: "p-jack", playerName: "Jack Boden", number: "#12", position: "Midfielder", value: 8.4, rounds: [7.6, 6.1, 8.4, 5.9] },
        { title: "Top Defence Impact", playerId: "p-murphy", playerName: "S. Murphy", number: "#6", position: "Defender", value: 7.4, rounds: [7.1, 6.4, 8.0, 6.2] },
        { title: "Top Transition Impact", playerId: "p-kelly", playerName: "A. Kelly", number: "#11", position: "Forward", value: 7.2, rounds: [7.6, 6.1, 8.4, 5.9] },
        { title: "Top Total Impact", playerId: "p-jack", playerName: "Jack Boden", number: "#12", position: "Midfielder", value: 20.0, rounds: [7.6, 6.1, 8.4, 5.9] }
      ]
    },
    players,
    playerViews
  };
}
