import { describe, expect, it } from 'vitest';
import { newsAuditExitCode, parseNewsAuditArguments } from './auditCli';

describe('news audit command arguments', () => {
  it('uses the documented smoke defaults', () => {
    expect(parseNewsAuditArguments([])).toEqual({
      seed: 20260809,
      seeds: 1,
      seasons: 1,
      replaySeeds: 0,
      output: '.artifacts/news-audit',
    });
  });

  it('accepts an explicit representative run', () => {
    expect(parseNewsAuditArguments([
      '--seed', '7',
      '--seeds', '3',
      '--seasons', '2',
      '--replay-seeds', '1',
      '--output', '/tmp/news-audit',
    ])).toMatchObject({ seed: 7, seeds: 3, seasons: 2, replaySeeds: 1 });
  });

  it.each([
    [['--seeds', '0'], '--seeds'],
    [['--seasons', '21'], '--seasons'],
    [['--replay-seeds', '2', '--seeds', '1'], '--replay-seeds'],
    [['--unknown', '1'], 'Unknown evaluation argument'],
    [['--output', ''], '--output'],
  ])('rejects invalid arguments %j', (arguments_, message) => {
    expect(() => parseNewsAuditArguments(arguments_)).toThrow(message);
  });

  it('keeps warning-only reports successful and fails structural violations', () => {
    expect(newsAuditExitCode({ violations: [] })).toBe(0);
    expect(newsAuditExitCode({ violations: [{ code: 'unsupported_factual_claim' }] })).toBe(1);
  });
});
