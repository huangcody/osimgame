import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_A_STRENGTHS,
  DEFAULT_B_STRENGTHS,
  DEFAULT_TEAMS,
  buildTournamentMatrix,
  createPlayers,
  defaultLineup,
  enumerateLineups,
  evaluateStrategyMatchup,
  exportHeadToHeadCsv,
  exportMatrixCsv,
  exportSimulationCsv,
  matchWinProbability,
  optimalLineup,
  pointStrength,
  runMonteCarlo,
  simulate,
  validateLineup,
  winProbability,
} from "./core.js";

describe("simulation core", () => {
  it("returns 0.5 when strengths are equal", () => {
    assert.equal(round(winProbability(4, 4, 1)), 0.5);
  });

  it("gives higher win probability to the lower strength number", () => {
    assert.ok(winProbability(2, 4, 1) > 0.5);
    assert.ok(winProbability(4, 2, 1) < 0.5);
  });

  it("makes strength gaps more decisive when sensitivity increases", () => {
    assert.ok(winProbability(2, 4, 2) > winProbability(2, 4, 0.5));
  });

  it("uses average strength for doubles", () => {
    assert.equal(pointStrength(createPlayers("A", [2, 6])), 4);
  });

  it("enumerates every legal lineup with all seven players used once", () => {
    const lineups = enumerateLineups(createPlayers("A", DEFAULT_A_STRENGTHS));

    assert.equal(lineups.length, 1260);
    lineups.forEach((lineup) => {
      const usedIds = lineup.flatMap((point) => point.players.map((player) => player.id));
      assert.equal(usedIds.length, 7);
      assert.equal(new Set(usedIds).size, 7);
    });
  });

  it("calculates best-of-five match probability", () => {
    assert.equal(round(matchWinProbability([0.5, 0.5, 0.5, 0.5, 0.5])), 0.5);
    assert.equal(round(matchWinProbability([1, 1, 1, 0, 0])), 1);
    assert.equal(round(matchWinProbability([1, 1, 0, 0, 0])), 0);
  });

  it("finds an optimal lineup at least as good as the greedy baseline", () => {
    const result = simulate(DEFAULT_A_STRENGTHS, DEFAULT_B_STRENGTHS, 1);

    assert.ok(result.optimal.aMatchWinProbability >= result.greedy.aMatchWinProbability);
  });

  it("evaluates the default PDF example without invalid lineups", () => {
    const aPlayers = createPlayers("A", DEFAULT_A_STRENGTHS);
    const bPlayers = createPlayers("B", DEFAULT_B_STRENGTHS);
    const optimal = optimalLineup(aPlayers, defaultLineup(bPlayers), 1);

    assert.equal(optimal.pointResults.length, 5);
    assert.ok(optimal.aMatchWinProbability > 0);
    assert.ok(optimal.aMatchWinProbability < 1);
  });

  it("builds a pairwise matrix without self matchups and with complementary reverse probabilities", () => {
    const matrix = buildTournamentMatrix(DEFAULT_TEAMS, "single", 1, 1000);
    const ab = matrix.cells.find((cell) => cell.teamA.id === "team-a" && cell.teamB.id === "team-b")?.result;
    const ba = matrix.cells.find((cell) => cell.teamA.id === "team-b" && cell.teamB.id === "team-a")?.result;
    const self = matrix.cells.find((cell) => cell.teamA.id === "team-a" && cell.teamB.id === "team-a");

    assert.equal(self?.result, null);
    assert.ok(ab);
    assert.ok(ba);
    assert.equal(round(ab!.theoreticalAWinProbability + ba!.theoreticalAWinProbability), 1);
  });

  it("creates legal same-strategy lineups for single and multi matchups", () => {
    const [teamA, teamB] = DEFAULT_TEAMS;

    (["single", "multi"] as const).forEach((strategy) => {
      const result = evaluateStrategyMatchup(teamA, teamB, strategy, 1, 1000);
      assert.deepEqual(validateLineup(result.aLineup, teamA), []);
      assert.deepEqual(validateLineup(result.bLineup, teamB), []);
      assert.equal(result.pointResults.length, 5);
    });
  });

  it("rejects incomplete or duplicated manual lineups", () => {
    const [teamA] = DEFAULT_TEAMS;
    const lineup = defaultLineup(teamA.players);
    lineup[0].players = [teamA.players[1]];

    const errors = validateLineup(lineup, teamA);
    assert.ok(errors.includes("同一球員不可重複上場"));
  });

  it("runs reproducible Monte Carlo simulations near the theoretical probability", () => {
    const probabilities = [0.6, 0.6, 0.6, 0.6, 0.6];
    const first = runMonteCarlo(probabilities, 10000, 42);
    const second = runMonteCarlo(probabilities, 10000, 42);
    const theoretical = matchWinProbability(probabilities);

    assert.deepEqual(first, second);
    assert.ok(Math.abs(first.simulatedAWinProbability - theoretical) < 0.03);
  });

  it("exports CSV with strategy, lineup, probability, and model fields", () => {
    const csv = exportSimulationCsv(simulate(DEFAULT_A_STRENGTHS, DEFAULT_B_STRENGTHS, 1));

    assert.ok(csv.includes("strategy,sensitivity,a_match_win_probability"));
    assert.ok(csv.includes("單點思維"));
    assert.ok(csv.includes("多點思維"));
    assert.ok(csv.includes("a_point_win_probability"));
  });

  it("exports matrix and head-to-head CSV fields", () => {
    const matrix = buildTournamentMatrix(DEFAULT_TEAMS, "multi", 1, 1000);
    const matrixCsv = exportMatrixCsv(matrix);
    const result = matrix.cells.find((cell) => cell.result)?.result!;
    const detailCsv = exportHeadToHeadCsv([result]);

    assert.ok(matrixCsv.includes("strategy,sensitivity,runs,team_a,team_b"));
    assert.ok(detailCsv.includes("strategy,team_a,team_b,theoretical_a_win"));
  });
});

function round(value: number): number {
  return Number(value.toFixed(10));
}
