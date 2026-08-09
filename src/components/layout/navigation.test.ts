import { describe, expect, it } from 'vitest';
import type { LeagueStage } from '../../types/domain';
import { buildTestLeague } from '../../test/fixtures';
import {
  buildNavigationModel,
  isGroupActive,
  isPathActive,
  type NavigationGroup,
  type NavigationItem,
} from './navigation';

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

    expect(navigation.entries[0]).toEqual({
      type: 'item',
      label: 'Dashboard',
      path: '/dashboard',
    });
  });

  it('uses the intended primary order and flat dropdown contents', () => {
    const league = buildTestLeague('season');
    const navigation = buildNavigationModel({
      team: league.teams[0],
      currentStage: 'season',
      info: league.info,
      conferences: league.conferences,
    });

    expect(navigation.entries.map(entry =>
      entry.type === 'item' ? entry.label : entry.desktopLabel
    )).toEqual([
      'Dashboard',
      'News',
      'Team',
      'Schedule',
      'Standings',
      'Rankings',
      'Stats',
      'Postseason',
    ]);

    const groups = navigation.entries.filter(
      (entry): entry is NavigationGroup => entry.type === 'group'
    );
    expect(groups.find(group => group.id === 'stats')?.items.map(item => item.label)).toEqual([
      'Team Stats',
      'Player Stats',
      'Advanced Stats',
      'Ratings',
      'Awards',
    ]);
    expect(groups.find(group => group.id === 'postseason')?.items.map(item => item.label)).toEqual([
      'Playoff Bracket',
      'Playoff Picture',
      'Resume Comparison',
      'Projections',
      'Bowl Games',
    ]);
  });

  it('matches the bracket exactly and postseason child routes independently', () => {
    const league = buildTestLeague('season');
    const navigation = buildNavigationModel({
      team: league.teams[0],
      currentStage: 'season',
      info: league.info,
      conferences: league.conferences,
    });
    const postseason = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'postseason'
    )!;
    const bracket = postseason.items[0];
    const picture = postseason.items[1];

    expect(isPathActive('/playoff', bracket)).toBe(true);
    expect(isPathActive('/playoff/picture', bracket)).toBe(false);
    expect(isPathActive('/playoff/picture', picture)).toBe(true);
    expect(isGroupActive('/playoff/resumes', postseason)).toBe(true);
  });

  it('retains prefix matching for team schedule descendants', () => {
    const league = buildTestLeague('season');
    const navigation = buildNavigationModel({
      team: league.teams[0],
      currentStage: 'season',
      info: league.info,
      conferences: league.conferences,
    });
    const teamGroup = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'team'
    )!;
    const schedule = teamGroup.items[0] as NavigationItem;

    expect(isPathActive(`${schedule.path}/2025`, schedule)).toBe(true);
  });
});
