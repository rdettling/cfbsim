import { describe, expect, it } from 'vitest';
import type { LeagueStage } from '../../types/domain';
import { buildTestLeague } from '../../test/fixtures';
import { buildNavigationModel } from './navigation';

const leagueStages: LeagueStage[] = [
  'preseason',
  'season',
  'summary',
  'realignment',
  'progression',
  'recruiting',
  'recruiting_summary',
  'roster_cuts',
];

describe('application navigation', () => {
  it.each(leagueStages)('includes the dashboard during the %s stage', stage => {
    const league = buildTestLeague(stage);

    const navigation = buildNavigationModel({
      team: league.teams[0],
      currentStage: stage,
      info: league.info,
      conferences: league.conferences,
    });

    expect(navigation.leading).toContainEqual({
      label: 'Dashboard',
      path: '/dashboard',
    });
  });
});
