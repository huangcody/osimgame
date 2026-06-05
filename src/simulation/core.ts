import type {
  Lineup,
  MatchType,
  Player,
  PointAssignment,
  PointResult,
  SimulationResult,
  StrategyResult,
} from "./types.js";

export const POINT_TYPES: MatchType[] = [
  "singles",
  "doubles",
  "singles",
  "doubles",
  "singles",
];

export const DEFAULT_A_STRENGTHS = [1, 2, 3, 4, 5, 6, 7];
export const DEFAULT_B_STRENGTHS = [2.2, 2.4, 3.5, 4.5, 5.5, 6.5, 7.5];

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
      if (won) {
        wins += 1;
        probability *= pointProbability;
      } else {
        probability *= 1 - pointProbability;
      }
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

  function chooseDoublesPairs(candidates: Player[]): [Player, Player][] {
    const pairs: [Player, Player][] = [];
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        pairs.push([candidates[i], candidates[j]]);
      }
    }
    return pairs;
  }

  function backtrack(pointIndex: number) {
    if (pointIndex === POINT_TYPES.length) {
      results.push(current.map((point) => ({
        type: point.type,
        players: [...point.players],
      })) as Lineup);
      return;
    }

    const type = POINT_TYPES[pointIndex];
    const candidates = availablePlayers();

    if (type === "singles") {
      candidates.forEach((player) => {
        used.add(player.id);
        current.push({ type, players: [player] });
        backtrack(pointIndex + 1);
        current.pop();
        used.delete(player.id);
      });
      return;
    }

    chooseDoublesPairs(candidates).forEach(([first, second]) => {
      used.add(first.id);
      used.add(second.id);
      current.push({ type, players: [first, second] });
      backtrack(pointIndex + 1);
      current.pop();
      used.delete(first.id);
      used.delete(second.id);
    });
  }

  backtrack(0);
  return results;
}

export function evaluateLineup(name: string, aLineup: Lineup, bLineup: Lineup, sensitivity: number): StrategyResult {
  const pointResults: PointResult[] = aLineup.map((aPoint, index) => {
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

  return {
    name,
    lineup: aLineup,
    pointResults,
    aMatchWinProbability: matchWinProbability(pointResults.map((point) => point.aWinProbability)),
  };
}

export function greedyLineup(aPlayers: Player[], bLineup: Lineup, sensitivity: number): Lineup {
  const available = [...aPlayers];
  const lineup: PointAssignment[] = [];

  bLineup.forEach((bPoint, index) => {
    const type = POINT_TYPES[index];
    const candidates = type === "singles"
      ? available.map((player) => [player])
      : pairCombinations(available);

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
      const playerIndex = available.findIndex((candidate) => candidate.id === player.id);
      available.splice(playerIndex, 1);
    });
    lineup.push({ type, players: best });
  });

  return lineup as Lineup;
}

export function optimalLineup(aPlayers: Player[], bLineup: Lineup, sensitivity: number): StrategyResult {
  return enumerateLineups(aPlayers)
    .map((lineup) => evaluateLineup("多點思維", lineup, bLineup, sensitivity))
    .reduce((best, current) => (
      current.aMatchWinProbability > best.aMatchWinProbability ? current : best
    ));
}

export function simulate(aStrengths: number[], bStrengths: number[], sensitivity: number): SimulationResult {
  const aPlayers = createPlayers("A", aStrengths);
  const bPlayers = createPlayers("B", bStrengths);
  const bLineup = defaultLineup(bPlayers);
  const greedy = evaluateLineup("單點思維", greedyLineup(aPlayers, bLineup, sensitivity), bLineup, sensitivity);
  const optimal = optimalLineup(aPlayers, bLineup, sensitivity);

  return {
    sensitivity,
    bLineup,
    greedy,
    optimal,
  };
}

export function exportSimulationCsv(result: SimulationResult): string {
  const rows = [
    [
      "strategy",
      "sensitivity",
      "a_match_win_probability",
      "b_match_win_probability",
      "point",
      "type",
      "a_players",
      "a_strength",
      "b_players",
      "b_strength",
      "a_point_win_probability",
    ],
  ];

  [result.greedy, result.optimal].forEach((strategy) => {
    strategy.pointResults.forEach((point) => {
      rows.push([
        strategy.name,
        result.sensitivity.toString(),
        strategy.aMatchWinProbability.toString(),
        (1 - strategy.aMatchWinProbability).toString(),
        point.point.toString(),
        point.type,
        formatPlayers(point.aPlayers),
        point.aStrength.toString(),
        formatPlayers(point.bPlayers),
        point.bStrength.toString(),
        point.aWinProbability.toString(),
      ]);
    });
  });

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function formatPlayers(players: Player[]): string {
  return players.map((player) => `${player.label}(${player.strength})`).join(" + ");
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

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
