import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSeasonBalanceEvaluation } from './eval_season_balance';
import {
  artifactChecksum,
  collectSeasonBalanceArtifact,
} from './evaluation/seasonBalance/evaluation';
import { loadSeasonCorpusData } from './evaluation/shared/seasonCorpusData';

const directories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  directories.splice(0).forEach(directory =>
    rmSync(directory, { recursive: true, force: true }));
  process.exitCode = undefined;
});

describe('eval:season-balance smoke command', () => {
  it('emits agent JSON and writes only the three documented artifacts', () => {
    const output = mkdtempSync(join(tmpdir(), 'cfbsim-season-balance-'));
    directories.push(output);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { summary, artifacts } = runSeasonBalanceEvaluation([
      '--profile', 'smoke',
      '--seed', '11',
      '--output', output,
    ]);

    expect(summary).toEqual(expect.objectContaining({
      contractVersion: 3,
      profile: 'smoke',
      seasons: 1,
      exitCode: 0,
      structuralViolations: [],
      replayChecks: [],
    }));
    expect(['needs_tuning', 'ready_for_acceptance']).toContain(summary.status);
    expect(artifacts).toHaveLength(1);
    expect(readdirSync(output).sort()).toEqual([
      'review.md',
      'seasons.jsonl',
      'summary.json',
    ]);
    expect(JSON.parse(readFileSync(join(output, 'summary.json'), 'utf8')).checksum)
      .toBe(summary.checksum);
    expect(readFileSync(join(output, 'seasons.jsonl'), 'utf8').trim().split('\n'))
      .toHaveLength(1);
    expect(JSON.parse(log.mock.calls.at(-1)![0] as string)).toEqual(summary);
    expect(process.exitCode ?? 0).toBe(0);
  }, 15_000);

  it('replays a production season exactly', () => {
    const data = loadSeasonCorpusData(2026);
    const first = collectSeasonBalanceArtifact(data, 1234);
    const replay = collectSeasonBalanceArtifact(data, 1234);
    expect(first.violations).toEqual([]);
    expect(replay.violations).toEqual([]);
    expect(artifactChecksum(replay.artifact)).toBe(artifactChecksum(first.artifact));
  }, 15_000);
});
