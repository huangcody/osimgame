export type MatchType = "singles" | "doubles";

export interface Player {
  id: string;
  label: string;
  strength: number;
}

export interface PointAssignment {
  type: MatchType;
  players: Player[];
}

export type Lineup = [
  PointAssignment,
  PointAssignment,
  PointAssignment,
  PointAssignment,
  PointAssignment,
];

export interface PointResult {
  point: number;
  type: MatchType;
  aPlayers: Player[];
  bPlayers: Player[];
  aStrength: number;
  bStrength: number;
  aWinProbability: number;
}

export interface StrategyResult {
  name: string;
  lineup: Lineup;
  pointResults: PointResult[];
  aMatchWinProbability: number;
}

export interface SimulationResult {
  sensitivity: number;
  bLineup: Lineup;
  greedy: StrategyResult;
  optimal: StrategyResult;
}
