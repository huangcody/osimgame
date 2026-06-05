import { Download, Plus, RotateCcw, Shuffle, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MONTE_CARLO_RUNS,
  DEFAULT_TEAMS,
  POINT_TYPES,
  buildTournamentMatrix,
  cloneLineup,
  createTeam,
  defaultLineup,
  evaluateHeadToHead,
  evaluateStrategyMatchup,
  exportHeadToHeadCsv,
  exportMatrixCsv,
  formatPlayers,
  resolveStrategyLineup,
  validateLineup,
} from "./simulation/core.js";
import type { HeadToHeadResult, Lineup, Player, StrategyId, TeamDefinition, TournamentMatrixResult } from "./simulation/types.js";

type TabId = "detail" | "overall" | "cross";
type Side = "a" | "b";

interface DragSelection {
  side: Side;
  player: Player;
}

function App() {
  const [teams, setTeams] = useState<TeamDefinition[]>(DEFAULT_TEAMS);
  const [tab, setTab] = useState<TabId>("detail");
  const [strategy, setStrategy] = useState<StrategyId>("single");
  const [sensitivity, setSensitivity] = useState(1);
  const [runs, setRuns] = useState(DEFAULT_MONTE_CARLO_RUNS);
  const [seedNonce, setSeedNonce] = useState(1);
  const [teamAId, setTeamAId] = useState(DEFAULT_TEAMS[0].id);
  const [teamBId, setTeamBId] = useState(DEFAULT_TEAMS[1].id);
  const [manualA, setManualA] = useState<Lineup>(() => defaultLineup(DEFAULT_TEAMS[0].players));
  const [manualB, setManualB] = useState<Lineup>(() => defaultLineup(DEFAULT_TEAMS[1].players));
  const [selectedDrag, setSelectedDrag] = useState<DragSelection | null>(null);

  const teamA = teams.find((team) => team.id === teamAId) ?? teams[0];
  const teamB = teams.find((team) => team.id === teamBId && team.id !== teamA.id) ?? teams.find((team) => team.id !== teamA.id) ?? teams[0];

  useEffect(() => {
    if (!teams.some((team) => team.id === teamAId)) {
      setTeamAId(teams[0].id);
    }
    if (!teams.some((team) => team.id === teamBId) || teamAId === teamBId) {
      setTeamBId(teams.find((team) => team.id !== teamAId)?.id ?? teams[0].id);
    }
  }, [teamAId, teamBId, teams]);

  useEffect(() => {
    setManualA(defaultLineup(teamA.players));
    setManualB(defaultLineup(teamB.players));
    setSelectedDrag(null);
  }, [teamA.id, teamA.players, teamB.id, teamB.players]);

  const matrix = useMemo(
    () => buildTournamentMatrix(teams, strategy, sensitivity, runs, seedNonce),
    [teams, strategy, sensitivity, runs, seedNonce],
  );

  const singleResult = useMemo(
    () => evaluateStrategyMatchup(teamA, teamB, "single", sensitivity, runs, seedNonce),
    [teamA, teamB, sensitivity, runs, seedNonce],
  );
  const multiResult = useMemo(
    () => evaluateStrategyMatchup(teamA, teamB, "multi", sensitivity, runs, seedNonce),
    [teamA, teamB, sensitivity, runs, seedNonce],
  );
  const crossResults = useMemo(
    () => buildStrategyCrossResults(teamA, teamB, sensitivity, runs, seedNonce),
    [teamA, teamB, sensitivity, runs, seedNonce],
  );

  const manualErrors = [...validateLineup(manualA, teamA), ...validateLineup(manualB, teamB)];
  const manualResult = manualErrors.length === 0
    ? evaluateHeadToHead(teamA, teamB, manualA, manualB, sensitivity, runs, seedNonce + 1000, "manual")
    : null;

  const downloadMatrix = () => downloadText("osim-overall-matrix.csv", exportMatrixCsv(matrix));
  const downloadDetail = () => {
    const results = [manualResult, singleResult, multiResult].filter(Boolean) as HeadToHeadResult[];
    downloadText("osim-head-to-head.csv", exportHeadToHeadCsv(results));
  };
  const downloadCross = () => downloadText("osim-strategy-cross.csv", exportCrossCsv(crossResults, sensitivity, runs));
  const downloadCurrent = tab === "overall" ? downloadMatrix : tab === "cross" ? downloadCross : downloadDetail;

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="eyebrow">OSIM 盃桌球團體賽</p>
          <h1>完整對戰模擬</h1>
          <p className="summary">同一套敏感度、Single Scenario、Multi-Scenario 與 Monte Carlo 模型，切換整體視角與單場配置。</p>
        </div>
        <div className="actions">
          <button type="button" className="iconButton secondary" onClick={() => setTeams(DEFAULT_TEAMS)} title="重設隊伍">
            <RotateCcw size={18} />
            <span>重設</span>
          </button>
          <button type="button" className="iconButton secondary" onClick={() => setSeedNonce((value) => value + 1)} title="重新抽樣">
            <Shuffle size={18} />
            <span>抽樣</span>
          </button>
          <button type="button" className="iconButton primary" onClick={downloadCurrent} title="匯出 CSV">
            <Download size={18} />
            <span>CSV</span>
          </button>
        </div>
      </section>

      <section className="topControls">
        <div className="tabs" role="tablist">
          <button type="button" className={tab === "detail" ? "active" : ""} onClick={() => setTab("detail")}>單一對戰</button>
          <button type="button" className={tab === "overall" ? "active" : ""} onClick={() => setTab("overall")}>整體對戰</button>
          <button type="button" className={tab === "cross" ? "active" : ""} onClick={() => setTab("cross")}>策略交叉</button>
        </div>
        <ModelControls
          strategy={strategy}
          setStrategy={setStrategy}
          sensitivity={sensitivity}
          setSensitivity={setSensitivity}
          runs={runs}
          setRuns={setRuns}
          showStrategy={tab === "overall"}
        />
      </section>

      <ModelExplanation />

      <TeamManager teams={teams} setTeams={setTeams} />

      {tab === "overall" ? (
        <OverallDashboard
          matrix={matrix}
          teams={teams}
          onSelectMatchup={(nextA, nextB) => {
            setTeamAId(nextA.id);
            setTeamBId(nextB.id);
            setTab("detail");
          }}
        />
      ) : tab === "detail" ? (
        <MatchupDetail
          teams={teams}
          teamA={teamA}
          teamB={teamB}
          setTeamAId={setTeamAId}
          setTeamBId={setTeamBId}
          manualA={manualA}
          manualB={manualB}
          setManualA={setManualA}
          setManualB={setManualB}
          selectedDrag={selectedDrag}
          setSelectedDrag={setSelectedDrag}
          manualResult={manualResult}
          manualErrors={manualErrors}
          singleResult={singleResult}
          multiResult={multiResult}
        />
      ) : (
        <CrossAnalysisPage
          teams={teams}
          teamA={teamA}
          teamB={teamB}
          setTeamAId={setTeamAId}
          setTeamBId={setTeamBId}
          crossResults={crossResults}
        />
      )}
    </main>
  );
}

function ModelControls({
  strategy,
  setStrategy,
  sensitivity,
  setSensitivity,
  runs,
  setRuns,
  showStrategy,
}: {
  strategy: StrategyId;
  setStrategy: (strategy: StrategyId) => void;
  sensitivity: number;
  setSensitivity: (value: number) => void;
  runs: number;
  setRuns: (value: number) => void;
  showStrategy: boolean;
}) {
  return (
    <div className={`modelStrip ${showStrategy ? "" : "withoutStrategy"}`}>
      {showStrategy && (
        <div className="strategyControl">
          <span>矩陣策略</span>
          <div className="segmented">
            <button type="button" className={strategy === "single" ? "active" : ""} onClick={() => setStrategy("single")}>Single</button>
            <button type="button" className={strategy === "multi" ? "active" : ""} onClick={() => setStrategy("multi")}>Multi</button>
          </div>
        </div>
      )}
      <label className="rangeLabel" htmlFor="sensitivity">
        勝率敏感度 <strong>{sensitivity.toFixed(2)}</strong>
        <input id="sensitivity" type="range" min="0.1" max="3" step="0.05" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} />
      </label>
      <label className="runsInput">
        模擬次數
        <input type="number" min="100" step="100" value={runs} onChange={(event) => setRuns(Math.max(100, Number(event.target.value)))} />
      </label>
    </div>
  );
}

function ModelExplanation() {
  return (
    <section className="explanationPanel" aria-label="模型說明與假設">
      <article>
        <h2>怎麼看這個模型</h2>
        <p>戰力數字越小代表越強。勝率敏感度越高，模型越相信戰力差距會決定勝負；敏感度越低，代表比賽變數較多，勝率會更接近五五波。</p>
      </article>
      <article>
        <h2>Single / Multi</h2>
        <p>Single 是逐點貪婪配置，先把眼前這一點勝率拉高。Multi 是枚舉所有合法排點，選出整體五戰三勝機率最高的配置。</p>
      </article>
      <article>
        <h2>Assumptions</h2>
        <ul>
          <li>每隊 7 人，五點固定為單、雙、單、雙、單。</li>
          <li>球員不可重複上場，雙打戰力用兩人平均。</li>
          <li>Monte Carlo 是依五點勝率重複抽樣，不代表真實心理或臨場狀態。</li>
          <li>整體矩陣的同策略互打是教學比較，不是 Nash equilibrium。</li>
        </ul>
      </article>
    </section>
  );
}

function TeamManager({ teams, setTeams }: { teams: TeamDefinition[]; setTeams: (teams: TeamDefinition[]) => void }) {
  const updateStrength = (teamId: string, playerIndex: number, strength: number) => {
    setTeams(teams.map((team) => team.id !== teamId ? team : {
      ...team,
      players: team.players.map((player, index) => index === playerIndex ? { ...player, strength } : player),
    }));
  };

  const updateName = (teamId: string, name: string) => {
    setTeams(teams.map((team) => team.id !== teamId ? team : {
      ...team,
      name,
      players: team.players.map((player, index) => ({ ...player, label: `${name.replace(/\s/g, "")}${index + 1}` })),
    }));
  };

  const addTeam = () => {
    const index = teams.length + 1;
    const id = `team-${index}-${Date.now()}`;
    setTeams([...teams, createTeam(id, `${String.fromCharCode(64 + index)} 隊`, [1.5, 2.5, 3.2, 4.2, 5.2, 6.2, 7.2])]);
  };

  return (
    <section className="teamManager">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Team Dataset</p>
          <h2>隊伍資料</h2>
        </div>
        <button type="button" className="iconButton secondary" onClick={addTeam}>
          <Plus size={18} />
          <span>新增隊伍</span>
        </button>
      </div>
      <div className="teamRows">
        {teams.map((team) => (
          <article className="teamRow" key={team.id}>
            <input className="teamNameInput" value={team.name} onChange={(event) => updateName(team.id, event.target.value)} aria-label={`${team.name}名稱`} />
            <div className="strengthGrid compact">
              {team.players.map((player, index) => (
                <label key={player.id} className="strengthInput">
                  <span>{index + 1}</span>
                  <input type="number" step="0.1" value={player.strength} onChange={(event) => updateStrength(team.id, index, Number(event.target.value))} />
                </label>
              ))}
            </div>
            <button type="button" className="textButton" disabled={teams.length <= 2} onClick={() => setTeams(teams.filter((candidate) => candidate.id !== team.id))}>刪除</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function OverallDashboard({ matrix, teams, onSelectMatchup }: { matrix: TournamentMatrixResult; teams: TeamDefinition[]; onSelectMatchup: (teamA: TeamDefinition, teamB: TeamDefinition) => void }) {
  return (
    <section className="dashboardGrid">
      <div className="tablePanel matrixPanel">
        <div className="tableHeader">
          <h2>勝率矩陣</h2>
          <span>{matrix.strategy === "single" ? "Single vs Single" : "Multi vs Multi"}</span>
        </div>
        <div className="matrixScroll">
          <div className="matrix" style={{ gridTemplateColumns: `96px repeat(${teams.length}, minmax(92px, 1fr))` }}>
            <div className="matrixCorner" />
            {teams.map((team) => <div className="matrixHead" key={team.id}>{team.name}</div>)}
            {teams.map((rowTeam) => (
              <RowCells key={rowTeam.id} rowTeam={rowTeam} teams={teams} matrix={matrix} onSelectMatchup={onSelectMatchup} />
            ))}
          </div>
        </div>
      </div>
      <div className="tablePanel rankingPanel">
        <div className="tableHeader">
          <h2>平均勝率排名</h2>
          <span>{matrix.runs.toLocaleString()} 次抽樣</span>
        </div>
        <div className="rankingList">
          {matrix.rankings.map((row, index) => (
            <article key={row.team.id} className="rankingRow">
              <strong>{index + 1}</strong>
              <div>
                <p>{row.team.name}</p>
                <small>最接近五五波：{row.closestOpponentName} {(row.closestWinProbability * 100).toFixed(1)}%</small>
              </div>
              <span>{(row.averageWinProbability * 100).toFixed(1)}%</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RowCells({ rowTeam, teams, matrix, onSelectMatchup }: { rowTeam: TeamDefinition; teams: TeamDefinition[]; matrix: TournamentMatrixResult; onSelectMatchup: (teamA: TeamDefinition, teamB: TeamDefinition) => void }) {
  return (
    <>
      <div className="matrixSide">{rowTeam.name}</div>
      {teams.map((colTeam) => {
        const cell = matrix.cells.find((candidate) => candidate.teamA.id === rowTeam.id && candidate.teamB.id === colTeam.id);
        const probability = cell?.result?.theoreticalAWinProbability;
        return (
          <button
            type="button"
            key={`${rowTeam.id}-${colTeam.id}`}
            className="matrixCell"
            disabled={!probability}
            style={{ background: probability ? heatColor(probability) : "#eef0ed" }}
            onClick={() => probability && onSelectMatchup(rowTeam, colTeam)}
          >
            {probability ? `${(probability * 100).toFixed(0)}%` : "-"}
          </button>
        );
      })}
    </>
  );
}

function MatchupDetail(props: {
  teams: TeamDefinition[];
  teamA: TeamDefinition;
  teamB: TeamDefinition;
  setTeamAId: (id: string) => void;
  setTeamBId: (id: string) => void;
  manualA: Lineup;
  manualB: Lineup;
  setManualA: (lineup: Lineup) => void;
  setManualB: (lineup: Lineup) => void;
  selectedDrag: DragSelection | null;
  setSelectedDrag: (selection: DragSelection | null) => void;
  manualResult: HeadToHeadResult | null;
  manualErrors: string[];
  singleResult: HeadToHeadResult;
  multiResult: HeadToHeadResult;
}) {
  const resultCards = [props.manualResult, props.singleResult, props.multiResult].filter(Boolean) as HeadToHeadResult[];

  return (
    <section className="detailGrid">
      <div className="matchupControls">
        <label>主隊
          <select value={props.teamA.id} onChange={(event) => props.setTeamAId(event.target.value)}>
            {props.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <label>客隊
          <select value={props.teamB.id} onChange={(event) => props.setTeamBId(event.target.value)}>
            {props.teams.filter((team) => team.id !== props.teamA.id).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      </div>
      <div className="lineupBoards">
        <LineupBoard side="a" team={props.teamA} lineup={props.manualA} setLineup={props.setManualA} selectedDrag={props.selectedDrag} setSelectedDrag={props.setSelectedDrag} />
        <LineupBoard side="b" team={props.teamB} lineup={props.manualB} setLineup={props.setManualB} selectedDrag={props.selectedDrag} setSelectedDrag={props.setSelectedDrag} />
      </div>
      {props.manualErrors.length > 0 && <div className="warning">{props.manualErrors.join("、")}</div>}
      <div className="scoreBand detailScores">
        {resultCards.map((result) => <ResultSummary key={result.strategy} result={result} />)}
      </div>
      <div className="comparison">
        {resultCards.map((result) => <PointTable key={`${result.strategy}-table`} result={result} />)}
      </div>
    </section>
  );
}

function CrossAnalysisPage({
  teams,
  teamA,
  teamB,
  setTeamAId,
  setTeamBId,
  crossResults,
}: {
  teams: TeamDefinition[];
  teamA: TeamDefinition;
  teamB: TeamDefinition;
  setTeamAId: (id: string) => void;
  setTeamBId: (id: string) => void;
  crossResults: CrossResult[];
}) {
  return (
    <section className="detailGrid">
      <div className="matchupControls">
        <label>主隊
          <select value={teamA.id} onChange={(event) => setTeamAId(event.target.value)}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <label>客隊
          <select value={teamB.id} onChange={(event) => setTeamBId(event.target.value)}>
            {teams.filter((team) => team.id !== teamA.id).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      </div>
      <StrategyCrossTable results={crossResults} teamAName={teamA.name} teamBName={teamB.name} />
    </section>
  );
}

interface CrossResult {
  aStrategy: Exclude<StrategyId, "manual">;
  bStrategy: Exclude<StrategyId, "manual">;
  result: HeadToHeadResult;
}

function buildStrategyCrossResults(teamA: TeamDefinition, teamB: TeamDefinition, sensitivity: number, runs: number, seedNonce: number): CrossResult[] {
  const strategies: Exclude<StrategyId, "manual">[] = ["single", "multi"];
  return strategies.flatMap((aStrategy) => strategies.map((bStrategy) => {
    const aLineup = resolveStrategyLineup(teamA, teamB, aStrategy, sensitivity);
    const bLineup = resolveStrategyLineup(teamB, teamA, bStrategy, sensitivity);
    return {
      aStrategy,
      bStrategy,
      result: evaluateHeadToHead(teamA, teamB, aLineup, bLineup, sensitivity, runs, seedNonce + (aStrategy === "single" ? 10 : 20) + (bStrategy === "single" ? 1 : 2), "manual"),
    };
  }));
}

function StrategyCrossTable({ results, teamAName, teamBName }: { results: CrossResult[]; teamAName: string; teamBName: string }) {
  const getResult = (aStrategy: Exclude<StrategyId, "manual">, bStrategy: Exclude<StrategyId, "manual">) =>
    results.find((result) => result.aStrategy === aStrategy && result.bStrategy === bStrategy)!;
  const rows: Exclude<StrategyId, "manual">[] = ["single", "multi"];
  const cols: Exclude<StrategyId, "manual">[] = ["single", "multi"];

  return (
    <section className="tablePanel crossPanel">
      <div className="tableHeader">
        <div>
          <h2>策略交叉比較</h2>
          <p>用來判斷 {teamAName} 是否不管 {teamBName} 怎麼排，都比較適合 Single 或 Multi。</p>
        </div>
        <span>A 勝率</span>
      </div>
      <div className="crossGrid">
        <div className="crossCorner">A 策略 / B 策略</div>
        {cols.map((col) => <div key={col} className="crossHead">{strategyShortLabel(col)}</div>)}
        {rows.map((row) => (
          <>
            <div key={`${row}-label`} className="crossSide">{strategyShortLabel(row)}</div>
            {cols.map((col) => {
              const item = getResult(row, col);
              const percent = item.result.theoreticalAWinProbability * 100;
              return (
                <article key={`${row}-${col}`} className="crossCell" style={{ background: heatColor(item.result.theoreticalAWinProbability) }}>
                  <strong>{percent.toFixed(1)}%</strong>
                  <span>抽樣 {(item.result.monteCarlo.simulatedAWinProbability * 100).toFixed(1)}%</span>
                </article>
              );
            })}
          </>
        ))}
      </div>
    </section>
  );
}

function exportCrossCsv(results: CrossResult[], sensitivity: number, runs: number): string {
  const rows = [["sensitivity", "runs", "team_a", "team_b", "a_strategy", "b_strategy", "theoretical_a_win", "simulated_a_win"]];
  results.forEach((item) => {
    rows.push([
      sensitivity.toString(),
      runs.toString(),
      item.result.teamA.name,
      item.result.teamB.name,
      item.aStrategy,
      item.bStrategy,
      item.result.theoreticalAWinProbability.toString(),
      item.result.monteCarlo.simulatedAWinProbability.toString(),
    ]);
  });
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function LineupBoard({ side, team, lineup, setLineup, selectedDrag, setSelectedDrag }: { side: Side; team: TeamDefinition; lineup: Lineup; setLineup: (lineup: Lineup) => void; selectedDrag: DragSelection | null; setSelectedDrag: (selection: DragSelection | null) => void }) {
  const placePlayer = (slotIndex: number, player: Player) => {
    const next = cloneLineup(lineup);
    next.forEach((point) => {
      point.players = point.players.filter((candidate) => candidate.id !== player.id);
    });
    const target = next[slotIndex];
    const capacity = target.type === "singles" ? 1 : 2;
    target.players = target.players.length >= capacity ? [...target.players.slice(1), player] : [...target.players, player];
    setLineup(next);
    setSelectedDrag(null);
  };

  return (
    <section className="lineupBoard">
      <div className="sectionHeader tight">
        <h2>{team.name} 手動配置</h2>
        <span className="pill">{side === "a" ? "A" : "B"}</span>
      </div>
      <div className="playerTray">
        {team.players.map((player) => (
          <button
            type="button"
            draggable
            key={player.id}
            className={`playerChip ${selectedDrag?.player.id === player.id ? "selected" : ""}`}
            onClick={() => setSelectedDrag({ side, player })}
            onDragStart={() => setSelectedDrag({ side, player })}
          >
            {player.label}<small>{player.strength}</small>
          </button>
        ))}
      </div>
      <div className="slots">
        {lineup.map((point, index) => (
          <button
            type="button"
            key={`${team.id}-${index}`}
            className="slot"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => selectedDrag?.side === side && placePlayer(index, selectedDrag.player)}
            onClick={() => selectedDrag?.side === side && placePlayer(index, selectedDrag.player)}
          >
            <strong>第 {index + 1} 點 {POINT_TYPES[index] === "singles" ? "單" : "雙"}</strong>
            <span>{point.players.length ? formatPlayers(point.players) : "點選球員後放入"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ResultSummary({ result }: { result: HeadToHeadResult }) {
  const percent = result.theoreticalAWinProbability * 100;
  const simulation = result.monteCarlo.simulatedAWinProbability * 100;
  return (
    <article className={`summaryCard ${result.strategy === "multi" ? "highlighted" : ""}`}>
      <div className="summaryTop">
        <div>
          <p className="label">{strategyLabel(result.strategy)}</p>
          <h2>{percent.toFixed(1)}%</h2>
        </div>
        <Trophy size={28} />
      </div>
      <div className="bar"><span style={{ width: `${percent}%` }} /></div>
      <div className="probabilityRow">
        <span>理論 {percent.toFixed(1)}%</span>
        <span>抽樣 {simulation.toFixed(1)}%</span>
      </div>
      <div className="scorelines">
        <span>{result.teamA.name} 3-0 {scorePercent(result.monteCarlo.scorelines.a30, result.monteCarlo.runs)}</span>
        <span>3-1 {scorePercent(result.monteCarlo.scorelines.a31, result.monteCarlo.runs)}</span>
        <span>3-2 {scorePercent(result.monteCarlo.scorelines.a32, result.monteCarlo.runs)}</span>
        <span>{result.teamB.name} 3-0 {scorePercent(result.monteCarlo.scorelines.b30, result.monteCarlo.runs)}</span>
      </div>
    </article>
  );
}

function PointTable({ result }: { result: HeadToHeadResult }) {
  return (
    <section className="tablePanel">
      <div className="tableHeader">
        <h2>{strategyLabel(result.strategy)}</h2>
        <span>{result.teamA.name} {(result.theoreticalAWinProbability * 100).toFixed(1)}%</span>
      </div>
      <div className="pointList">
        {result.pointResults.map((point) => (
          <article className="pointRow" key={`${result.strategy}-${point.point}`}>
            <div className="pointMeta"><strong>第 {point.point} 點</strong><span>{point.type === "singles" ? "單打" : "雙打"}</span></div>
            <div className="matchup">
              <div><span className="teamLabel">A</span><p>{formatPlayers(point.aPlayers)}</p><small>戰力 {point.aStrength.toFixed(2)}</small></div>
              <div><span className="teamLabel blue">B</span><p>{formatPlayers(point.bPlayers)}</p><small>戰力 {point.bStrength.toFixed(2)}</small></div>
            </div>
            <div className="pointProbability"><strong>{(point.aWinProbability * 100).toFixed(1)}%</strong><span>A 勝率</span></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function strategyLabel(strategy: StrategyId): string {
  if (strategy === "single") return "Single Scenario";
  if (strategy === "multi") return "Multi-Scenario";
  return "手動配置";
}

function strategyShortLabel(strategy: Exclude<StrategyId, "manual">): string {
  return strategy === "single" ? "Single" : "Multi";
}

function scorePercent(count: number, runs: number): string {
  return `${((count / runs) * 100).toFixed(1)}%`;
}

function heatColor(probability: number): string {
  const green = Math.round(248 - probability * 92);
  const red = Math.round(252 - (1 - probability) * 112);
  return `rgb(${red}, ${green}, 218)`;
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export default App;
