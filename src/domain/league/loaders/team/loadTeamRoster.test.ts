import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../../../../test/fixtures';
import { loadTeamRoster } from './loadTeamRoster';

vi.mock('../../../../db/leagueRepo');

describe('loadTeamRoster', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      league: buildTestLeague('season', {
        teams: [
          buildTestTeam(),
          buildTestTeam({ id: 2, name: 'Alpha Tech', abbreviation: 'ALP' }),
        ],
      }),
      players: [
        buildTestPlayer({ id: 1, teamId: 1, pos: 'wr' }),
        buildTestPlayer({ id: 2, teamId: 1, pos: 'qb' }),
        buildTestPlayer({ id: 3, teamId: 1, pos: 'ath' }),
        buildTestPlayer({ id: 4, teamId: 1, pos: 'aaa' }),
        buildTestPlayer({ id: 5, teamId: 2, pos: 'rb' }),
      ],
    });
  });

  it('resolves the requested team and orders known positions before extras', async () => {
    await expect(loadTeamRoster('Test State')).resolves.toMatchObject({
      team: { id: 1 },
      roster: expect.arrayContaining([
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ id: 2 }),
        expect.objectContaining({ id: 3 }),
        expect.objectContaining({ id: 4 }),
      ]),
      positions: ['qb', 'wr', 'aaa', 'ath'],
      teams: ['Alpha Tech', 'Test State'],
    });
  });

  it('falls back to the user team for an unknown route team', async () => {
    await expect(loadTeamRoster('Missing Team')).resolves.toMatchObject({
      team: { id: 1, name: 'Test State' },
    });
  });
});
