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
  passCompletionRate: 0.6,
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
const ITERATIONS = 1000;
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

const runYards = (cfg: any) => {
  const raw = gaussian(cfg.baseMean, cfg.stdDev);
  if (raw < 0) return Math.round(raw);
  const adjusted = raw + cfg.positiveMultiplier * (raw ** cfg.positivePower);
  return Math.min(Math.round(adjusted), 99);
};

const sackYards = (cfg: any) => Math.min(Math.round(gaussian(cfg.sack.baseMean, cfg.sack.stdDev)), 0);

const passYards = (cfg: any) => {
  const raw = gaussian(cfg.pass.baseMean, cfg.pass.stdDev);
  if (raw < 0) return Math.round(raw);
  const adjusted = raw + cfg.pass.positiveMultiplier * (raw ** cfg.pass.positivePower);
  return Math.min(Math.round(adjusted), 99);
};

const simRun = (cfg: any) => {
  if (Math.random() < cfg.baseFumbleRate) return 0;
  return runYards(cfg.run);
};

const simPass = (cfg: any) => {
  const randSack = Math.random();
  const randCompletion = Math.random();
  const randInterception = Math.random();

  if (randSack < cfg.baseSackRate) return { completed: false, yards: sackYards(cfg) };
  if (randCompletion < cfg.baseCompPercent) return { completed: true, yards: passYards(cfg) };
  if (randInterception < cfg.baseIntRate) return { completed: false, yards: 0 };
  return { completed: false, yards: 0 }; // incomplete
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

const evaluate = (candidate: any) => {
  const runSamples: number[] = [];
  const passCompletions: number[] = [];
  let completed = 0;

  for (let i = 0; i < SIMS; i += 1) {
    runSamples.push(simRun(candidate.outcomes));
    const pass = simPass(candidate.outcomes);
    if (pass.completed) {
      completed += 1;
      passCompletions.push(pass.yards);
    }
  }

  const runStats = summarize(runSamples);
  const passStats = summarize(passCompletions);
  const completionRate = completed / SIMS;
  const totalScore = score(runStats, TARGETS.run)
    + score(passStats, TARGETS.pass)
    + ((completionRate - TARGETS.passCompletionRate) ** 2) * 100;

  return { totalScore, runStats, passStats, completionRate };
};

const candidateFromBase = (baseCfg: any) => {
  const candidate = structuredClone(baseCfg);
  const run = candidate.outcomes.run;
  const pass = candidate.outcomes.pass;

  run.baseMean *= random(0.85, 1.15);
  run.stdDev *= random(0.8, 1.2);
  run.positiveMultiplier *= random(0.7, 1.3);
  run.positivePower *= random(0.9, 1.1);

  pass.baseMean *= random(0.85, 1.15);
  pass.stdDev *= random(0.8, 1.2);
  pass.positiveMultiplier *= random(0.7, 1.3);
  pass.positivePower *= random(0.9, 1.1);

  candidate.outcomes.baseCompPercent *= random(0.9, 1.1);
  candidate.outcomes.baseSackRate *= random(0.85, 1.15);
  candidate.outcomes.baseIntRate *= random(0.85, 1.15);

  return candidate;
};

let best = base;
let bestEval = evaluate(base);

for (let i = 0; i < ITERATIONS; i += 1) {
  const candidate = candidateFromBase(best);
  const evalResult = evaluate(candidate);
  if (evalResult.totalScore < bestEval.totalScore) {
    best = candidate;
    bestEval = evalResult;
  }
  if ((i + 1) % 20 === 0) {
    console.log(`iter ${i + 1}/${ITERATIONS} bestScore=${bestEval.totalScore.toFixed(2)}`);
  }
}

console.log('\nBest run stats:', bestEval.runStats);
console.log('Best pass stats (completions only):', bestEval.passStats);
console.log('Completion rate:', bestEval.completionRate.toFixed(3));
console.log('Score:', bestEval.totalScore.toFixed(2));

if (WRITE) {
  writeFileSync(TUNING_PATH, JSON.stringify(best, null, 2));
  console.log(`\nWrote tuning to ${TUNING_PATH}`);
}
