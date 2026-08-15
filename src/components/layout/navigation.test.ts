import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../constants/routes';
import type { LeagueStage } from '../../types/domain';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import {
  buildNavigationModel,
  getTeamContextName,
  getUserTeamName,
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
      'League',
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
    expect(groups.find(group => group.id === 'league')?.items.map(item => item.label)).toEqual([
      'News',
      'Awards',
      'History',
      'Records',
    ]);
    expect(groups.find(group => group.id === 'stats')?.items.map(item => item.label)).toEqual([
      'Team Rankings',
      'Player Leaders',
      'Advanced Stats',
      'Ratings',
    ]);
    expect(groups.find(group => group.id === 'postseason')?.items.map(item => item.label)).toEqual([
      'Playoff Bracket',
      'Playoff Picture',
      'Resume Comparison',
      'Projections',
      'Bowl Games',
    ]);
  });

  it('matches league news, awards, history, and records independently', () => {
    const league = buildTestLeague('season');
    const navigation = buildNavigationModel({
      team: league.teams[0],
      currentStage: 'season',
      info: league.info,
      conferences: league.conferences,
    });
    const leagueGroup = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'league'
    )!;
    const statsGroup = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'stats'
    )!;
    const news = leagueGroup.items[0];
    const awards = leagueGroup.items[1];
    const history = leagueGroup.items[2];
    const records = leagueGroup.items[3];

    expect(isPathActive(ROUTES.NEWS, news)).toBe(true);
    expect(isPathActive(`${ROUTES.NEWS}/2025`, news)).toBe(true);
    expect(isPathActive('/awards', news)).toBe(false);
    expect(isPathActive('/awards', awards)).toBe(true);
    expect(isGroupActive(`${ROUTES.NEWS}/2025`, leagueGroup)).toBe(true);
    expect(isGroupActive('/awards', leagueGroup)).toBe(true);
    expect(isGroupActive('/awards', statsGroup)).toBe(false);
    expect(isPathActive('/league/history', history)).toBe(true);
    expect(isPathActive('/league/history/2025', history)).toBe(true);
    expect(isPathActive('/league/history', awards)).toBe(false);
    expect(isGroupActive('/league/history/2025', leagueGroup)).toBe(true);
    expect(isPathActive('/league/records', records)).toBe(true);
    expect(isPathActive('/league/records/extra', records)).toBe(false);
    expect(isPathActive('/league/records', history)).toBe(false);
    expect(isGroupActive('/league/records', leagueGroup)).toBe(true);
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

  it('places team statistics between roster and history', () => {
    const league = buildTestLeague('season');
    const navigation = buildNavigationModel({
      team: league.teams[0],
      currentStage: 'season',
      info: league.info,
      conferences: league.conferences,
    });
    const team = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'team'
    )!;

    expect(team.items.map(item => [item.label, item.path])).toEqual([
      ['Schedule', '/Test State/schedule'],
      ['Roster', '/Test State/roster'],
      ['Stats', '/Test State/stats'],
      ['History', '/Test State/history'],
    ]);
    expect(isPathActive('/Test State/stats', team.items[2])).toBe(true);
  });

  it('keeps the viewed team across team pages and uses the user team elsewhere', () => {
    const userTeam = buildTestTeam({ name: 'Alabama' });
    const viewedTeam = buildTestTeam({ id: 2, name: 'Georgia' });
    const league = buildTestLeague('season', {
      info: { ...buildTestLeague('season').info, team: userTeam.name },
      teams: [userTeam, viewedTeam],
    });
    const data = {
      team: viewedTeam,
      currentStage: league.info.stage,
      info: league.info,
      conferences: league.conferences,
    };

    const teamPageName = getTeamContextName(data, '/Georgia/stats');
    const teamPageNavigation = buildNavigationModel(data, teamPageName);
    const teamGroup = teamPageNavigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'team',
    )!;

    expect(teamPageName).toBe('Georgia');
    expect(getUserTeamName(data)).toBe('Alabama');
    expect(teamGroup.items.map(item => item.path)).toEqual([
      '/Georgia/schedule',
      '/Georgia/roster',
      '/Georgia/stats',
      '/Georgia/history',
    ]);
    expect(getTeamContextName(data, '/Georgia/schedule/2025')).toBe('Georgia');
    expect(getTeamContextName(data, '/rankings')).toBe('Alabama');
    expect(getTeamContextName(data, '/players/10')).toBe('Alabama');
  });
});
