import { describe, expect, it } from "vitest";
import { aggregatePlayerRecords, buildMatchOrder, calculateImpactScores, calculatePlayerForm } from "@/data/performanceModel";
import type { MatchStatRecord } from "@/types";

function makeRecord(overrides: Partial<MatchStatRecord>): MatchStatRecord {
  return {
    key: "k",
    matchId: "AFL 1",
    matchLabel: "AFL 1",
    opposition: "Opp",
    date: "2026-01-01",
    playerId: "p-1",
    playerName: "Player One",
    totalMinutes: 30,
    pts: 0,
    simpleReceive: 0,
    advanceReceive: 0,
    goalsScored: 0,
    tackles: 0,
    kickawayToReceived: 0,
    duelsContested: 0,
    defensiveDuelsWon: 0,
    dne: 0,
    duelsLost: 0,
    breach1v1: 0,
    shotFreeConceded: 0,
    twoPointFreeConceded: 0,
    blackCard: 0,
    redCard: 0,
    simplePass: 0,
    advancePass: 0,
    carries: 0,
    turnoversInContact: 0,
    turnoverSkillError: 0,
    turnoversKickedAway: 0,
    acceptableTurnover: 0,
    forceTurnoverWin: 0,
    turnovers: 0,
    assistsShots: 0,
    assistsGoals: 0,
    assistsTwoPoints: 0,
    assists: 0,
    onePointerAttempts: 0,
    onePointerScored: 0,
    onePointerWide: 0,
    twoPointerAttempts: 0,
    twoPointerScored: 0,
    twoPointerWide: 0,
    goalAttempts: 0,
    goalsWide: 0,
    dropShorts: 0,
    freeOnePointerAttempts: 0,
    freeOnePointerScored: 0,
    freeTwoPointerAttempts: 0,
    freeTwoPointerScored: 0,
    freeGoalAttempts: 0,
    freeGoalsScored: 0,
    attackImpact: 0,
    transitionImpact: 0,
    defenseImpact: 0,
    turnoverImpact: 0,
    kickoutImpact: 0,
    totalImpact: 0,
    koWonCleanP1Our: 0,
    koWonCleanP2Our: 0,
    koWonCleanP3Our: 0,
    koWonBreakOur: 0,
    koWonCleanP1Opp: 0,
    koWonCleanP2Opp: 0,
    koWonCleanP3Opp: 0,
    koWonBreakOpp: 0,
    koTargetWonClean: 0,
    koTargetWonBreak: 0,
    koTargetLostClean: 0,
    koTargetLostContest: 0,
    ourKoContestUs: 0,
    ourKoContestOpp: 0,
    theirKoContestUs: 0,
    theirKoContestOpp: 0,
    koWinsOur: 0,
    koContestsOur: 0,
    koWinsOpp: 0,
    koContestsOpp: 0,
    ...overrides
  };
}

describe("performance model", () => {
  it("calculates total impact as attack plus transition plus defence", () => {
    const scores = calculateImpactScores(
      makeRecord({
        onePointerScored: 2,
        freeTwoPointerScored: 1,
        assistsGoals: 1,
        simplePass: 4,
        advanceReceive: 2,
        carries: 1,
        tackles: 4,
        forceTurnoverWin: 1,
        duelsLost: 2
      })
    );

    expect(scores.attackImpact).toBeCloseTo(6.5);
    expect(scores.transitionImpact).toBeCloseTo(1.7);
    expect(scores.defenseImpact).toBeCloseTo(2.5);
    expect(scores.totalImpact).toBeCloseTo(scores.attackImpact + scores.transitionImpact + scores.defenseImpact);
  });

  it("computes form percentages against team impact per minute", () => {
    const allRecords = [
      makeRecord({ key: "p1-1", matchId: "AFL 1", date: "2026-01-01", totalMinutes: 20, totalImpact: 20, playerId: "p-1", playerName: "Player One" }),
      makeRecord({ key: "p1-2", matchId: "AFL 2", date: "2026-01-08", totalMinutes: 20, totalImpact: 10, playerId: "p-1", playerName: "Player One" }),
      makeRecord({ key: "p1-3", matchId: "AFL 3", date: "2026-01-15", totalMinutes: 20, totalImpact: 30, playerId: "p-1", playerName: "Player One" }),
      makeRecord({ key: "p2-1", matchId: "AFL 1", date: "2026-01-01", totalMinutes: 20, totalImpact: 10, playerId: "p-2", playerName: "Player Two" }),
      makeRecord({ key: "p2-2", matchId: "AFL 2", date: "2026-01-08", totalMinutes: 20, totalImpact: 10, playerId: "p-2", playerName: "Player Two" }),
      makeRecord({ key: "p2-3", matchId: "AFL 3", date: "2026-01-15", totalMinutes: 20, totalImpact: 10, playerId: "p-2", playerName: "Player Two" })
    ];

    const form = calculatePlayerForm(
      allRecords.filter((record) => record.playerId === "p-1"),
      allRecords
    );

    expect(form.last3).toBeCloseTo(133.33, 1);
    expect(form.season).toBeCloseTo(133.33, 1);
  });

  it("aggregates category scores by player and preserves total impact sums", () => {
    const allRecords = [
      makeRecord({ key: "1", matchId: "AFL 1", date: "2026-01-01", totalImpact: 10, attackImpact: 4, transitionImpact: 3, defenseImpact: 3, playerId: "p-1", playerName: "Player One" }),
      makeRecord({ key: "2", matchId: "AFL 2", date: "2026-01-08", totalImpact: 12, attackImpact: 5, transitionImpact: 4, defenseImpact: 3, playerId: "p-1", playerName: "Player One" }),
      makeRecord({ key: "3", matchId: "AFL 1", date: "2026-01-01", totalImpact: 6, attackImpact: 2, transitionImpact: 1, defenseImpact: 3, playerId: "p-2", playerName: "Player Two" })
    ];

    const rows = aggregatePlayerRecords(allRecords, allRecords);
    const playerOne = rows.find((row) => row.playerId === "p-1");

    expect(playerOne).toMatchObject({
      totalImpact: 22,
      attackImpact: 9,
      transitionImpact: 7,
      defenseImpact: 6,
      gamesPlayed: 2
    });
  });

  it("orders AFL matches by fixture number in filters and trends", () => {
    const records = [
      makeRecord({ key: "1", matchId: "AFL 3", date: "2026-01-15" }),
      makeRecord({ key: "2", matchId: "AFL 1", date: "2026-01-01" }),
      makeRecord({ key: "3", matchId: "AFL 4", date: "2026-01-22" }),
      makeRecord({ key: "4", matchId: "AFL 2", date: "2026-01-08" })
    ];

    expect(buildMatchOrder(records).map((match) => match.matchId)).toEqual(["AFL 1", "AFL 2", "AFL 3", "AFL 4"]);
  });
});
