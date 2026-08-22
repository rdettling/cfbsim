import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import type { Team } from '../../../types/domain';
import {
  buildConferenceStandings,
  freezeConferenceStandings,
} from './standings';

const team = (id: number, ranking = id): Team => buildTestTeam({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  ranking,
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0 (0-0)',
});

const game = (
  id: number,
  teamAId: number,
  teamBId: number,
  winnerId: number,
  gameType: GameRecord['gameType'] = 'regular_season',
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId,
  baseLabel: `Team ${teamAId} vs Team ${teamBId}`,
  name: gameType === 'regular_season' ? null : 'Postseason',
  gameType,
  rivalryKey: null,
  spreadA: '',
  spreadB: '',
  moneylineA: '',
  moneylineB: '',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed: gameType === 'regular_season' ? 1 : 15,
  year: 2026,
  rankATOG: teamAId,
  rankBTOG: teamBId,
  resultA: winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: winnerId === teamAId ? 24 : 17,
  scoreB: winnerId === teamBId ? 24 : 17,
  watchability: 50,
});

const order = (teams: Team[], games: GameRecord[]) =>
  buildConferenceStandings({ teams, games, year: 2026 });

describe('conference standings', () => {
  it('orders uneven schedules by conference winning percentage', () => {
    const teams = [team(1), team(2), team(3), team(4)];
    const standings = order(teams, [
      game(1, 1, 3, 1),
      game(2, 1, 4, 1),
      game(3, 2, 3, 2),
      game(4, 2, 4, 4),
    ]);

    const compared = standings.filter(row => row.team.id === 1 || row.team.id === 2);
    expect(compared.map(row => row.team.id)).toEqual([1, 2]);
    expect(compared[0]).toMatchObject({ conferenceWins: 2, conferenceLosses: 0 });
    expect(compared[1]).toMatchObject({ conferenceWins: 1, conferenceLosses: 1 });
  });

  it('uses a completed two-team head-to-head result before other criteria', () => {
    const teams = [team(1, 20), team(2, 1), team(3), team(4)];
    const standings = order(teams, [
      game(1, 1, 2, 1),
      game(2, 1, 3, 3),
      game(3, 2, 4, 2),
    ]);

    const compared = standings.filter(row => row.team.id === 1 || row.team.id === 2);
    expect(compared.map(row => row.team.id)).toEqual([1, 2]);
    expect(compared[0].resolvedBy).toBe('head_to_head');
  });

  it('uses a complete multi-team mini-table', () => {
    const teams = [team(1, 30), team(2, 20), team(3, 10), team(4), team(5)];
    const standings = order(teams, [
      game(1, 1, 2, 1), game(2, 1, 3, 1), game(3, 2, 3, 2),
      game(4, 1, 4, 4), game(5, 1, 5, 5),
      game(6, 2, 4, 2), game(7, 2, 5, 5),
      game(8, 3, 4, 3), game(9, 3, 5, 3),
    ]);

    const compared = standings.filter(row => row.team.id <= 3);
    expect(compared.map(row => row.team.id)).toEqual([1, 2, 3]);
    expect(compared.map(row => row.resolvedBy)).toEqual([
      'head_to_head', 'head_to_head', 'head_to_head',
    ]);
  });

  it('skips an incomplete mini-table and uses common conference opponents', () => {
    const teams = [team(1, 20), team(2, 1), team(3), team(4), team(5), team(6)];
    const standings = order(teams, [
      game(1, 1, 3, 1),
      game(2, 1, 5, 5),
      game(3, 2, 3, 3),
      game(4, 2, 6, 2),
      game(5, 3, 4, 4),
    ]);

    const compared = standings.filter(row => row.team.id === 1 || row.team.id === 2);
    expect(compared.map(row => row.team.id)).toEqual([1, 2]);
    expect(compared[0].resolvedBy).toBe('common_opponents');
  });

  it('recomputes common opponents only within subgroups left tied by head-to-head', () => {
    const teams = Array.from({ length: 7 }, (_, index) => team(index + 1, 20 + index));
    const standings = order(teams, [
      game(1, 1, 2, 2), game(2, 1, 3, 1), game(3, 1, 4, 1),
      game(4, 2, 3, 2), game(5, 2, 4, 4), game(6, 3, 4, 3),
      game(7, 1, 5, 1), game(8, 1, 6, 6), game(9, 1, 7, 7),
      game(10, 2, 5, 2), game(11, 2, 6, 6), game(12, 2, 7, 7),
      game(13, 3, 5, 3), game(14, 3, 6, 3), game(15, 3, 7, 7),
      game(16, 4, 5, 4), game(17, 4, 6, 4), game(18, 4, 7, 7),
      game(19, 5, 6, 6),
    ]);

    const compared = standings.filter(row => row.team.id <= 4);
    expect(compared.map(row => row.team.id)).toEqual([1, 2, 4, 3]);
    expect(compared.map(row => row.resolvedBy)).toEqual([
      'common_opponents',
      'common_opponents',
      'common_opponents',
      'common_opponents',
    ]);
  });

  it('falls through to overall regular-season record and then poll rank', () => {
    const teams = [team(1, 20), team(2, 10), team(3), team(4)];
    teams[2].conference = teams[2].confName = 'Other';
    teams[3].conference = teams[3].confName = 'Other';
    const overall = order(teams.slice(0, 2), [
      game(1, 1, 3, 1),
      game(2, 2, 4, 4),
    ]);
    const poll = order(teams.slice(0, 2), []);

    expect(overall.map(row => row.team.id)).toEqual([1, 2]);
    expect(overall[0].resolvedBy).toBe('overall_record');
    expect(poll.map(row => row.team.id)).toEqual([2, 1]);
    expect(poll[0].resolvedBy).toBe('poll_rank');
  });

  it('uses team ID only as an unreported deterministic integrity fallback', () => {
    const standings = order([team(2, 1), team(1, 1)], []);

    expect(standings.map(row => row.team.id)).toEqual([1, 2]);
    expect(standings.map(row => row.resolvedBy)).toEqual([null, null]);
  });

  it('excludes conference championships and preserves a frozen final order', () => {
    const teams = [team(1, 2), team(2, 1)];
    const live = order(teams, []);
    const frozen = freezeConferenceStandings(2026, live);
    teams[0].ranking = 1;
    teams[1].ranking = 2;
    const final = buildConferenceStandings({
      teams,
      games: [game(1, 1, 2, 1, 'conference_championship')],
      year: 2026,
      finalStandings: frozen,
    });

    expect(final.map(row => row.team.id)).toEqual([2, 1]);
    expect(final.every(row => row.conferenceWins === 0 && row.conferenceLosses === 0)).toBe(true);
    expect(final[0]).toMatchObject({ pollRank: 1, resolvedBy: 'poll_rank' });
  });
});
