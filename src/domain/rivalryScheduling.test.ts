import { describe, expect, it } from 'vitest';
import rawRivalries from '../../public/data/rivalries.json';
import rawTeams from '../../public/data/teams.json';
import yearsIndex from '../../public/data/seasons/index.json';
import year2020 from '../../public/data/seasons/2020.json';
import { normalizeRivalriesData } from './rivalryData';
import type { LeagueState } from '../types/league';
import type { RivalryDefinition, Team } from '../types/domain';
import type { SeasonData } from '../types/baseData';
import type { GameRecord } from '../types/db';
import {
  buildAcceptedRivalryGames,
  resolveRivalries,
  resolveRivalrySite,
  rivalryKey,
  withoutDeclinedRivalries,
  type RivalriesData,
} from './rivalryScheduling';
import {
  assertCompleteSchedule,
  buildFullScheduleFromExisting,
} from './schedule/planner';

const buildTeam = (
  id: number,
  conference: string,
  confLimit = 9,
): Team => ({
  id,
  name: id === 1 ? 'Notre Dame' : `Team ${id}`,
  abbreviation: `T${id}`,
  confGames: 0,
  confLimit,
  nonConfGames: 0,
  nonConfLimit: 12 - confLimit,
  prestige: 4,
  prestige_change: 0,
  ceiling: 7,
  floor: 1,
  mascot: 'Testers',
  city: 'Test City',
  state: 'TS',
  stadium: 'Test Stadium',
  ranking: id,
  offense: 90,
  defense: 90,
  colorPrimary: '#123456',
  colorSecondary: '#ffffff',
  conference,
  confName: conference,
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  rating: 90,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0 (0-0)',
  movement: 0,
  poll_score: 0,
  strength_of_record: 0,
  strength_of_record_avg: 0,
  last_rank: null,
  last_game: null,
  next_game: null,
});

const buildTeams = (confLimit = 9) => [
  ...Array.from({ length: 13 }, (_, index) =>
    buildTeam(index + 1, 'Big Ten', confLimit),
  ),
  ...Array.from({ length: 13 }, (_, index) =>
    buildTeam(index + 14, 'American', confLimit),
  ),
];

const yearModules = import.meta.glob('../../public/data/seasons/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, SeasonData>;

const buildHistoricalTeams = (yearData: SeasonData) => {
  let id = 1;
  const teams: Team[] = [];
  Object.entries(yearData.conferences).forEach(([conference, data]) => {
    Object.keys(data.teams).forEach(name => {
      const team = buildTeam(id++, conference, data.games);
      team.name = name;
      team.nonConfLimit = 12 - data.games;
      teams.push(team);
    });
  });
  Object.keys(yearData.independents).forEach(name => {
    const team = buildTeam(id++, 'Independent', 0);
    team.name = name;
    team.nonConfLimit = 12;
    teams.push(team);
  });
  return teams;
};

const game = (
  teamAId: number,
  teamBId: number,
  weekPlayed: number,
): GameRecord => ({
  id: weekPlayed,
  teamAId,
  teamBId,
  weekPlayed,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId: null,
  baseLabel: 'Regular Season',
  name: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.5,
  winProbB: 0.5,
  year: 2026,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: null,
  resultB: null,
  overtime: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  scoreA: null,
  scoreB: null,
  gameType: 'regular_season',
  rivalryKey: null,
  watchability: 0,
});

const rivalry = (
  teamA: string,
  teamB: string,
  week: number | null,
  name: string,
): RivalryDefinition => ({
  teamA,
  teamB,
  week,
  name,
  neutralSite: false,
  venue: null,
});

describe('best-effort rivalry scheduling', () => {
  it('removes a same-conference rivalry guarantee without banning the matchup', () => {
    const teams = buildTeams(12);
    const pair = rivalryKey('Notre Dame', 'Team 2');
    const activeRivalries = withoutDeclinedRivalries(
      {
        rivalries: [rivalry('Notre Dame', 'Team 2', 14, 'Conference Trophy')],
      },
      [pair],
    );
    const resolution = resolveRivalries({
      teams,
      rivalries: activeRivalries,
      existingGames: [],
      year: 2026,
    });

    expect(resolution.feasible).toBe(true);
    expect(resolution.accepted).toEqual([]);
    const { fullGames } = buildFullScheduleFromExisting(
      teams[0],
      teams,
      [],
      {
        year: 2026,
        seed: 123,
        requireComplete: true,
        requiredGames: [],
      },
    );
    expect(
      fullGames.some(game =>
        rivalryKey(game.teamA.name, game.teamB.name) === pair,
      ),
    ).toBe(true);
  });

  it('locks the current 2020 historical overflow omissions', () => {
    const teams = buildHistoricalTeams(year2020 as SeasonData);
    const rivalries = normalizeRivalriesData(
      rawRivalries,
      new Set(Object.keys(rawTeams.teams)),
    );
    expect(rivalries.rivalries).toHaveLength(158);

    const resolution = resolveRivalries({
      teams,
      rivalries,
      existingGames: [],
      year: 2020,
    });

    expect(
      resolution.omitted
        .map(warning => rivalryKey(warning.teamA, warning.teamB))
        .sort(),
    ).toEqual([
      'Notre Dame::Purdue',
      'Notre Dame::Stanford',
      'Notre Dame::USC',
    ]);
    expect(
      resolution.accepted
        .filter(entry => entry.teamA === 'Notre Dame' || entry.teamB === 'Notre Dame')
        .filter(entry => entry.week !== null)
        .map(entry => entry.week)
        .sort((left, right) => left! - right!),
    ).toEqual([]);
  });

  it('keeps fixed rivalry weeks conflict-free and schedulable for every starting year', () => {
    const fixedWeeks = new Set<string>();
    for (const rivalry of rawRivalries.rivalries) {
      if (!rivalry.week) continue;
      for (const teamName of rivalry.teams) {
        const key = `${teamName}::${rivalry.week}`;
        expect(fixedWeeks.has(key), key).toBe(false);
        fixedWeeks.add(key);
      }
    }

    const rivalries = normalizeRivalriesData(
      rawRivalries,
      new Set(Object.keys(rawTeams.teams)),
    );
    for (const year of yearsIndex.years) {
      const yearData = yearModules[`../../public/data/seasons/${year}.json`];
      expect(yearData, year).toBeDefined();
      const teams = buildHistoricalTeams(yearData);
      const resolution = resolveRivalries({
        teams,
        rivalries,
        existingGames: [],
        year: Number(year),
      });
      const scheduledTeams = structuredClone(teams);
      const result = buildFullScheduleFromExisting(
        scheduledTeams[0],
        scheduledTeams,
        [],
        {
          year: Number(year),
          seed: 123,
          requireComplete: true,
          requiredGames: buildAcceptedRivalryGames(
            resolution,
            scheduledTeams,
          ),
        },
      );
      expect(
        () => assertCompleteSchedule(scheduledTeams, result.fullGames),
        year,
      ).not.toThrow();
    }
  }, 30_000);

  it('guarantees Navy in a feasible Notre Dame alignment', () => {
    const teams = buildTeams();
    teams[13].name = 'Navy';
    teams[14].name = 'Stanford';
    const rivalries: RivalriesData = {
      rivalries: [
        rivalry('Notre Dame', 'Team 2', 14, 'Fixed conference game'),
        rivalry('Notre Dame', 'Stanford', 7, 'Legends Trophy'),
        rivalry('Notre Dame', 'Navy', null, 'Rip Miller Trophy'),
        rivalry('Notre Dame', 'Team 3', null, 'Conference rivalry 1'),
        rivalry('Notre Dame', 'Team 4', null, 'Conference rivalry 2'),
        rivalry('Notre Dame', 'Team 5', null, 'Conference rivalry 3'),
      ],
    };
    const resolution = resolveRivalries({
      teams,
      rivalries,
      existingGames: [],
      year: 2026,
    });

    expect(resolution.omitted).toEqual([]);
    expect(resolution.accepted.map(entry => entry.teamB)).toContain('Navy');

    const requiredGames = buildAcceptedRivalryGames(resolution, teams);
    const result = buildFullScheduleFromExisting(
      teams[0],
      teams,
      [],
      {
        year: 2026,
        seed: 123,
        requireComplete: true,
        requiredGames,
      },
    );
    assertCompleteSchedule(teams, result.fullGames);
    expect(
      result.fullGames.some(
        scheduled =>
          (scheduled.teamA.name === 'Notre Dame' &&
            scheduled.teamB.name === 'Navy') ||
          (scheduled.teamB.name === 'Notre Dame' &&
            scheduled.teamA.name === 'Navy'),
      ),
    ).toBe(true);
  });

  it('omits flexible overflow deterministically instead of blocking', () => {
    const teams = buildTeams(11);
    teams[13].name = 'Navy';
    teams[14].name = 'Stanford';
    teams[15].name = 'Army';
    const rivalries: RivalriesData = {
      rivalries: [
        rivalry('Notre Dame', 'Stanford', 7, 'Fixed'),
        rivalry('Notre Dame', 'Navy', null, 'Navy rivalry'),
        rivalry('Notre Dame', 'Army', null, 'Army rivalry'),
      ],
    };
    const resolution = resolveRivalries({
      teams,
      rivalries,
      existingGames: [],
      year: 2026,
    });

    expect(resolution.accepted).toMatchObject([
      { teamA: 'Notre Dame', teamB: 'Stanford', week: 7 },
    ]);
    expect(resolution.omitted.map(entry => entry.teamB)).toEqual([
      'Army',
      'Navy',
    ]);
  });

  it('uses a stable tie-break when fixed rivalries compete for one week', () => {
    const teams = buildTeams();
    teams[13].name = 'Alpha';
    teams[14].name = 'Beta';
    const resolution = resolveRivalries({
      teams,
      rivalries: {
        rivalries: [
          rivalry('Notre Dame', 'Beta', 8, 'Beta rivalry'),
          rivalry('Notre Dame', 'Alpha', 8, 'Alpha rivalry'),
        ],
      },
      existingGames: [],
      year: 2026,
    });

    expect(resolution.accepted).toMatchObject([
      { teamA: 'Notre Dame', teamB: 'Alpha', week: 8 },
    ]);
    expect(resolution.omitted).toMatchObject([
      { teamA: 'Notre Dame', teamB: 'Beta' },
    ]);
  });

  it('admits the most constrained fixed rivalry first', () => {
    const teams = buildTeams();
    teams[13].name = 'Alpha';
    teams[14].name = 'Beta';
    const resolution = resolveRivalries({
      teams,
      rivalries: {
        rivalries: [
          rivalry('Notre Dame', 'Beta', 9, 'Beta rivalry'),
          rivalry('Notre Dame', 'Alpha', 8, 'Alpha rivalry'),
        ],
      },
      existingGames: [game(14, 2, 1), game(14, 3, 2)],
      year: 2026,
    });

    expect(resolution.accepted.map(entry => entry.teamB)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('omits an impossible fixed rivalry without blocking the base schedule', () => {
    const teams = buildTeams(12);
    const resolution = resolveRivalries({
      teams,
      rivalries: {
        rivalries: [rivalry('Notre Dame', 'Team 14', 8, 'Fixed overflow')],
      },
      existingGames: [],
      year: 2026,
    });

    expect(resolution.accepted).toEqual([]);
    expect(resolution.omitted[0]?.message).toContain('Week 8');
    const result = buildFullScheduleFromExisting(
      teams[0],
      teams,
      [],
      { year: 2026, seed: 123, requireComplete: true, requiredGames: [] },
    );
    expect(() => assertCompleteSchedule(teams, result.fullGames)).not.toThrow();
  });

  it('reports an impossible base schedule when no rivalry can be removed', () => {
    const teams = buildTeams();
    const resolution = resolveRivalries({
      teams,
      rivalries: { rivalries: [] },
      existingGames: [game(1, 14, 1), game(1, 14, 2)],
      year: 2026,
    });

    expect(resolution).toMatchObject({
      accepted: [],
      omitted: [],
      feasible: false,
    });
  });

  it('alternates a flexible rivalry host in later seasons', () => {
    const [teamA, teamB] = buildTeams().slice(0, 2);
    const baseLeague: Pick<LeagueState, 'info' | 'rivalryHostSeeds'> = {
      info: {
        currentWeek: 0,
        lastRankingsWeek: 0,
        currentYear: 2026,
        startYear: 2026,
        stage: 'preseason',
        team: 'Notre Dame',
        lastWeek: 0,
      },
      rivalryHostSeeds: { 'Notre Dame::Team 2': 'Notre Dame' },
    };
    expect(resolveRivalrySite(baseLeague, teamA, teamB, false, null))
      .toMatchObject({ homeTeam: { name: 'Notre Dame' } });
    expect(resolveRivalrySite({
      ...baseLeague,
      info: { ...baseLeague.info, currentYear: 2027 },
    }, teamA, teamB, false, null))
      .toMatchObject({ homeTeam: { name: 'Team 2' } });
  });

  it('carries named and generic neutral sites into scheduled games', () => {
    const [teamA, teamB] = buildTeams().slice(0, 2);
    const base = {
      key: rivalryKey(teamA.name, teamB.name),
      teamAId: teamA.id,
      teamBId: teamB.id,
      teamA: teamA.name,
      teamB: teamB.name,
      week: 6,
      name: 'Test Rivalry',
      neutralSite: true,
    };

    expect(buildAcceptedRivalryGames({
      accepted: [{ ...base, venue: 'Cotton Bowl' }],
      omitted: [],
      feasible: true,
    }, [teamA, teamB])[0]).toMatchObject({
      homeTeam: null,
      awayTeam: null,
      venue: 'Cotton Bowl',
      rivalryKey: base.key,
    });
    expect(buildAcceptedRivalryGames({
      accepted: [{ ...base, name: null, venue: null }],
      omitted: [],
      feasible: true,
    }, [teamA, teamB])[0]).toMatchObject({
      homeTeam: null,
      awayTeam: null,
      venue: null,
      name: null,
      rivalryKey: base.key,
    });
  });
});
