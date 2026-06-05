import { Download, RotateCcw, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEFAULT_A_STRENGTHS,
  DEFAULT_B_STRENGTHS,
  exportSimulationCsv,
  formatPlayers,
  simulate,
} from "./simulation/core.js";
import type { PointResult, StrategyResult } from "./simulation/types.js";

function App() {
  const [aStrengths, setAStrengths] = useState(DEFAULT_A_STRENGTHS);
  const [bStrengths, setBStrengths] = useState(DEFAULT_B_STRENGTHS);
  const [sensitivity, setSensitivity] = useState(1);

  const result = useMemo(
    () => simulate(aStrengths, bStrengths, sensitivity),
    [aStrengths, bStrengths, sensitivity],
  );

  const resetDefaults = () => {
    setAStrengths(DEFAULT_A_STRENGTHS);
    setBStrengths(DEFAULT_B_STRENGTHS);
    setSensitivity(1);
  };

  const downloadCsv = () => {
    const csv = exportSimulationCsv(result);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "osim-simulation-result.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="eyebrow">OSIM 盃桌球團體賽</p>
          <h1>排點勝率模擬器</h1>
          <p className="summary">五戰三勝、七人不可重複上場，數字越小代表戰力越強。</p>
        </div>
        <div className="actions">
          <button type="button" className="iconButton secondary" onClick={resetDefaults} title="重設範例">
            <RotateCcw size={18} />
            <span>重設</span>
          </button>
          <button type="button" className="iconButton primary" onClick={downloadCsv} title="匯出 CSV">
            <Download size={18} />
            <span>CSV</span>
          </button>
        </div>
      </section>

      <section className="controlBand">
        <TeamEditor teamName="A 隊" strengths={aStrengths} onChange={setAStrengths} />
        <TeamEditor teamName="B 隊" strengths={bStrengths} onChange={setBStrengths} />
        <div className="panel modelPanel">
          <div className="panelHeader">
            <h2>模型</h2>
            <span className="pill">雙打平均</span>
          </div>
          <label className="rangeLabel" htmlFor="sensitivity">
            勝率敏感度 <strong>{sensitivity.toFixed(2)}</strong>
          </label>
          <input
            id="sensitivity"
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            value={sensitivity}
            onChange={(event) => setSensitivity(Number(event.target.value))}
          />
          <div className="rangeTicks">
            <span>隨機性高</span>
            <span>強弱差距明顯</span>
          </div>
        </div>
      </section>

      <section className="scoreBand">
        <StrategySummary strategy={result.greedy} />
        <StrategySummary strategy={result.optimal} highlighted />
      </section>

      <section className="comparison">
        <StrategyTable strategy={result.greedy} />
        <StrategyTable strategy={result.optimal} />
      </section>
    </main>
  );
}

interface TeamEditorProps {
  teamName: string;
  strengths: number[];
  onChange: (strengths: number[]) => void;
}

function TeamEditor({ teamName, strengths, onChange }: TeamEditorProps) {
  return (
    <div className="panel">
      <div className="panelHeader">
        <h2>{teamName}</h2>
        <span className="pill">7 人</span>
      </div>
      <div className="strengthGrid">
        {strengths.map((strength, index) => (
          <label key={`${teamName}-${index}`} className="strengthInput">
            <span>{index + 1}</span>
            <input
              type="number"
              step="0.1"
              value={strength}
              aria-label={`${teamName}第 ${index + 1} 位戰力`}
              onChange={(event) => {
                const next = [...strengths];
                next[index] = Number(event.target.value);
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

interface StrategySummaryProps {
  strategy: StrategyResult;
  highlighted?: boolean;
}

function StrategySummary({ strategy, highlighted = false }: StrategySummaryProps) {
  const aPercent = strategy.aMatchWinProbability * 100;
  const bPercent = 100 - aPercent;

  return (
    <article className={`summaryCard ${highlighted ? "highlighted" : ""}`}>
      <div className="summaryTop">
        <div>
          <p className="label">{strategy.name}</p>
          <h2>{aPercent.toFixed(1)}%</h2>
        </div>
        <Trophy size={28} />
      </div>
      <div className="bar" aria-label={`${strategy.name} A隊勝率 ${aPercent.toFixed(1)}%`}>
        <span style={{ width: `${aPercent}%` }} />
      </div>
      <div className="probabilityRow">
        <span>A 隊 {aPercent.toFixed(1)}%</span>
        <span>B 隊 {bPercent.toFixed(1)}%</span>
      </div>
    </article>
  );
}

function StrategyTable({ strategy }: { strategy: StrategyResult }) {
  return (
    <section className="tablePanel">
      <div className="tableHeader">
        <h2>{strategy.name}</h2>
        <span>A 隊總勝率 {(strategy.aMatchWinProbability * 100).toFixed(1)}%</span>
      </div>
      <div className="pointList">
        {strategy.pointResults.map((point) => (
          <PointRow key={`${strategy.name}-${point.point}`} point={point} />
        ))}
      </div>
    </section>
  );
}

function PointRow({ point }: { point: PointResult }) {
  return (
    <article className="pointRow">
      <div className="pointMeta">
        <strong>第 {point.point} 點</strong>
        <span>{point.type === "singles" ? "單打" : "雙打"}</span>
      </div>
      <div className="matchup">
        <div>
          <span className="teamLabel">A</span>
          <p>{formatPlayers(point.aPlayers)}</p>
          <small>戰力 {point.aStrength.toFixed(2)}</small>
        </div>
        <div>
          <span className="teamLabel blue">B</span>
          <p>{formatPlayers(point.bPlayers)}</p>
          <small>戰力 {point.bStrength.toFixed(2)}</small>
        </div>
      </div>
      <div className="pointProbability">
        <strong>{(point.aWinProbability * 100).toFixed(1)}%</strong>
        <span>A 勝率</span>
      </div>
    </article>
  );
}

export default App;
