/// <reference types="node" />
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildHistoricalGamesSeason,
  getHistoricalWeek,
  parseTransformGameHistoryArgs,
  runTransformGameHistory,
} from './transform_game_history';
import { GAME_HISTORY_SOURCE } from '../src/domain/historicalGames';
import {
  GAME_HISTORY_API_ENDPOINT,
  GAME_HISTORY_RANKINGS_API_ENDPOINT,
} from './game_history_pipeline';
import type { SeasonData } from '../src/types/baseData';

const temporaryDirectories: string[] = [];

const makeDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cfbsim-game-history-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

const rawGame = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  season: 2000,
  week: 1,
  seasonType: 'regular',
  startDate: '2000-08-26T00:00:00.000Z',
  completed: true,
  neutralSite: false,
  notes: null,
  playoff: null,
  venue: 'Test Stadium',
  homeTeam: 'TCU',
  homeId: 1,
  homeClassification: 'fbs',
  homeConference: 'Big 12',
  homePoints: 28,
  awayTeam: 'SMU',
  awayId: 2,
  awayClassification: 'fbs',
  awayConference: 'Conference USA',
  awayPoints: 14,
  ...overrides,
});

const rawRankings = (year = 2000, weeks = [1, 16]) => weeks.map(week => ({
  season: year,
  seasonType: 'regular',
  week,
  polls: [{
    poll: 'AP Top 25',
    ranks: [
      { rank: 12, teamId: 1 },
      { rank: 25, teamId: 3 },
    ],
  }],
}));

const yearData = (
  playoffTeams: 2 | 4 | 12 = 2,
): SeasonData => ({
  year: 2025,
  playoff: {
    teams: playoffTeams,
    conf_champ_autobids: playoffTeams === 12 ? 5 : 0,
    conf_champ_top_4: playoffTeams === 12,
  },
  conferences: {
    'Big 12': { games: 9, teams: { 'Texas Christian': 6 } },
    ACC: { games: 8, teams: { 'Southern Methodist': 5 } },
  },
  independents: {},
  results: null,
});

describe('game history generation', () => {
  it('accepts one explicit production year', () => {
    expect(parseTransformGameHistoryArgs(['--year', '2025']))
      .toEqual({ year: 2025 });
    expect(() => parseTransformGameHistoryArgs(['--preview']))
      .toThrow('Unknown');
  });

  it('builds one exact season output at a time', () => {
    const result = buildHistoricalGamesSeason({
      rawGames: [rawGame()],
      rawRankings: rawRankings(),
      year: 2000,
      supportedTeams: new Set(['Texas Christian', 'Southern Methodist']),
      yearData: yearData(),
    });

    expect(Object.keys(result)).toEqual(['year', 'games']);
    expect(result.year).toBe(2000);
    expect(result.games).toHaveLength(1);
  });

  it('normalizes supported teams and excludes unfinished games', () => {
    const result = buildHistoricalGamesSeason({
      rawGames: [rawGame(), rawGame({ id: 11, completed: false })],
      rawRankings: rawRankings(),
      year: 2000,
      supportedTeams: new Set(['Texas Christian', 'Southern Methodist']),
      yearData: yearData(),
    });

    expect(result.games).toHaveLength(1);
    expect(result.games[0]).toMatchObject({
      homeTeam: 'Texas Christian',
      awayTeam: 'Southern Methodist',
      homeScore: 28,
      awayScore: 14,
      homeRank: 12,
      awayRank: 0,
      weekPlayed: 1,
      name: null,
      label: 'Non-Conference: Big 12 vs ACC',
    });
    expect(result.games[0]).not.toHaveProperty('date');
  });

  it('collapses duplicate provider records for the same result', () => {
    const result = buildHistoricalGamesSeason({
      rawGames: [
        rawGame({ id: 10, startDate: '2000-08-26T04:00:00.000Z' }),
        rawGame({ id: 20, startDate: '2000-08-26T20:00:00.000Z' }),
      ],
      rawRankings: rawRankings(),
      year: 2000,
      supportedTeams: new Set(['Texas Christian', 'Southern Methodist']),
      yearData: yearData(),
    });

    expect(result.games).toHaveLength(1);
    expect(result.games[0].sourceId).toBe(20);
  });

  it('retains display-only lower-division opponents', () => {
    const result = buildHistoricalGamesSeason({
      rawGames: [rawGame({
        awayTeam: 'Lower Division State',
        awayId: 3,
        awayClassification: 'fcs',
        awayConference: 'FBS Independents',
      })],
      rawRankings: rawRankings(),
      year: 2000,
      supportedTeams: new Set(['Texas Christian']),
      yearData: yearData(),
    });

    expect(result.games[0].awayTeam).toBe('Lower Division State');
    expect(result.games[0].label)
      .toBe('Non-Conference: Big 12 vs Independent');
  });

  it('rejects an unmapped FBS participant', () => {
    expect(() => buildHistoricalGamesSeason({
      rawGames: [rawGame({ homeTeam: 'Unknown FBS' })],
      rawRankings: rawRankings(),
      year: 2000,
      supportedTeams: new Set(['Southern Methodist']),
      yearData: yearData(),
    })).toThrow('Unknown FBS');
  });

  it('uses named-game labels and the latest regular poll for postseason', () => {
    const result = buildHistoricalGamesSeason({
      rawGames: [rawGame({
        id: 20,
        seasonType: 'postseason',
        week: 1,
        playoff: {
          round: 'championship',
          bowlName: 'National Championship',
        },
      })],
      rawRankings: rawRankings(),
      year: 2000,
      supportedTeams: new Set(['Texas Christian', 'Southern Methodist']),
      yearData: yearData(),
    });

    expect(result.games[0]).toMatchObject({
      weekPlayed: 16,
      homeRank: 12,
      awayRank: 0,
      name: 'National Championship',
      label: 'National Championship',
    });
  });

  it('maps postseason rounds into each app playoff format', () => {
    const game = (
      round: string | null,
      playoffTeams: 2 | 4 | 12,
    ) => getHistoricalWeek({
      id: 10,
      seasonType: 'postseason',
      week: 1,
      playoff: round === null ? null : { round },
    }, playoffTeams);

    expect(game(null, 2)).toBe(16);
    expect(game('semifinal', 4)).toBe(16);
    expect(game('championship', 4)).toBe(17);
    expect(game('first_round', 12)).toBe(16);
    expect(game('quarterfinal', 12)).toBe(17);
    expect(game('semifinal', 12)).toBe(18);
    expect(game('championship', 12)).toBe(19);
  });

  it('orders a regular week before postseason games mapped to the same week', () => {
    const result = buildHistoricalGamesSeason({
      rawGames: [
        rawGame({
          id: 20,
          week: 16,
          homePoints: 21,
          awayPoints: 14,
        }),
        rawGame({
          id: 10,
          seasonType: 'postseason',
          playoff: { round: 'first_round' },
        }),
      ],
      rawRankings: rawRankings(),
      year: 2000,
      supportedTeams: new Set(['Texas Christian', 'Southern Methodist']),
      yearData: yearData(12),
    });

    expect(result.games.map(game => [game.weekPlayed, game.seasonType]))
      .toEqual([[16, 'regular'], [16, 'postseason']]);
  });

  it('uses the latest prior AP poll when the provider omits a game week', () => {
    const result = buildHistoricalGamesSeason({
      rawGames: [rawGame({ week: 2 })],
      rawRankings: rawRankings(2000, [1]),
      year: 2000,
      supportedTeams: new Set(['Texas Christian', 'Southern Methodist']),
      yearData: yearData(),
    });

    expect(result.games[0]).toMatchObject({ homeRank: 12, awayRank: 0 });
  });

  it('rejects a game before the first available AP poll', () => {
    expect(() => buildHistoricalGamesSeason({
      rawGames: [rawGame({ week: 1 })],
      rawRankings: rawRankings(2000, [2]),
      year: 2000,
      supportedTeams: new Set(['Texas Christian', 'Southern Methodist']),
      yearData: yearData(),
    })).toThrow('AP Top 25 2000 week 1 has no current or prior snapshot');
  });

  it('builds deterministic single-season public output', async () => {
    const root = await makeDirectory();
    const rawDirectory = join(root, 'raw');
    const outputDirectory = join(root, 'public-output');
    const stagingParent = join(root, 'staging');
    await mkdir(join(rawDirectory, '2025'), { recursive: true });
    const regular = [rawGame({ season: 2025 })];
    await Promise.all([
      writeFile(
        join(rawDirectory, '2025', 'regular.json'),
        JSON.stringify(regular),
      ),
      writeFile(join(rawDirectory, '2025', 'postseason.json'), '[]'),
      writeFile(
        join(rawDirectory, '2025', 'rankings.json'),
        JSON.stringify(rawRankings(2025)),
      ),
      writeFile(join(rawDirectory, 'manifest.json'), JSON.stringify({
        source: GAME_HISTORY_SOURCE,
        endpoints: {
          games: GAME_HISTORY_API_ENDPOINT,
          rankings: GAME_HISTORY_RANKINGS_API_ENDPOINT,
        },
        seasons: {
          2025: {
            fetched_at: '2026-08-11T00:00:00.000Z',
            regular: { file: '2025/regular.json', records: 1 },
            postseason: { file: '2025/postseason.json', records: 0 },
            rankings: { file: '2025/rankings.json', records: 2 },
          },
        },
      })),
    ]);
    const run = () => runTransformGameHistory({
      options: { year: 2025 },
      rawDirectory,
      outputDirectory,
      stagingParent,
      completedYears: Promise.resolve([2025]),
    });

    await run();
    const firstIndex = await readFile(
      join(outputDirectory, 'index.json'),
      'utf8',
    );
    const firstSeason = await readFile(
      join(outputDirectory, '2025.json'),
      'utf8',
    );
    const firstTeamLookup = await readFile(
      join(outputDirectory, 'by-team', 'Texas Christian.json'),
      'utf8',
    );
    const emptyTeamLookup = JSON.parse(await readFile(
      join(outputDirectory, 'by-team', 'Sacramento State.json'),
      'utf8',
    ));
    await run();

    expect(await readFile(join(outputDirectory, 'index.json'), 'utf8'))
      .toBe(firstIndex);
    expect(await readFile(join(outputDirectory, '2025.json'), 'utf8'))
      .toBe(firstSeason);
    expect(await readFile(
      join(outputDirectory, 'by-team', 'Texas Christian.json'),
      'utf8',
    )).toBe(firstTeamLookup);
    expect(JSON.parse(firstIndex)).toMatchObject({ years: [2025] });
    expect(JSON.parse(firstSeason)).toMatchObject({
      year: 2025,
      games: [{ year: 2025 }],
    });
    expect(JSON.parse(firstTeamLookup)).toMatchObject({
      team: 'Texas Christian',
      games: [{
        year: 2025,
        opponent: 'Southern Methodist',
        teamScore: 28,
        opponentScore: 14,
      }],
    });
    expect(emptyTeamLookup).toEqual({ team: 'Sacramento State', games: [] });

    await mkdir(join(rawDirectory, '2024'));
    await Promise.all([
      writeFile(
        join(rawDirectory, '2024', 'regular.json'),
        JSON.stringify([rawGame({ id: 11, season: 2024, awayPoints: 13 })]),
      ),
      writeFile(join(rawDirectory, '2024', 'postseason.json'), '[]'),
      writeFile(
        join(rawDirectory, '2024', 'rankings.json'),
        JSON.stringify(rawRankings(2024)),
      ),
      writeFile(join(rawDirectory, 'manifest.json'), JSON.stringify({
        source: GAME_HISTORY_SOURCE,
        endpoints: {
          games: GAME_HISTORY_API_ENDPOINT,
          rankings: GAME_HISTORY_RANKINGS_API_ENDPOINT,
        },
        seasons: {
          2024: {
            fetched_at: '2026-08-10T00:00:00.000Z',
            regular: { file: '2024/regular.json', records: 1 },
            postseason: { file: '2024/postseason.json', records: 0 },
            rankings: { file: '2024/rankings.json', records: 2 },
          },
          2025: {
            fetched_at: '2026-08-11T00:00:00.000Z',
            regular: { file: '2025/regular.json', records: 1 },
            postseason: { file: '2025/postseason.json', records: 0 },
            rankings: { file: '2025/rankings.json', records: 2 },
          },
        },
      })),
    ]);
    await runTransformGameHistory({
      options: { year: 2024 },
      rawDirectory,
      outputDirectory,
      stagingParent,
      completedYears: Promise.resolve([2024, 2025]),
    });
    expect(JSON.parse(await readFile(
      join(outputDirectory, 'by-team', 'Texas Christian.json'),
      'utf8',
    )).games.map((game: { year: number }) => game.year)).toEqual([2025, 2024]);
  });

  it('fails when a selected raw snapshot is missing', async () => {
    const root = await makeDirectory();
    const rawDirectory = join(root, 'raw');
    await mkdir(rawDirectory, { recursive: true });
    await writeFile(join(rawDirectory, 'manifest.json'), JSON.stringify({
      source: GAME_HISTORY_SOURCE,
      endpoints: {
        games: GAME_HISTORY_API_ENDPOINT,
        rankings: GAME_HISTORY_RANKINGS_API_ENDPOINT,
      },
      seasons: {},
    }));

    await expect(runTransformGameHistory({
      options: { year: 2025 },
      rawDirectory,
      outputDirectory: join(root, 'output'),
      stagingParent: join(root, 'staging'),
      completedYears: Promise.resolve([2025]),
    })).rejects.toThrow('snapshot for 2025 is missing');
  });
});
