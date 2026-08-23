import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { GameRecord } from '../../types/db';
import type { Info, PlayoffTeamCount, Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import { BOWL_WEEK } from '../league/postseason';
import {
  finalizePostseasonRankings,
  updateRankings,
} from './rankings';
import {
  getEvidenceScore,
  getResumeScore,
  getTeamScore,
} from './rankingScores';

const team = (id: number, overrides: Partial<Team> = {}) => buildTestTeam({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  ranking: id,
  last_rank: id,
  rating: 80,
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0 (0-0)',
  poll_score: 0,
  wins_over_expectation: 0,
  wins_over_expectation_per_game: 0,
  ...overrides,
});

const info = (currentWeek: number): Info => ({
  currentWeek,
  lastRankingsWeek: currentWeek - 1,
  currentYear: 2026,
  startYear: 2026,
  stage: 'season',
  team: 'Team 1',
  lastWeek: 19,
});

const settings = (
  playoffTeams: PlayoffTeamCount,
): LeagueState['settings'] => ({
  conferencePolicy: 'historical',
  postseasonPolicy: 'custom',
  playoffTeams,
  playoffAutobids: playoffTeams === 12 ? 5 : 0,
  conferenceChampionsReceiveTopSeeds: false,
});

const neutralPerformance = (teams: Team[]) => new Map(
  teams.map(entry => [entry.id, 50]),
);

const natty = (winnerId: number, teamAId: number, teamBId: number): GameRecord => ({
  id: 1,
  teamAId,
  teamBId,
  homeTeamId: null,
  awayTeamId: null,
  neutralSite: true,
  venue: null,
  winnerId,
  baseLabel: 'National Championship',
  name: 'National Championship',
  gameType: 'national_championship',
  rivalryKey: null,
  spreadA: '',
  spreadB: '',
  moneylineA: '',
  moneylineB: '',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed: 19,
  year: 2026,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: winnerId === teamAId ? 28 : 21,
  scoreB: winnerId === teamBId ? 28 : 21,
  watchability: 100,
});

describe('weekly rankings', () => {
  it('uses Team Rating early and removes rating and rank history after eight games', () => {
    const earlyStrong = team(1, {
      ranking: 20,
      rating: 99,
      totalWins: 1,
      gamesPlayed: 1,
    });
    const earlyWeak = team(2, {
      ranking: 1,
      rating: 25,
      totalWins: 1,
      gamesPlayed: 1,
    });
    const earlyTeams = [earlyStrong, earlyWeak];
    updateRankings(info(1), earlyTeams, settings(12), neutralPerformance(earlyTeams));
    expect(earlyStrong.ranking).toBe(1);

    const lateStrong = team(1, {
      ranking: 20,
      rating: 99,
      totalWins: 4,
      totalLosses: 4,
      gamesPlayed: 8,
    });
    const lateWeak = team(2, {
      ranking: 1,
      rating: 25,
      totalWins: 4,
      totalLosses: 4,
      gamesPlayed: 8,
    });
    const lateTeams = [lateStrong, lateWeak];
    updateRankings(info(8), lateTeams, settings(12), neutralPerformance(lateTeams));

    expect(lateStrong.poll_score).toBe(lateWeak.poll_score);
    expect(lateTeams.map(entry => entry.ranking)).toEqual([1, 2]);
  });

  it('breaks exact Poll Score ties by résumé, Performance Index, and team ID', () => {
    const lowerResume = team(1, {
      totalLosses: 8,
      gamesPlayed: 8,
      wins_over_expectation_per_game: -1,
    });
    const higherResumeHigherId = team(3, {
      totalLosses: 8,
      gamesPlayed: 8,
      wins_over_expectation_per_game: -0.75,
    });
    const higherResumeLowerId = team(2, {
      totalLosses: 8,
      gamesPlayed: 8,
      wins_over_expectation_per_game: -0.75,
    });
    const teams = [lowerResume, higherResumeHigherId, higherResumeLowerId];
    const tiedPollScore = getEvidenceScore({
      resumeScore: getResumeScore(higherResumeHigherId),
      performanceIndex: 0,
    });
    const performance = new Map([
      [lowerResume.id, tiedPollScore * 18 / 5],
      [higherResumeHigherId.id, 0],
      [higherResumeLowerId.id, 0],
    ]);

    updateRankings(info(8), teams, settings(12), performance);

    expect(teams.map(entry => entry.poll_score)).toEqual([
      teams[1].poll_score,
      teams[1].poll_score,
      teams[1].poll_score,
    ]);
    expect([...teams].sort((a, b) => a.ranking - b.ranking).map(entry => entry.id))
      .toEqual([2, 3, 1]);
  });

  it('keeps an early top-five loser in the Top 25', () => {
    const teams = Array.from({ length: 136 }, (_, index) => team(index + 1, {
      ranking: index + 1,
      rating: index < 5 ? 99 : 25,
      totalWins: 1,
      gamesPlayed: 1,
      wins_over_expectation_per_game: 0.5,
    }));
    const loser = teams[2];
    Object.assign(loser, {
      totalWins: 0,
      totalLosses: 1,
      wins_over_expectation_per_game: -0.5,
    });

    updateRankings(
      info(1),
      teams,
      settings(12),
      neutralPerformance(teams),
    );

    expect(loser.last_rank).toBe(3);
    expect(loser.ranking).toBeGreaterThan(3);
    expect(loser.ranking).toBeLessThanOrEqual(25);
    expect(loser.poll_score).toBeGreaterThan(65);
  });

  it('does not force the weekly No. 1 Poll Score to 100', () => {
    const calculateLeaderScore = (winsOverExpectationPerGame: number) => {
      const leader = team(1, {
        ranking: 1,
        totalWins: 1,
        gamesPlayed: 1,
        wins_over_expectation_per_game: winsOverExpectationPerGame,
      });
      const teams = [
        leader,
        team(2, { ranking: 2, totalWins: 1, gamesPlayed: 1 }),
        team(3, { ranking: 3, totalLosses: 1, gamesPlayed: 1 }),
      ];
      updateRankings(
        info(1),
        teams,
        settings(12),
        neutralPerformance(teams),
      );
      expect(leader.ranking).toBe(1);
      return leader.poll_score;
    };

    expect(calculateLeaderScore(0.2)).toBeLessThan(100);
    expect(calculateLeaderScore(0.9)).toBeGreaterThan(calculateLeaderScore(0.2));
  });

  it('does not continue an earlier loss penalty after the team wins', () => {
    const teams = Array.from({ length: 20 }, (_, index) => team(index + 1, {
      ranking: index + 1,
      totalWins: 1,
      gamesPlayed: 1,
      wins_over_expectation_per_game: 0.5,
    }));
    const target = teams[2];
    Object.assign(target, {
      totalWins: 0,
      totalLosses: 1,
      gamesPlayed: 1,
      wins_over_expectation_per_game: -0.5,
    });

    updateRankings(
      info(1),
      teams,
      settings(12),
      neutralPerformance(teams),
    );
    const scoreAfterLoss = target.poll_score;
    teams.forEach(entry => Object.assign(entry, {
      totalWins: 1,
      totalLosses: 1,
      gamesPlayed: 2,
      wins_over_expectation_per_game: 0,
    }));
    Object.assign(target, {
      totalWins: 1,
      totalLosses: 1,
      gamesPlayed: 2,
      wins_over_expectation_per_game: 0,
    });

    updateRankings(
      info(2),
      teams,
      settings(12),
      neutralPerformance(teams),
    );

    expect(target.poll_score).toBeGreaterThan(scoreAfterLoss);
  });

  it.each([
    { playoffTeams: 4 as const, week: BOWL_WEEK },
    { playoffTeams: 12 as const, week: BOWL_WEEK },
    { playoffTeams: 12 as const, week: BOWL_WEEK + 1 },
    { playoffTeams: 12 as const, week: BOWL_WEEK + 2 },
  ])(
    'freezes the $playoffTeams-team rankings in Week $week',
    ({ playoffTeams, week }) => {
      const teams = [
        team(1, { ranking: 1, poll_score: 80, wins_over_expectation_per_game: -1 }),
        team(2, { ranking: 2, poll_score: 20, wins_over_expectation_per_game: 1 }),
      ];
      const before = structuredClone(teams);

      expect(updateRankings(
        info(week),
        teams,
        settings(playoffTeams),
        new Map(),
      )).toEqual([]);
      expect(teams).toEqual(before);
    },
  );

  it.each([
    { playoffTeams: 2 as const, week: 16 },
    { playoffTeams: 4 as const, week: 17 },
    { playoffTeams: 12 as const, week: 19 },
  ])(
    'updates the $playoffTeams-team rankings in non-frozen Week $week',
    ({ playoffTeams, week }) => {
      const teams = [
        team(1, { ranking: 1, wins_over_expectation_per_game: -1 }),
        team(2, { ranking: 2, wins_over_expectation_per_game: 1 }),
        team(3, { ranking: 3, wins_over_expectation_per_game: 0 }),
        team(4, { ranking: 4, wins_over_expectation_per_game: 0 }),
      ];

      expect(updateRankings(
        info(week),
        teams,
        settings(playoffTeams),
        neutralPerformance(teams),
      ))
        .toHaveLength(4);
      expect(teams.every(entry => Number.isFinite(entry.poll_score))).toBe(true);
      expect(teams.map(entry => entry.last_rank)).toEqual([1, 2, 3, 4]);
    },
  );

  it('handles empty and single-team leagues deterministically', () => {
    expect(updateRankings(info(7), [], settings(2), new Map())).toEqual([]);

    const onlyTeam = team(1);
    const updates = updateRankings(
      info(7),
      [onlyTeam],
      settings(2),
      neutralPerformance([onlyTeam]),
    );

    expect(updates).toHaveLength(1);
    expect(onlyTeam.ranking).toBe(1);
    expect(onlyTeam.poll_score).toBeCloseTo(getTeamScore(onlyTeam.rating));
    expect(Number.isFinite(onlyTeam.poll_score)).toBe(true);
  });
});

describe('final postseason rankings', () => {
  it('forces the finalists into the top two without replacing ballot scores', () => {
    const champion = team(1, {
      ranking: 4,
      last_rank: 4,
      totalWins: 5,
      totalLosses: 5,
      gamesPlayed: 10,
      wins_over_expectation: -5,
      wins_over_expectation_per_game: -0.5,
    });
    const runnerUp = team(2, {
      ranking: 3,
      last_rank: 3,
      totalWins: 6,
      totalLosses: 4,
      gamesPlayed: 10,
      wins_over_expectation: -2,
      wins_over_expectation_per_game: -0.2,
    });
    const bestRemaining = team(3, {
      ranking: 2,
      last_rank: 2,
      totalWins: 9,
      totalLosses: 1,
      gamesPlayed: 10,
      wins_over_expectation: 5,
      wins_over_expectation_per_game: 0.5,
    });
    const other = team(4, {
      ranking: 1,
      last_rank: 1,
      totalWins: 8,
      totalLosses: 2,
      gamesPlayed: 10,
      wins_over_expectation: 2,
      wins_over_expectation_per_game: 0.2,
    });
    const teams = [champion, runnerUp, bestRemaining, other];

    finalizePostseasonRankings(
      teams,
      natty(champion.id, champion.id, runnerUp.id),
      neutralPerformance(teams),
    );

    expect([...teams].sort((left, right) => left.ranking - right.ranking)
      .map(entry => entry.id)).toEqual([1, 2, 3, 4]);
    teams.forEach(entry => {
      expect(entry.poll_score).toBeCloseTo(getEvidenceScore({
        resumeScore: getResumeScore(entry),
        performanceIndex: 50,
      }));
    });
  });

  it('uses wins over expectation to separate equal-record non-finalists', () => {
    const champion = team(1, { totalWins: 14, totalLosses: 2, gamesPlayed: 16 });
    const runnerUp = team(2, { totalWins: 12, totalLosses: 3, gamesPlayed: 15 });
    const lowerTotal = team(3, {
      ranking: 4,
      last_rank: 4,
      totalWins: 11,
      totalLosses: 3,
      gamesPlayed: 14,
      wins_over_expectation: 6.3,
      wins_over_expectation_per_game: 0.45,
    });
    const higherTotal = team(4, {
      ranking: 3,
      last_rank: 3,
      totalWins: 11,
      totalLosses: 3,
      gamesPlayed: 14,
      wins_over_expectation: 6.7,
      wins_over_expectation_per_game: 0.447,
    });
    const teams = [champion, runnerUp, lowerTotal, higherTotal];

    finalizePostseasonRankings(
      teams,
      natty(champion.id, champion.id, runnerUp.id),
      neutralPerformance(teams),
    );

    expect(lowerTotal.wins_over_expectation).toBeLessThan(higherTotal.wins_over_expectation);
    expect(lowerTotal.ranking).toBe(3);
    expect(higherTotal.ranking).toBe(4);
  });

  it('orders every team by Evidence Score when the championship is incomplete', () => {
    const lower = team(1, {
      ranking: 1,
      last_rank: 1,
      wins_over_expectation_per_game: 0.2,
    });
    const higher = team(2, {
      ranking: 3,
      last_rank: 3,
      wins_over_expectation_per_game: 0.5,
    });
    const middle = team(3, {
      ranking: 2,
      last_rank: 2,
      wins_over_expectation_per_game: 0.3,
    });
    const teams = [lower, higher, middle];

    finalizePostseasonRankings(teams, null, neutralPerformance(teams));

    expect([...teams].sort((left, right) => left.ranking - right.ranking)
      .map(entry => entry.id)).toEqual([2, 3, 1]);
    teams.forEach(entry => {
      expect(entry.poll_score).toBeCloseTo(getEvidenceScore({
        resumeScore: getResumeScore(entry),
        performanceIndex: 50,
      }));
    });
  });
});
