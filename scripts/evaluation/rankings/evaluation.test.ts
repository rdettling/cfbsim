import { describe, expect, it } from 'vitest';
import {
  evaluateRankingAudit,
  type RankingAuditArtifact,
} from './evaluation';

const passingArtifact = (): RankingAuditArtifact => ({
  rankedLossMovements: [5, 6, 7],
  earlyTopFiveLossRanks: [9, 14, 25],
  rankedWinMovements: [-2, -1, 0, 0],
  rankedByeMovements: [-1, 0, 1],
  lossThenWinMovements: [-2, -1, 0],
  week14Top25AverageLosses: [2.3, 2.5],
  structuralViolations: [],
});

describe('ranking audit evaluation', () => {
  it('accepts AP-like movement, record composition, and deterministic replay', () => {
    const summary = evaluateRankingAudit({
      artifact: passingArtifact(),
      expectedWeek14Top25AverageLosses: 2.4,
      replayMatches: true,
    });

    expect(summary.passed).toBe(true);
    expect(summary.violations).toEqual([]);
  });

  it('rejects delayed loss punishment and replay drift', () => {
    const artifact = passingArtifact();
    artifact.lossThenWinMovements = [1, 2, 3];
    const summary = evaluateRankingAudit({
      artifact,
      expectedWeek14Top25AverageLosses: 2.4,
      replayMatches: false,
    });

    expect(summary.passed).toBe(false);
    expect(summary.violations).toContain(
      'Loss-then-win teams must usually stabilize or rise.',
    );
    expect(summary.violations).toContain('Seeded ranking replay did not match exactly.');
  });

  it('rejects an early top-five loser that exits the Top 25', () => {
    const artifact = passingArtifact();
    artifact.earlyTopFiveLossRanks = [26];

    const summary = evaluateRankingAudit({
      artifact,
      expectedWeek14Top25AverageLosses: 2.4,
      replayMatches: true,
    });

    expect(summary.passed).toBe(false);
    expect(summary.violations).toContain(
      'An early top-five loser may not fall out of the Top 25.',
    );
  });
});
