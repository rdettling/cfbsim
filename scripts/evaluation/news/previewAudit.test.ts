import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../src/test/fixtures';
import type { GameRecord } from '../../../src/types/db';
import { buildPreviewNewsAuditEntry, evaluatePreviewNewsAudit } from './previewAudit';

const teams = Array.from({ length: 30 }, (_, index) => buildTestTeam({
  id: index + 1,
  name: `Team ${index + 1}`,
  ranking: index + 1,
}));

const game = (
  id: number,
  teamAId: number,
  teamBId: number,
  watchability: number,
  rivalryKey: string | null = null,
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId: null,
  baseLabel: `Team ${teamAId} vs Team ${teamBId}`,
  name: null,
  gameType: 'regular_season',
  rivalryKey,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.62,
  winProbB: 0.38,
  weekPlayed: 1,
  year: 2027,
  rankATOG: teamAId,
  rankBTOG: teamBId,
  resultA: null,
  resultB: null,
  overtime: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  scoreA: null,
  scoreB: null,
  watchability,
});

describe('preseason news audit', () => {
  it('audits the complete publisher package independently', () => {
    const entry = buildPreviewNewsAuditEntry({
      auditId: 'preview-test:2027',
      source: 'scenario',
      rootSeed: 1,
      sample: 0,
      season: 0,
      year: 2027,
      teams,
      games: [game(10, 8, 9, 70), game(11, 2, 3, 95, 'rivalry')],
      defendingChampionId: 7,
    });
    expect(evaluatePreviewNewsAudit([entry])).toMatchObject({
      cases: 1,
      published: 3,
      angles: {
        marquee_opener: 1,
        national_outlook: 1,
        preseason_poll: 1,
      },
      violations: [],
    });
  });

  it('reports corrupted preview facts and scores', () => {
    const entry = buildPreviewNewsAuditEntry({
      auditId: 'preview-test:corrupt',
      source: 'scenario',
      rootSeed: 1,
      sample: 0,
      season: 0,
      year: 2027,
      teams,
      games: [game(11, 2, 3, 95)],
      defendingChampionId: null,
    });
    entry.stories[0].item.importance += 1;
    expect(evaluatePreviewNewsAudit([entry]).violations).toEqual([{
      code: 'invalid_preview_story',
      storyIds: ['preview-test:corrupt:preseason_poll'],
    }]);
  });
});
