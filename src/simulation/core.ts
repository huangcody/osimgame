import type {
  HeadToHeadResult,
  Lineup,
  MatchType,
  MatrixCell,
  MonteCarloResult,
  Player,
  PointAssignment,
  PointResult,
  RankingRow,
  ScorelineDistribution,
  SimulationResult,
  StrategyId,
  StrategyResult,
  TeamDefinition,
  TournamentMatrixResult,
} from "./types.js";

export const POINT_TYPES: MatchType[] = ["singles", "doubles", "singles", "doubles", "singles"];
export const DEFAULT_A_STRENGTHS = [1, 2, 3, 4, 5, 6, 7];
export const DEFAULT_B_STRENGTHS = [2.2, 2.4, 3.5, 4.5, 5.5, 6.5, 7.5];
export const DEFAULT_MONTE_CARLO_RUNS = 10000;

export const DEFAULT_TEAMS: TeamDefinition[] = [
  createTeam("team-a", "A 隊", DEFAULT_A_STRENGTHS),
  createTeam("team-b", "B 隊", DEFAULT_B_STRENGTHS),
];

export function createTeam(id: string, name: string, strengths: number[]): TeamDefinition {
  return {
    id,
    name,
    players: strengths.map((strength, index) => ({
      id: `${id}-p${index + 1}`,
      label: `${name.replace(/\s/g, "")}${index + 1}`,
      strength,
    })),
  };
}

export function createPlayers(team: "A" | "B", strengths: number[]): Player[] {
  return strengths.map((strength, index) => ({
    id: `${team}${index + 1}`,
    label: `${team}${index + 1}`,
    strength,
  }));
}

export function pointStrength(players: Player[]): number {
  return players.reduce((sum, player) => sum + player.strength, 0) / players.length;
}

export function winProbability(aStrength: number, bStrength: number, sensitivity: number): number {
  return 1 / (1 + Math.exp(sensitivity * (aStrength - bStrength)));
}

export function matchWinProbability(pointProbabilities: number[]): number {
  let winAtLeastThree = 0;
  for (let mask = 0; mask < 1 << pointProbabilities.length; mask += 1) {
    let wins = 0;
    let probability = 1;
    pointProbabilities.forEach((pointProbability, index) => {
      const won = (mask & (1 << index)) !== 0;
      wins += won ? 1 : 0;
      probability *= won ? pointProbability : 1 - pointProbability;
    });
    if (wins >= 3) {
      winAtLeastThree += probability;
    }
  }
  return winAtLeastThree;
}

export function defaultLineup(players: Player[]): Lineup {
  return [
    { type: "singles", players: [players[0]] },
    { type: "doubles", players: [players[1], players[2]] },
    { type: "singles", players: [players[3]] },
    { type: "doubles", players: [players[4], players[5]] },
    { type: "singles", players: [players[6]] },
  ];
}

export function emptyLineup(players: Player[] = []): Lineup {
  void players;
  return POINT_TYPES.map((type) => ({ type, players: [] })) as unknown as Lineup;
}

export function cloneLineup(lineup: Lineup): Lineup {
  return lineup.map((point) => ({ type: point.type, players: [...point.players] })) as Lineup;
}

export function enumerateLineups(players: Player[]): Lineup[] {
  if (players.length !== 7) {
    throw new Error("Lineup enumeration requires exactly 7 players.");
  }

  const results: Lineup[] = [];
  const used = new Set<string>();
  const current: PointAssignment[] = [];

  function availablePlayers(): Player[] {
    return players.filter((player) => !used.has(player.id));
  }

  function backtrack(pointIndex: number) {
    if (pointIndex === POINT_TYPES.length) {
      results.push(cloneLineup(current as Lineup));
      return;
    }

    const type = POINT_TYPES[pointIndex];
    const candidates = availablePlayers();
    const groups = type === "singles" ? candidates.map((player) => [player]) : pairCombinations(candidates);

    groups.forEach((group) => {
      group.forEach((player) => used.add(player.id));
      current.push({ type, players: group });
      backtrack(pointIndex + 1);
      current.pop();
      group.forEach((player) => used.delete(player.id));
    });
  }

  backtrack(0);
  return results;
}

export function validateLineup(lineup: Lineup, team: TeamDefinition): string[] {
  const errors: string[] = [];
  lineup.forEach((point, index) => {
    const expected = point.type === "singles" ? 1 : 2;
    if (point.players.length !== expected) {
      errors.push(`第 ${index + 1} 點需要 ${expected} 人`);
    }
  });
  const usedIds = lineup.flatMap((point) => point.players.map((player) => player.id));
  if (new Set(usedIds).size !== usedIds.length) {
    errors.push("同一球員不可重複上場");
  }
  const teamIds = new Set(team.players.map((player) => player.id));
  if (usedIds.some((id) => !teamIds.has(id))) {
    errors.push("排點包含不屬於此隊的球員");
  }
  if (usedIds.length !== team.players.length) {
    errors.push("每隊 7 人都必須上場一次");
  }
  return errors;
}

export function evaluateLineup(name: string, aLineup: Lineup, bLineup: Lineup, sensitivity: number): StrategyResult {
  const pointResults = evaluatePoints(aLineup, bLineup, sensitivity);
  return {
    name,
    lineup: aLineup,
    pointResults,
    aMatchWinProbability: matchWinProbability(pointResults.map((point) => point.aWinProbability)),
  };
}

export function evaluateHeadToHead(
  teamA: TeamDefinition,
  teamB: TeamDefinition,
  aLineup: Lineup,
  bLineup: Lineup,
  sensitivity: number,
  runs = DEFAULT_MONTE_CARLO_RUNS,
  seed = stableSeed(`${teamA.id}-${teamB.id}-${sensitivity}-${runs}`),
  strategy: StrategyId = "manual",
): HeadToHeadResult {
  const pointResults = evaluatePoints(aLineup, bLineup, sensitivity);
  const probabilities = pointResults.map((point) => point.aWinProbability);
  const theoreticalAWinProbability = matchWinProbability(probabilities);
  return {
    teamA,
    teamB,
    strategy,
    aLineup,
    bLineup,
    pointResults,
    theoreticalAWinProbability,
    monteCarlo: runMonteCarlo(probabilities, runs, seed),
  };
}

export function greedyLineup(aPlayers: Player[], bLineup: Lineup, sensitivity: number): Lineup {
  const available = [...aPlayers];
  const lineup: PointAssignment[] = [];

  bLineup.forEach((bPoint, index) => {
    const type = POINT_TYPES[index];
    const candidates = type === "singles" ? available.map((player) => [player]) : pairCombinations(available);
    let best = candidates[0];
    let bestProbability = -Infinity;

    candidates.forEach((candidate) => {
      const probability = winProbability(pointStrength(candidate), pointStrength(bPoint.players), sensitivity);
      if (probability > bestProbability) {
        best = candidate;
        bestProbability = probability;
      }
    });

    best.forEach((player) => {
      available.splice(available.findIndex((candidate) => candidate.id === player.id), 1);
    });
    lineup.push({ type, players: best });
  });

  return lineup as Lineup;
}

export function optimalLineup(aPlayers: Player[], bLineup: Lineup, sensitivity: number): StrategyResult {
  return enumerateLineups(aPlayers)
    .map((lineup) => evaluateLineup("多點思維", lineup, bLineup, sensitivity))
    .reduce((best, current) => (current.aMatchWinProbability > best.aMatchWinProbability ? current : best));
}

export function resolveStrategyLineup(
  team: TeamDefinition,
  opponent: TeamDefinition,
  strategy: StrategyId,
  sensitivity: number,
): Lineup {
  const opponentDefault = defaultLineup(opponent.players);
  if (strategy === "single") {
    return greedyLineup(team.players, opponentDefault, sensitivity);
  }
  if (strategy === "multi") {
    return optimalLineup(team.players, opponentDefault, sensitivity).lineup;
  }
  return defaultLineup(team.players);
}

export function evaluateStrategyMatchup(
  teamA: TeamDefinition,
  teamB: TeamDefinition,
  strategy: StrategyId,
  sensitivity: number,
  runs = DEFAULT_MONTE_CARLO_RUNS,
  seedSalt = 0,
): HeadToHeadResult {
  const aLineup = resolveStrategyLineup(teamA, teamB, strategy, sensitivity);
  const bLineup = resolveStrategyLineup(teamB, teamA, strategy, sensitivity);
  return evaluateHeadToHead(teamA, teamB, aLineup, bLineup, sensitivity, runs, stableSeed(`${strategy}-${teamA.id}-${teamB.id}-${sensitivity}-${runs}-${seedSalt}`), strategy);
}

export function buildTournamentMatrix(
  teams: TeamDefinition[],
  strategy: StrategyId,
  sensitivity: number,
  runs = DEFAULT_MONTE_CARLO_RUNS,
  seedSalt = 0,
): TournamentMatrixResult {
  const cells: MatrixCell[] = [];
  teams.forEach((teamA) => {
    teams.forEach((teamB) => {
      cells.push({
        teamA,
        teamB,
        result: teamA.id === teamB.id ? null : evaluateStrategyMatchup(teamA, teamB, strategy, sensitivity, runs, seedSalt),
      });
    });
  });

  const rankings: RankingRow[] = teams.map((team) => {
    const results = cells.filter((cell) => cell.teamA.id === team.id && cell.result).map((cell) => cell.result!);
    const probabilities = results.map((result) => result.theoreticalAWinProbability);
    const closest = results.reduce((best, current) => (
      Math.abs(current.theoreticalAWinProbability - 0.5) < Math.abs(best.theoreticalAWinProbability - 0.5) ? current : best
    ), results[0]);

    return {
      team,
      averageWinProbability: average(probabilities),
      bestWinProbability: Math.max(...probabilities),
      worstWinProbability: Math.min(...probabilities),
      closestOpponentName: closest?.teamB.name ?? "-",
      closestWinProbability: closest?.theoreticalAWinProbability ?? 0,
    };
  }).sort((a, b) => b.averageWinProbability - a.averageWinProbability);

  return { strategy, sensitivity, runs, cells, rankings };
}

export function runMonteCarlo(pointProbabilities: number[], runs: number, seed: number): MonteCarloResult {
  const scorelines: ScorelineDistribution = { a30: 0, a31: 0, a32: 0, b30: 0, b31: 0, b32: 0 };
  let aWins = 0;
  let bWins = 0;
  const random = createRandom(seed);

  for (let run = 0; run < runs; run += 1) {
    let aPoints = 0;
    let bPoints = 0;
    for (const probability of pointProbabilities) {
      if (random() < probability) {
        aPoints += 1;
      } else {
        bPoints += 1;
      }
      if (aPoints === 3 || bPoints === 3) {
        break;
      }
    }

    if (aPoints === 3) {
      aWins += 1;
      scorelines[`a3${bPoints}` as keyof ScorelineDistribution] += 1;
    } else {
      bWins += 1;
      scorelines[`b3${aPoints}` as keyof ScorelineDistribution] += 1;
    }
  }

  return { runs, seed, aWins, bWins, simulatedAWinProbability: aWins / runs, scorelines };
}

export function simulate(aStrengths: number[], bStrengths: number[], sensitivity: number): SimulationResult {
  const aPlayers = createPlayers("A", aStrengths);
  const bPlayers = createPlayers("B", bStrengths);
  const bLineup = defaultLineup(bPlayers);
  const greedy = evaluateLineup("單點思維", greedyLineup(aPlayers, bLineup, sensitivity), bLineup, sensitivity);
  const optimal = optimalLineup(aPlayers, bLineup, sensitivity);
  return { sensitivity, bLineup, greedy, optimal };
}

export function exportSimulationCsv(result: SimulationResult): string {
  const rows = [["strategy", "sensitivity", "a_match_win_probability", "b_match_win_probability", "point", "type", "a_players", "a_strength", "b_players", "b_strength", "a_point_win_probability"]];
  [result.greedy, result.optimal].forEach((strategy) => {
    strategy.pointResults.forEach((point) => {
      rows.push([strategy.name, result.sensitivity.toString(), strategy.aMatchWinProbability.toString(), (1 - strategy.aMatchWinProbability).toString(), point.point.toString(), point.type, formatPlayers(point.aPlayers), point.aStrength.toString(), formatPlayers(point.bPlayers), point.bStrength.toString(), point.aWinProbability.toString()]);
    });
  });
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function exportMatrixCsv(matrix: TournamentMatrixResult): string {
  const rows = [["strategy", "sensitivity", "runs", "team_a", "team_b", "theoretical_a_win", "simulated_a_win", "a_3_0", "a_3_1", "a_3_2", "b_3_0", "b_3_1", "b_3_2"]];
  matrix.cells.filter((cell) => cell.result).forEach((cell) => {
    const result = cell.result!;
    rows.push([
      matrix.strategy,
      matrix.sensitivity.toString(),
      matrix.runs.toString(),
      result.teamA.name,
      result.teamB.name,
      result.theoreticalAWinProbability.toString(),
      result.monteCarlo.simulatedAWinProbability.toString(),
      result.monteCarlo.scorelines.a30.toString(),
      result.monteCarlo.scorelines.a31.toString(),
      result.monteCarlo.scorelines.a32.toString(),
      result.monteCarlo.scorelines.b30.toString(),
      result.monteCarlo.scorelines.b31.toString(),
      result.monteCarlo.scorelines.b32.toString(),
    ]);
  });
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function exportHeadToHeadCsv(results: HeadToHeadResult[]): string {
  const rows = [["strategy", "team_a", "team_b", "theoretical_a_win", "simulated_a_win", "point", "type", "a_players", "a_strength", "b_players", "b_strength", "a_point_win_probability"]];
  results.forEach((result) => {
    result.pointResults.forEach((point) => {
      rows.push([result.strategy, result.teamA.name, result.teamB.name, result.theoreticalAWinProbability.toString(), result.monteCarlo.simulatedAWinProbability.toString(), point.point.toString(), point.type, formatPlayers(point.aPlayers), point.aStrength.toString(), formatPlayers(point.bPlayers), point.bStrength.toString(), point.aWinProbability.toString()]);
    });
  });
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function formatPlayers(players: Player[]): string {
  return players.map((player) => `${player.label}(${player.strength})`).join(" + ");
}

function evaluatePoints(aLineup: Lineup, bLineup: Lineup, sensitivity: number): PointResult[] {
  return aLineup.map((aPoint, index) => {
    const bPoint = bLineup[index];
    const aStrength = pointStrength(aPoint.players);
    const bStrength = pointStrength(bPoint.players);
    return {
      point: index + 1,
      type: aPoint.type,
      aPlayers: aPoint.players,
      bPlayers: bPoint.players,
      aStrength,
      bStrength,
      aWinProbability: winProbability(aStrength, bStrength, sensitivity),
    };
  });
}

function pairCombinations(players: Player[]): Player[][] {
  const pairs: Player[][] = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      pairs.push([players[i], players[j]]);
    }
  }
  return pairs;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stableSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
