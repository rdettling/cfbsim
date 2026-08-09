import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { Team } from '../../types/domain';
import type { RankingUpdate } from '../sim/rankings';
import {
  extractRankingStoryFacts,
  generatePlayoffFieldNews,
  generateWeeklyRankingNews,
  rankingStorylines,
} from './rankings';

const teams = Array.from({ length: 30 }, (_, index) => buildTestTeam({
  id: index + 1,
  name: `Team ${index + 1}`,
  ranking: index + 1,
  last_rank: index + 1,
  poll_score: 100 - index,
}));

const update = (
  teamId: number,
  previousRank: number,
  currentRank: number,
): RankingUpdate => ({
  teamId,
  previousRank,
  currentRank,
  record: '8-1 (5-1)',
  pollScore: 100 - currentRank,
});

const unchanged = () => teams.map(team =>
  update(team.id, team.ranking, team.ranking));

const replace = (
  updates: RankingUpdate[],
  teamId: number,
  previousRank: number,
  currentRank: number,
) => updates.map(entry => entry.teamId === teamId
  ? update(teamId, previousRank, currentRank)
  : entry);

const map = (entries: Team[] = teams) =>
  new Map(entries.map(team => [team.id, team]));

describe('ranking news publisher', () => {
  it('does not publish for an isolated large riser', () => {
    let updates = unchanged();
    updates = replace(updates, 20, 20, 6);
    updates = replace(updates, 6, 6, 20);
    expect(generateWeeklyRankingNews({
      year: 2026,
      week: 8,
      updates,
      teamsById: map(),
    })).toBeNull();
  });

  it('publishes at each strict threshold and applies angle precedence', () => {
    let updates = unchanged();
    updates = replace(updates, 1, 1, 2);
    updates = replace(updates, 2, 2, 1);
    updates = replace(updates, 4, 4, 7);
    updates = replace(updates, 5, 5, 8);
    updates = replace(updates, 7, 7, 4);
    updates = replace(updates, 8, 8, 5);
    updates = replace(updates, 23, 23, 28);
    updates = replace(updates, 24, 24, 29);
    updates = replace(updates, 25, 25, 30);
    updates = replace(updates, 28, 28, 23);
    updates = replace(updates, 29, 29, 24);
    updates = replace(updates, 30, 30, 25);

    const facts = extractRankingStoryFacts({ year: 2026, week: 9, updates });
    expect(rankingStorylines(facts)).toEqual([
      'new_number_one',
      'top_five_shakeup',
      'top_25_turnover',
    ]);
    const generated = generateWeeklyRankingNews({
      year: 2026,
      week: 9,
      updates,
      teamsById: map(),
    });
    expect(generated?.item.primaryAngle).toBe('new_number_one');
    expect(generated?.item.storylines).toEqual(rankingStorylines(facts));
    expect(generated?.trace.newsworthiness.components.map(component => component.id))
      .toEqual(expect.arrayContaining([
        'base:weekly_rankings',
        'rank_participation:1_5',
        'new_number_one',
        'top_five_shakeup',
        'top_25_turnover',
      ]));
  });

  it('requires two top-five entrants and at least five combined Top 25 changes', () => {
    const topFiveBelow = replace(replace(unchanged(), 5, 5, 6), 6, 6, 5);
    expect(rankingStorylines(extractRankingStoryFacts({
      year: 2026, week: 4, updates: topFiveBelow,
    }))).not.toContain('top_five_shakeup');

    let turnoverBelow = unchanged();
    turnoverBelow = replace(turnoverBelow, 24, 24, 26);
    turnoverBelow = replace(turnoverBelow, 25, 25, 27);
    turnoverBelow = replace(turnoverBelow, 26, 26, 24);
    turnoverBelow = replace(turnoverBelow, 27, 27, 25);
    expect(rankingStorylines(extractRankingStoryFacts({
      year: 2026, week: 4, updates: turnoverBelow,
    }))).not.toContain('top_25_turnover');
  });

  it('is deterministic and preserves playoff seed order for every field size', () => {
    for (const size of [2, 4, 12]) {
      const selectedTeamIds = teams.slice(0, size).map(team => team.id);
      const first = generatePlayoffFieldNews({
        year: 2026,
        week: 15,
        selectedTeamIds,
        teamsById: map(),
      });
      const second = generatePlayoffFieldNews({
        year: 2026,
        week: 15,
        selectedTeamIds,
        teamsById: map(),
      });
      expect(second).toEqual(first);
      expect(first.item.featuredTeamIds).toEqual(selectedTeamIds);
      expect(first.item.primaryAngle).toBe('playoff_field');
      expect(`${first.item.headline} ${first.item.deck}`).toContain(String(size));
      expect(first.item.importance).toBe(92);
    }
  });
});
