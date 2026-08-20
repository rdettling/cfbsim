import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { GameRecord } from '../../types/db';
import { generatePreseasonNews } from './previews';

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

describe('preseason news', () => {
  it('generates one deterministic, fact-grounded story for each preseason angle', () => {
    const inputs = {
      year: 2027,
      teams,
      games: [game(10, 8, 9, 70), game(11, 2, 3, 95)],
      defendingChampionId: null,
    };
    const first = generatePreseasonNews(inputs);
    expect(generatePreseasonNews(inputs)).toEqual(first);
    expect(first.map(entry => entry.item.primaryAngle)).toEqual([
      'preseason_poll',
      'national_outlook',
      'marquee_opener',
    ]);
    expect(first.every(entry => entry.item.week === 0)).toBe(true);
    expect(first[2].item.featuredGameId).toBe(11);
    expect(first[2].item.featuredTeamIds).toEqual([2, 3]);
    expect(first.map(entry => entry.item.importance)).toEqual([30, 28, 30]);
    expect(first.every(entry =>
      entry.item.importance === entry.trace.newsworthiness.total)).toBe(true);
  });

  it('uses verified prior-season championship identity when available', () => {
    const generated = generatePreseasonNews({
      year: 2027,
      teams,
      games: [game(11, 2, 3, 95)],
      defendingChampionId: 7,
    });
    const outlook = generated.find(entry => entry.item.primaryAngle === 'national_outlook')!;
    expect(`${outlook.item.headline} ${outlook.item.deck}`).toContain('Team 7');
    expect(outlook.trace.defendingChampionId).toBe(7);
  });

  it('uses only top-25 labels and recognizes a rivalry opener', () => {
    const generated = generatePreseasonNews({
      year: 2027,
      teams,
      games: [game(11, 26, 27, 95, 'rivalry')],
      defendingChampionId: null,
    });
    const opener = generated[2];
    expect(`${opener.item.headline} ${opener.item.deck}`).not.toMatch(/No\. 2[67]/);
    expect(opener.trace.newsworthiness.components.map(component => component.id))
      .toContain('rivalry');
    expect(opener.item.importance).toBe(22);
  });

});
