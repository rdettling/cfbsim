import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHistoricalGamesForTeam,
  getHistoricalGamesIndex,
} from '../../../../db/baseData';
import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { getGameNews } from '../../../../db/newsRepo';
import {
  getAllGames,
  getAllHistoricalPlayers,
  getAllPlayerSeasons,
  getAllPlays,
  getGameById,
  getGameDetail,
} from '../../../../db/simRepo';
import { buildTestLeague, buildTestTeam } from '../../../../test/fixtures';
import type { GameRecord } from '../../../../types/db';
import { loadGame } from './loadGame';

vi.mock('../../../../db/baseData');
vi.mock('../../../../db/leagueRepo');
vi.mock('../../../../db/newsRepo');
vi.mock('../../../../db/simRepo');

const targetGame: GameRecord = {
  id: 100,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: 'Alpha Stadium',
  winnerId: null,
  baseLabel: 'Non-Conference',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 4,
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
  watchability: 50,
};

describe('loadGame historical matchups', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const alpha = buildTestTeam({ id: 1, name: 'Alpha', abbreviation: 'ALP' });
    const beta = buildTestTeam({ id: 2, name: 'Beta', abbreviation: 'BET' });
    const user = buildTestTeam({ id: 3, name: 'User State', abbreviation: 'USR' });
    const league = buildTestLeague('season', {
      info: {
        ...buildTestLeague('season').info,
        currentYear: 2026,
        startYear: 2026,
        team: user.name,
      },
      teams: [alpha, beta, user],
    });
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({ league, players: [] });
    vi.mocked(getGameById).mockResolvedValue(targetGame);
    vi.mocked(getAllGames).mockResolvedValue([targetGame]);
    vi.mocked(getAllPlays).mockResolvedValue([]);
    vi.mocked(getGameDetail).mockResolvedValue(undefined);
    vi.mocked(getGameNews).mockResolvedValue(null);
    vi.mocked(getAllHistoricalPlayers).mockResolvedValue([]);
    vi.mocked(getAllPlayerSeasons).mockResolvedValue([]);
    vi.mocked(getHistoricalGamesIndex).mockResolvedValue({
      source: 'CollegeFootballData.com',
      years: [2025],
    });
    vi.mocked(getHistoricalGamesForTeam).mockResolvedValue({
      team: 'Alpha',
      games: [{
        sourceId: 10,
        year: 2025,
        weekPlayed: 2,
        opponent: 'Beta',
        teamScore: 24,
        opponentScore: 21,
        label: 'Historical Matchup',
      }],
    });
  });

  it('loads only Team A history and projects an eligible real meeting', async () => {
    const data = await loadGame(100);

    expect(getHistoricalGamesForTeam).toHaveBeenCalledWith('Alpha');
    expect(data.previousMatchups).toEqual({
      rows: [{
        rowKey: 'historical:10',
        source: 'historical',
        gameId: null,
        year: 2025,
        week: 2,
        label: 'Historical Matchup',
        teamAScore: 24,
        teamBScore: 21,
        winnerSide: 'teamA',
      }],
      series: { teamAWins: 1, teamBWins: 0, ties: 0 },
    });
  });

  it('does not load a static lookup when no indexed year predates the dynasty', async () => {
    const snapshot = await vi.mocked(loadLeaguePlayersSnapshot)();
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      ...snapshot,
      league: {
        ...snapshot.league,
        info: { ...snapshot.league.info, startYear: 2025 },
      },
    });

    const data = await loadGame(100);

    expect(data.previousMatchups).toEqual({
      rows: [],
      series: { teamAWins: 0, teamBWins: 0, ties: 0 },
    });
    expect(getHistoricalGamesForTeam).not.toHaveBeenCalled();
  });
});
