import { describe, expect, it } from 'vitest';
import { parseRepresentativeBoxScoreArguments } from './representativeEvaluation';

describe('representative box-score evaluation', () => {
  it('parses deterministic corpus defaults and explicit sample sizes', () => {
    expect(parseRepresentativeBoxScoreArguments([])).toEqual({
      seed: 20260809,
      seeds: 3,
      seasons: 1,
    });
    expect(parseRepresentativeBoxScoreArguments([
      '--seed', '7', '--seeds', '2', '--seasons', '4',
    ])).toEqual({ seed: 7, seeds: 2, seasons: 4 });
    expect(() => parseRepresentativeBoxScoreArguments(['--seed', '0']))
      .toThrow('positive integer');
    expect(() => parseRepresentativeBoxScoreArguments(['--games', '2']))
      .toThrow('Unknown representative box-score argument');
  });
});
