import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../constants/routes';
import { getOffseasonTargetYear } from '../../constants/stages';
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
import {
  buildLeagueCalendarModel,
  buildOffseasonFlowModel,
  buildSeasonCalendarModel,
} from './leagueCalendar';

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
  it.each([16, 17, 19])('builds the complete %s-week season rail', lastWeek => {
    const calendar = buildSeasonCalendarModel(2026, 4, lastWeek);

    expect(calendar.steps).toHaveLength(lastWeek);
    expect(calendar.steps.slice(0, 3).every(step => step.state === 'completed')).toBe(true);
    expect(calendar.steps[3].state).toBe('current');
    expect(calendar.steps[4].state).toBe('future');
    expect(calendar.steps[13].phase).toBe('regular-season');
    expect(calendar.steps[14].phase).toBe('postseason');
  });

  it('builds season primary actions and forward destinations', () => {
    const active = buildSeasonCalendarModel(2026, 4, 16);
    expect(active.primaryAction).toEqual({
      kind: 'advance',
      label: 'Advance to Week 5',
      targetWeek: 5,
    });
    expect(active.menuDestinations[0]).toEqual({
      targetWeek: 5,
      label: 'Sim to Week 5',
      kind: 'week',
    });
    expect(active.menuDestinations[active.menuDestinations.length - 1]).toEqual({
      targetWeek: 17,
      label: 'End of Season',
      kind: 'end',
    });

    const finalWeek = buildSeasonCalendarModel(2026, 16, 16);
    expect(finalWeek.primaryAction).toEqual({
      kind: 'advance',
      label: 'Finish Season',
      targetWeek: 17,
    });
    expect(finalWeek.menuDestinations).toEqual([{
      targetWeek: 17,
      label: 'End of Season',
      kind: 'end',
    }]);

    const complete = buildSeasonCalendarModel(2026, 17, 16);
    expect(complete.primaryAction).toEqual({
      kind: 'summary',
      label: 'Season Summary',
    });
    expect(complete.steps.every(step => step.state === 'completed')).toBe(true);
  });

  it('builds discriminated season and destination-year offseason calendars', () => {
    const seasonLeague = buildTestLeague('season');
    const season = buildLeagueCalendarModel({
      team: seasonLeague.teams[0],
      info: seasonLeague.info,
      conferences: seasonLeague.conferences,
      playoffTeams: seasonLeague.settings.playoffTeams,
    });
    expect(season.kind).toBe('season');

    const summaryLeague = buildTestLeague('summary');
    summaryLeague.info.currentYear = 2026;
    const offseason = buildLeagueCalendarModel({
      team: summaryLeague.teams[0],
      info: summaryLeague.info,
      conferences: summaryLeague.conferences,
      playoffTeams: summaryLeague.settings.playoffTeams,
    });
    expect(offseason).toMatchObject({
      kind: 'offseason',
      year: 2027,
      currentStage: 'summary',
      currentPosition: 0,
    });
  });

  it('builds completed, current, and future offseason steps', () => {
    expect(buildOffseasonFlowModel('recruiting').map(step => [
      step.label,
      step.state,
    ])).toEqual([
      ['Summary', 'completed'],
      ['Setup', 'completed'],
      ['Progression', 'completed'],
      ['Recruiting', 'current'],
      ['Results', 'future'],
      ['Roster Cuts', 'future'],
      ['Scheduling', 'future'],
    ]);
  });

  it('uses the destination season year throughout the flow', () => {
    expect(getOffseasonTargetYear('summary', 2026)).toBe(2027);
    expect(getOffseasonTargetYear('realignment', 2026)).toBe(2027);
    expect(getOffseasonTargetYear('progression', 2027)).toBe(2027);
    expect(getOffseasonTargetYear('preseason', 2027)).toBe(2027);
  });

  it.each(leagueStages)('includes the dashboard during the %s stage', stage => {
    const league = buildTestLeague(stage);

    const navigation = buildNavigationModel({
      team: league.teams[0],
      info: league.info,
      conferences: league.conferences,
      playoffTeams: league.settings.playoffTeams,
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
      info: league.info,
      conferences: league.conferences,
      playoffTeams: league.settings.playoffTeams,
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
      'Biggest Upsets',
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
      'Bowl Games',
      'Resume Comparison',
    ]);
  });

  it('matches league news, biggest upsets, awards, history, and records independently', () => {
    const league = buildTestLeague('season');
    const navigation = buildNavigationModel({
      team: league.teams[0],
      info: league.info,
      conferences: league.conferences,
      playoffTeams: league.settings.playoffTeams,
    });
    const leagueGroup = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'league'
    )!;
    const statsGroup = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'stats'
    )!;
    const news = leagueGroup.items[0];
    const biggestUpsets = leagueGroup.items[1];
    const awards = leagueGroup.items[2];
    const history = leagueGroup.items[3];
    const records = leagueGroup.items[4];

    expect(isPathActive(ROUTES.NEWS, news)).toBe(true);
    expect(isPathActive(`${ROUTES.NEWS}/2025`, news)).toBe(true);
    expect(isPathActive(ROUTES.BIGGEST_UPSETS, biggestUpsets)).toBe(true);
    expect(isPathActive(`${ROUTES.BIGGEST_UPSETS}/extra`, biggestUpsets)).toBe(false);
    expect(isGroupActive(ROUTES.BIGGEST_UPSETS, leagueGroup)).toBe(true);
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
      info: league.info,
      conferences: league.conferences,
      playoffTeams: league.settings.playoffTeams,
    });
    const postseason = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'postseason'
    )!;
    const bracket = postseason.items[0];
    const resumes = postseason.items[2];

    expect(isPathActive('/playoff', bracket)).toBe(true);
    expect(isPathActive('/playoff/resumes', bracket)).toBe(false);
    expect(isPathActive('/playoff/resumes', resumes)).toBe(true);
    expect(isGroupActive('/playoff/resumes', postseason)).toBe(true);
  });

  it.each([2, 4] as const)('removes the bracket destination for a %i-team playoff', format => {
    const league = buildTestLeague('season');
    league.settings.playoffTeams = format;

    const navigation = buildNavigationModel({
      team: league.teams[0],
      info: league.info,
      conferences: league.conferences,
      playoffTeams: format,
    });
    const postseason = navigation.entries.find(
      (entry): entry is NavigationGroup => entry.type === 'group' && entry.id === 'postseason'
    )!;

    expect(postseason.items.map(item => item.label)).toEqual([
      'Bowl Games',
      'Resume Comparison',
    ]);
  });

  it('retains prefix matching for team schedule descendants', () => {
    const league = buildTestLeague('season');
    const navigation = buildNavigationModel({
      team: league.teams[0],
      info: league.info,
      conferences: league.conferences,
      playoffTeams: league.settings.playoffTeams,
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
      info: league.info,
      conferences: league.conferences,
      playoffTeams: league.settings.playoffTeams,
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
      info: league.info,
      conferences: league.conferences,
      playoffTeams: league.settings.playoffTeams,
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
