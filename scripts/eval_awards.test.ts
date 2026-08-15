import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAwardEvaluation } from './eval_awards';

const directories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  directories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true }));
});

describe('eval:awards smoke command', () => {
  it('emits agent JSON and writes only the three documented artifacts', () => {
    const output = mkdtempSync(join(tmpdir(), 'cfbsim-awards-'));
    directories.push(output);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const summary = runAwardEvaluation(['--profile', 'smoke', '--seed', '11', '--output', output]);

    expect(summary).toEqual(expect.objectContaining({
      contractVersion: 4,
      profile: 'smoke',
      status: 'ready_for_acceptance',
      exitCode: 0,
      structuralViolations: [],
      nextCommand: 'npm run eval:awards -- --profile acceptance --seed 11',
    }));
    expect(readdirSync(output).sort()).toEqual(['review.md', 'seasons.jsonl', 'summary.json']);
    expect(JSON.parse(readFileSync(join(output, 'summary.json'), 'utf8')).checksum)
      .toBe(summary.checksum);
    expect(JSON.parse(log.mock.calls.at(-1)![0] as string)).toEqual(summary);
  }, 15_000);
});
