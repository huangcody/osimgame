import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_A_STRENGTHS,
  DEFAULT_B_STRENGTHS,
  createPlayers,
  defaultLineup,
  enumerateLineups,
  exportSimulationCsv,
  matchWinProbability,
  optimalLineup,
  pointStrength,
  simulate,
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
    const lowSensitivity = winProbability(2, 4, 0.5);
    const highSensitivity = winProbability(2, 4, 2);

    assert.ok(highSensitivity > lowSensitivity);
  });

  it("uses average strength for doubles", () => {
    const players = createPlayers("A", [2, 6]);

    assert.equal(pointStrength(players), 4);
  });

  it("enumerates every legal lineup with all seven players used once", () => {
    const players = createPlayers("A", DEFAULT_A_STRENGTHS);
    const lineups = enumerateLineups(players);

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
    const bLineup = defaultLineup(bPlayers);
    const optimal = optimalLineup(aPlayers, bLineup, 1);

    assert.equal(optimal.pointResults.length, 5);
    assert.ok(optimal.aMatchWinProbability > 0);
    assert.ok(optimal.aMatchWinProbability < 1);
  });

  it("exports CSV with strategy, lineup, probability, and model fields", () => {
    const csv = exportSimulationCsv(simulate(DEFAULT_A_STRENGTHS, DEFAULT_B_STRENGTHS, 1));

    assert.ok(csv.includes("strategy,sensitivity,a_match_win_probability"));
    assert.ok(csv.includes("單點思維"));
    assert.ok(csv.includes("多點思維"));
    assert.ok(csv.includes("a_point_win_probability"));
  });
});

function round(value: number): number {
  return Number(value.toFixed(10));
}
