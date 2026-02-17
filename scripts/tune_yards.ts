import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TUNING_PATH = resolve('src/domain/sim/tuning.json');

const TARGETS = {
  run: {
    mean: 4.7,
    p10: -2,
    p50: 3,
    p90: 12,
    p95: 18,
  },
  pass: {
    mean: 10.5,
    p10: 0,
    p50: 8,
    p90: 25,
    p95: 35,
    p99: 55,
  },
};

const SIMS = 20000;
const ITERATIONS_RUN = 600;
const ITERATIONS_PASS = 600;
const ITERATIONS_POWER = 300;
const WRITE = true;
const random = (min: number, max: number) => min + Math.random() * (max - min);

const gaussian = (mean: number, stdDev: number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stdDev + mean;
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
};

const runYards = (cfg: any, positivePower: number) => {
  const raw = gaussian(cfg.baseMean, cfg.stdDev);
  if (raw < 0) return Math.round(raw);
  const adjusted = raw + cfg.positiveMultiplier * (raw ** positivePower);
  return Math.min(Math.round(adjusted), 99);
};

const passYards = (cfg: any, positivePower: number) => {
  const raw = gaussian(cfg.pass.baseMean, cfg.pass.stdDev);
  if (raw < 0) return Math.round(raw);
  const adjusted = raw + cfg.pass.positiveMultiplier * (raw ** positivePower);
  return Math.min(Math.round(adjusted), 99);
};

const summarize = (values: number[]) => ({
  mean: values.reduce((a, b) => a + b, 0) / values.length,
  p10: percentile(values, 0.1),
  p50: percentile(values, 0.5),
  p90: percentile(values, 0.9),
  p95: percentile(values, 0.95),
  p99: percentile(values, 0.99),
});

const score = (actual: any, target: any) => {
  const keys = Object.keys(target);
  return keys.reduce((sum, key) => {
    const t = target[key];
    const a = actual[key];
    const diff = a - t;
    return sum + diff * diff;
  }, 0);
};

const loadTuning = () => JSON.parse(readFileSync(TUNING_PATH, 'utf-8'));

const base = loadTuning();

const evaluateRun = (candidate: any) => {
  const runSamples: number[] = [];
  for (let i = 0; i < SIMS; i += 1) {
    runSamples.push(runYards(candidate.outcomes.run, candidate.outcomes.runPositivePower));
  }
  const runStats = summarize(runSamples);
  const totalScore = score(runStats, TARGETS.run);
  return { totalScore, runStats };
};

const evaluatePass = (candidate: any) => {
  const passSamples: number[] = [];
  for (let i = 0; i < SIMS; i += 1) {
    passSamples.push(passYards(candidate.outcomes, candidate.outcomes.passPositivePower));
  }
  const passStats = summarize(passSamples);
  const totalScore = score(passStats, TARGETS.pass);
  return { totalScore, passStats };
};

const candidateRunFromBase = (baseCfg: any) => {
  const candidate = structuredClone(baseCfg);
  const run = candidate.outcomes.run;
  run.baseMean *= random(1.0, 1.2);
  run.stdDev *= random(0.9, 1.25);
  run.positiveMultiplier *= random(0.8, 1.3);
  return candidate;
};

const candidatePassFromBase = (baseCfg: any) => {
  const candidate = structuredClone(baseCfg);
  const pass = candidate.outcomes.pass;
  pass.baseMean *= random(0.85, 1.15);
  pass.stdDev *= random(0.8, 1.2);
  pass.positiveMultiplier *= random(0.7, 1.3);
  return candidate;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const candidatePowerFromBase = (baseCfg: any) => {
  const candidate = structuredClone(baseCfg);
  candidate.outcomes.runPositivePower = clamp(
    candidate.outcomes.runPositivePower * random(0.9, 1.1),
    2.0,
    6.0
  );
  candidate.outcomes.passPositivePower = clamp(
    candidate.outcomes.passPositivePower * random(0.9, 1.1),
    2.0,
    6.0
  );
  return candidate;
};

let best = base;
let bestRunEval = evaluateRun(base);

for (let i = 0; i < ITERATIONS_RUN; i += 1) {
  const candidate = candidateRunFromBase(best);
  const evalResult = evaluateRun(candidate);
  if (evalResult.totalScore < bestRunEval.totalScore) {
    best = candidate;
    bestRunEval = evalResult;
  }
  if ((i + 1) % 20 === 0) {
    console.log(`run iter ${i + 1}/${ITERATIONS_RUN} bestScore=${bestRunEval.totalScore.toFixed(2)}`);
  }
}

let bestPassEval = evaluatePass(best);
for (let i = 0; i < ITERATIONS_PASS; i += 1) {
  const candidate = candidatePassFromBase(best);
  const evalResult = evaluatePass(candidate);
  if (evalResult.totalScore < bestPassEval.totalScore) {
    best = candidate;
    bestPassEval = evalResult;
  }
  if ((i + 1) % 20 === 0) {
    console.log(`pass iter ${i + 1}/${ITERATIONS_PASS} bestScore=${bestPassEval.totalScore.toFixed(2)}`);
  }
}

let bestPowerEval = {
  totalScore: bestRunEval.totalScore + bestPassEval.totalScore,
  runStats: bestRunEval.runStats,
  passStats: bestPassEval.passStats,
};

for (let i = 0; i < ITERATIONS_POWER; i += 1) {
  const candidate = candidatePowerFromBase(best);
  const runEval = evaluateRun(candidate);
  const passEval = evaluatePass(candidate);
  const totalScore = runEval.totalScore + passEval.totalScore;
  if (totalScore < bestPowerEval.totalScore) {
    best = candidate;
    bestRunEval = runEval;
    bestPassEval = passEval;
    bestPowerEval = { totalScore, runStats: runEval.runStats, passStats: passEval.passStats };
  }
  if ((i + 1) % 20 === 0) {
    console.log(`power iter ${i + 1}/${ITERATIONS_POWER} bestScore=${bestPowerEval.totalScore.toFixed(2)}`);
  }
}

console.log('\nBest run stats:', bestRunEval.runStats);
console.log('Best pass stats (completions only):', bestPassEval.passStats);
console.log('Score:', (bestRunEval.totalScore + bestPassEval.totalScore).toFixed(2));

if (WRITE) {
  writeFileSync(TUNING_PATH, JSON.stringify(best, null, 2));
  console.log(`\nWrote tuning to ${TUNING_PATH}`);
}
