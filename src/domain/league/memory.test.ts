import { describe, expect, it } from 'vitest';
import type { GameLogRecord, GameRecord } from '../../types/db';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
  buildTestTeamAggregateTotals,
} from '../../test/fixtures';
import { buildGameDetail } from './gameDetails';
import { buildCompletedSeasonArtifacts } from './memory';

const game = (
  id: number,
  name: string,
  winnerId = 1,
  gameType: GameRecord['gameType'] = 'regular_season',
  teamAId = 1,
  teamBId = 2,
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: null,
  awayTeamId: null,
  neutralSite: true,
  venue: null,
  winnerId,
  baseLabel: name,
  name,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: id,
  year: 2025,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: 31,
  scoreB: 24,
  gameType,
  rivalryKey: null,
  watchability: 80,
});

const log: GameLogRecord = {
  playerId: 1,
  gameId: 10,
  pass_yards: 350,
  pass_attempts: 30,
  pass_completions: 22,
  pass_touchdowns: 4,
  pass_interceptions: 1,
  rush_yards: 20,
  rush_attempts: 5,
  rush_touchdowns: 1,
  receiving_yards: 0,
  receiving_catches: 0,
  receiving_touchdowns: 0,
  fumbles: 0,
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  fumbles_forced: 0,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
};

describe('buildCompletedSeasonArtifacts', () => {
  const buildMemory = (
    league: ReturnType<typeof buildTestLeague>,
    games: GameRecord[],
    players: ReturnType<typeof buildTestPlayer>[],
    logs: GameLogRecord[] = [],
  ) => buildCompletedSeasonArtifacts(
    league,
    games,
    games.map(record => buildGameDetail(
      record.id,
      record.year,
      [],
      [],
      logs.filter(entry => entry.gameId === record.id),
    )),
    players,
  ).memory;

  it('rejects a completed game without its detail record', () => {
    const baseLeague = buildTestLeague('summary');
    expect(() => buildCompletedSeasonArtifacts(
      buildTestLeague('summary', {
        settings: { ...baseLeague.settings, playoffTeams: 2 },
        playoff: { seeds: [1, 2], natty: 1 },
      }),
      [game(1, 'National Championship', 1, 'national_championship')],
      [],
      [],
    )).toThrow('no detail record');
  });

  it('captures typed postseason facts and structured award totals', () => {
    const teamA = buildTestTeam();
    const teamB = buildTestTeam({ id: 2, name: 'Other State', abbreviation: 'OTH' });
    const baseLeague = buildTestLeague('summary');
    const league = buildTestLeague('summary', {
      teams: [teamA, teamB],
      settings: {
        ...baseLeague.settings,
        playoffTeams: 2,
        playoffAutobids: 0,
        conferenceChampionsReceiveTopSeeds: false,
      },
      conferences: [{
        id: 1,
        confName: 'Test Conference',
        confFullName: 'Test Conference',
        confGames: 8,
        info: '',
        championship: 10,
        teams: [teamA, teamB],
      }],
      playoff: { seeds: [1, 2], natty: 13 },
    });
    const memory = buildMemory(
      league,
      [
        game(10, 'Test Conference championship', 1, 'conference_championship'),
        game(11, 'Rose Bowl', 1, 'bowl'),
        game(12, 'Playoff semifinal', 1, 'playoff_semifinal'),
        game(13, 'National Championship', 1, 'national_championship'),
      ],
      [
        buildTestPlayer({ id: 1, pos: 'qb' }),
        buildTestPlayer({ id: 2, pos: 'rb' }),
        buildTestPlayer({ id: 3, pos: 'wr' }),
        buildTestPlayer({ id: 4, pos: 'te' }),
        buildTestPlayer({ id: 5, pos: 'dl' }),
        buildTestPlayer({ id: 6, pos: 'lb' }),
        buildTestPlayer({ id: 7, pos: 'cb' }),
        buildTestPlayer({ id: 8, pos: 'k' }),
      ],
      [
        log,
        { ...log, playerId: 2, rush_attempts: 20, rush_yards: 120, rush_touchdowns: 2 },
        { ...log, playerId: 3, receiving_catches: 7, receiving_yards: 110, receiving_touchdowns: 1 },
        { ...log, playerId: 4, receiving_catches: 5, receiving_yards: 80, receiving_touchdowns: 1 },
        { ...log, playerId: 5, tackles: 6, sacks: 2 },
        { ...log, playerId: 6, tackles: 10, interceptions: 1 },
        { ...log, playerId: 7, tackles: 5, interceptions: 2 },
        {
          ...log,
          playerId: 8,
          field_goals_made: 3,
          field_goals_attempted: 3,
          extra_points_made: 4,
          extra_points_attempted: 4,
        },
        { ...log, gameId: 13, pass_yards: 999 },
      ],
    );

    expect(memory.postseason).toEqual({
      playoff: {
        format: 2,
        seeds: [1, 2],
        autobids: 0,
        conferenceChampionsReceiveTopSeeds: false,
        games: { championship: 13 },
      },
      conferenceChampions: [{
        conferenceName: 'Test Conference',
        teamId: 1,
        championshipGameId: 10,
      }],
      bowls: [{ gameId: 11, name: 'Rose Bowl', tier: 'ny6' }],
    });
    expect(memory.teamSnapshots).toEqual([
      buildTestSeasonTeamSnapshot({
        offense: buildTestTeamAggregateTotals({ points: 124 }),
        defense: buildTestTeamAggregateTotals({ points: 96 }),
      }),
      buildTestSeasonTeamSnapshot({
        teamId: 2,
        offense: buildTestTeamAggregateTotals({ points: 96 }),
        defense: buildTestTeamAggregateTotals({ points: 124 }),
      }),
    ]);
    expect(memory.awards.map(award => award.categorySlug)).toEqual([
      'heisman',
      'maxwell',
      'davey_obrien',
      'doak_walker',
      'biletnikoff',
      'mackey',
      'bednarik',
      'nagurski',
      'ted_hendricks',
      'butkus',
      'thorpe',
      'lou_groza',
    ]);
    expect(memory.awards.every(award => award.teamId === 1)).toBe(true);
    expect(memory.awards.find(award => award.categorySlug === 'heisman')?.stats)
      .toMatchObject({ pass_yards: 350, pass_touchdowns: 4 });
    expect(memory).not.toHaveProperty('last_updated');
  });

  it.each([
    {
      format: 4 as const,
      playoff: { seeds: [1, 2, 3, 4], left_semi: 1, right_semi: 2, natty: 3 },
      games: {
        leftSemifinal: 1,
        rightSemifinal: 2,
        championship: 3,
      },
    },
    {
      format: 12 as const,
      playoff: {
        seeds: Array.from({ length: 12 }, (_, index) => index + 1),
        left_r1_1: 1,
        left_r1_2: 2,
        right_r1_1: 3,
        right_r1_2: 4,
        left_quarter_1: 5,
        left_quarter_2: 6,
        right_quarter_1: 7,
        right_quarter_2: 8,
        left_semi: 9,
        right_semi: 10,
        natty: 11,
      },
      games: {
        leftFirstRound1: 1,
        leftFirstRound2: 2,
        rightFirstRound1: 3,
        rightFirstRound2: 4,
        leftQuarterfinal1: 5,
        leftQuarterfinal2: 6,
        rightQuarterfinal1: 7,
        rightQuarterfinal2: 8,
        leftSemifinal: 9,
        rightSemifinal: 10,
        championship: 11,
      },
    },
  ])('captures every explicit $format-team playoff slot', ({ format, playoff, games }) => {
    const teams = Array.from({ length: format }, (_, index) => buildTestTeam({
      id: index + 1,
      name: `Team ${index + 1}`,
      abbreviation: `T${index + 1}`,
      ranking: index + 1,
    }));
    const baseLeague = buildTestLeague('summary');
    const records = format === 4
      ? [
          game(1, 'Left semifinal', 1, 'playoff_semifinal', 1, 4),
          game(2, 'Right semifinal', 2, 'playoff_semifinal', 2, 3),
          game(3, 'National Championship', 1, 'national_championship', 1, 2),
        ]
      : [
          game(1, 'Left first round 1', 8, 'playoff_first_round', 8, 9),
          game(2, 'Left first round 2', 5, 'playoff_first_round', 5, 12),
          game(3, 'Right first round 1', 7, 'playoff_first_round', 7, 10),
          game(4, 'Right first round 2', 6, 'playoff_first_round', 6, 11),
          game(5, 'Left quarterfinal 1', 1, 'playoff_quarterfinal', 1, 8),
          game(6, 'Left quarterfinal 2', 4, 'playoff_quarterfinal', 4, 5),
          game(7, 'Right quarterfinal 1', 2, 'playoff_quarterfinal', 2, 7),
          game(8, 'Right quarterfinal 2', 3, 'playoff_quarterfinal', 3, 6),
          game(9, 'Left semifinal', 1, 'playoff_semifinal', 1, 4),
          game(10, 'Right semifinal', 2, 'playoff_semifinal', 2, 3),
          game(11, 'National Championship', 1, 'national_championship', 1, 2),
        ];
    const memory = buildMemory(
      buildTestLeague('summary', {
        teams,
        conferences: [],
        settings: {
          ...baseLeague.settings,
          playoffTeams: format,
          playoffAutobids: 0,
          conferenceChampionsReceiveTopSeeds: false,
        },
        playoff,
      }),
      records,
      [],
    );

    expect(memory.postseason.playoff).toMatchObject({ format, games });
  });

  it('rejects incomplete, duplicate, and unknown playoff seeds', () => {
    const baseLeague = buildTestLeague('summary');
    const build = (seeds: number[]) => buildMemory(
      buildTestLeague('summary', {
        settings: { ...baseLeague.settings, playoffTeams: 2 },
        playoff: { seeds, natty: 1 },
      }),
      [game(1, 'National Championship', 1, 'national_championship')],
      [],
    );

    expect(() => build([1])).toThrow();
    expect(() => build([1, 1])).toThrow();
    expect(() => build([1, 2])).toThrow();
  });

  it('resolves a conference without a title game using the standings tie-break order', () => {
    const teamA = buildTestTeam({ totalWins: 10, ranking: 1 });
    const teamB = buildTestTeam({
      id: 2,
      name: 'Other State',
      abbreviation: 'OTH',
      totalWins: 11,
      ranking: 2,
    });
    const baseLeague = buildTestLeague('summary');
    const memory = buildMemory(
      buildTestLeague('summary', {
        teams: [teamA, teamB],
        conferences: [{ ...baseLeague.conferences[0], teams: [teamA, teamB] }],
        settings: { ...baseLeague.settings, playoffTeams: 2, playoffAutobids: 0 },
        playoff: { seeds: [1, 2], natty: 1 },
      }),
      [game(1, 'National Championship', 1, 'national_championship')],
      [],
    );

    expect(memory.postseason.conferenceChampions).toEqual([{
      conferenceName: 'Test Conference',
      teamId: 2,
      championshipGameId: null,
    }]);
  });
});
