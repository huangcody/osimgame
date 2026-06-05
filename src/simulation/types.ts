export type MatchType = "singles" | "doubles";
export type StrategyId = "manual" | "single" | "multi";

export interface Player {
  id: string;
  label: string;
  strength: number;
}

export interface TeamDefinition {
  id: string;
  name: string;
  players: Player[];
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

export interface ScorelineDistribution {
  a30: number;
  a31: number;
  a32: number;
  b30: number;
  b31: number;
  b32: number;
}

export interface MonteCarloResult {
  runs: number;
  seed: number;
  aWins: number;
  bWins: number;
  simulatedAWinProbability: number;
  scorelines: ScorelineDistribution;
}

export interface StrategyResult {
  id?: StrategyId;
  name: string;
  lineup: Lineup;
  pointResults: PointResult[];
  aMatchWinProbability: number;
  monteCarlo?: MonteCarloResult;
}

export interface HeadToHeadResult {
  teamA: TeamDefinition;
  teamB: TeamDefinition;
  strategy: StrategyId;
  aLineup: Lineup;
  bLineup: Lineup;
  pointResults: PointResult[];
  theoreticalAWinProbability: number;
  monteCarlo: MonteCarloResult;
}

export interface MatrixCell {
  teamA: TeamDefinition;
  teamB: TeamDefinition;
  result: HeadToHeadResult | null;
}

export interface RankingRow {
  team: TeamDefinition;
  averageWinProbability: number;
  bestWinProbability: number;
  worstWinProbability: number;
  closestOpponentName: string;
  closestWinProbability: number;
}

export interface TournamentMatrixResult {
  strategy: StrategyId;
  sensitivity: number;
  runs: number;
  cells: MatrixCell[];
  rankings: RankingRow[];
}

export interface SimulationResult {
  sensitivity: number;
  bLineup: Lineup;
  greedy: StrategyResult;
  optimal: StrategyResult;
}
