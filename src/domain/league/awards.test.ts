import { describe, expect, it } from 'vitest';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import type { GameLogRecord, GameRecord, PlayerRecord } from '../../types/db';
import { buildAwardScoringSnapshot, buildAwards, teamRankPercentile } from './awards';
import { AWARD_SCORING_CONFIG } from './awardScoringConfig';

const game = (
  id: number,
  gameType: GameRecord['gameType'] = 'regular_season',
  overrides: Partial<GameRecord> = {},
): GameRecord => ({
  id,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId: 1,
  baseLabel: `Game ${id}`,
  name: null,
  gameType,
  rivalryKey: null,
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
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: 31,
  scoreB: 24,
  watchability: 75,
  ...overrides,
});

const log = (
  playerId: number,
  gameId = 1,
  overrides: Partial<GameLogRecord> = {},
): GameLogRecord => ({
  playerId,
  gameId,
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 0,
  rush_attempts: 0,
  rush_touchdowns: 0,
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
  ...overrides,
});

const player = (
  id: number,
  pos: string,
  overrides: Partial<PlayerRecord> = {},
) => buildTestPlayer({
  id,
  pos,
  first: `Player${id}`,
  last: pos.toUpperCase(),
  ...overrides,
});

const teams = [
  buildTestTeam({ id: 1, name: 'Team 1', abbreviation: 'T1', ranking: 1 }),
  buildTestTeam({ id: 2, name: 'Team 2', abbreviation: 'T2', ranking: 2 }),
  buildTestTeam({ id: 3, name: 'Team 3', abbreviation: 'T3', ranking: 3 }),
  buildTestTeam({ id: 4, name: 'Team 4', abbreviation: 'T4', ranking: 4 }),
];
const league = buildTestLeague('season', { teams });

const entry = (
  awards: ReturnType<typeof buildAwards>['live'],
  categorySlug: string,
) => awards.find(award => award.categorySlug === categorySlug)!;

const ids = (award: ReturnType<typeof entry>) =>
  award.placements.map(placement => placement.player?.id ?? null);

const quarterbackLine = (overrides: Partial<GameLogRecord> = {}) => ({
  pass_completions: 20,
  pass_attempts: 30,
  pass_yards: 300,
  pass_touchdowns: 3,
  pass_interceptions: 1,
  rush_attempts: 5,
  rush_yards: 25,
  rush_touchdowns: 0,
  ...overrides,
});

describe('buildAwards', () => {
  it('returns all twelve categories with three empty placements when nobody qualifies', () => {
    const result = buildAwards(league, [], [], []);

    expect(result.live).toHaveLength(12);
    expect(result.live.flatMap(award => award.placements)).toHaveLength(36);
    expect(result.live.every(award =>
      award.placements.every(placement => placement.player === null),
    )).toBe(true);
  });

  it('counts conference championships and excludes every bowl and playoff round', () => {
    const players = [
      player(1, 'qb', { teamId: 1 }),
      player(2, 'qb', { teamId: 2 }),
      player(3, 'qb', { teamId: 3 }),
    ];
    const games = [
      game(1),
      game(2, 'conference_championship', {
        teamAId: 2,
        teamBId: 4,
        winnerId: 2,
      }),
      game(3, 'bowl', { teamAId: 3, teamBId: 4, winnerId: 3 }),
      game(4, 'playoff_first_round', { teamAId: 3, teamBId: 4, winnerId: 3 }),
      game(5, 'playoff_quarterfinal', { teamAId: 3, teamBId: 4, winnerId: 3 }),
      game(6, 'playoff_semifinal', { teamAId: 3, teamBId: 4, winnerId: 3 }),
      game(7, 'national_championship', { teamAId: 3, teamBId: 4, winnerId: 3 }),
    ];
    const logs = [
      log(1, 1, quarterbackLine({ pass_yards: 250, pass_touchdowns: 2 })),
      log(2, 2, quarterbackLine({ pass_yards: 400, pass_touchdowns: 5 })),
      ...games.slice(2).map(contest =>
        log(3, contest.id, quarterbackLine({ pass_yards: 700, pass_touchdowns: 8 })),
      ),
    ];

    const davey = entry(buildAwards(league, players, games, logs).live, 'davey_obrien');

    expect(ids(davey)).toEqual([2, 1, null]);
    expect(davey.placements.some(placement => placement.player?.id === 3)).toBe(false);
  });

  it('uses logged participation and excludes low-volume or zero-stat candidates', () => {
    const players = [
      player(1, 'qb', { starter: false }),
      player(2, 'qb'),
      player(3, 'qb'),
    ];
    const logs = [
      log(1, 1, quarterbackLine()),
      log(2, 1, quarterbackLine({ pass_attempts: 11, pass_completions: 8 })),
      log(3),
    ];

    const davey = entry(
      buildAwards(league, players, [game(1)], logs).live,
      'davey_obrien',
    );

    expect(ids(davey)).toEqual([1, null, null]);
  });

  it('rewards touchdowns and penalizes fumbles for running backs', () => {
    const players = [player(1, 'rb'), player(2, 'rb'), player(3, 'rb')];
    const common = {
      rush_attempts: 20,
      rush_yards: 120,
      receiving_catches: 2,
      receiving_yards: 20,
    };
    const logs = [
      log(1, 1, { ...common, rush_touchdowns: 2, fumbles: 0 }),
      log(2, 1, { ...common, rush_touchdowns: 0, fumbles: 0 }),
      log(3, 1, { ...common, rush_touchdowns: 2, fumbles: 2 }),
    ];

    const doak = entry(
      buildAwards(league, players, [game(1)], logs).live,
      'doak_walker',
    );

    expect(ids(doak)).toEqual([1, 3, 2]);
    expect(doak.placements[0].score).toBeGreaterThan(doak.placements[1].score!);
  });

  it('counts defensive takeaways in both overall and position scoring', () => {
    const players = [player(1, 'lb'), player(2, 'lb')];
    const logs = [
      log(1, 1, { tackles: 8, sacks: 1, interceptions: 1, fumbles_forced: 1 }),
      log(2, 1, { tackles: 8, sacks: 1 }),
    ];
    const awards = buildAwards(league, players, [game(1)], logs).live;

    expect(entry(awards, 'butkus').placements[0].player?.id).toBe(1);
    expect(entry(awards, 'bednarik').placements[0].player?.id).toBe(1);
  });

  it('uses volume-adjusted accuracy for kickers', () => {
    const players = [player(1, 'k'), player(2, 'k')];
    const logs = [
      log(1, 1, {
        field_goals_made: 1,
        field_goals_attempted: 1,
        extra_points_made: 3,
        extra_points_attempted: 3,
      }),
      log(2, 1, {
        field_goals_made: 8,
        field_goals_attempted: 10,
        extra_points_made: 3,
        extra_points_attempted: 3,
      }),
    ];

    const groza = entry(
      buildAwards(league, players, [game(1)], logs).live,
      'lou_groza',
    );

    expect(ids(groza).slice(0, 2)).toEqual([2, 1]);
  });

  it('decays the rating prior to zero after six games', () => {
    const players = [
      player(1, 'qb', { rating: 70 }),
      player(2, 'qb', { rating: 95 }),
    ];
    const oneGame = [game(1)];
    const oneGameLogs = players.map(candidate =>
      log(candidate.id, 1, quarterbackLine()),
    );
    expect(entry(
      buildAwards(league, players, oneGame, oneGameLogs).live,
      'davey_obrien',
    ).placements[0].player?.id).toBe(2);

    const sixGames = Array.from({ length: 6 }, (_, index) => game(index + 1));
    const sixGameLogs = sixGames.flatMap(contest => players.map(candidate =>
      log(candidate.id, contest.id, quarterbackLine()),
    ));
    expect(entry(
      buildAwards(league, players, sixGames, sixGameLogs).live,
      'davey_obrien',
    ).placements[0].player?.id).toBe(1);
  });

  it('uses national-rank percentile for every award with a stronger Heisman share', () => {
    const positions = ['qb', 'rb', 'wr', 'te', 'dl', 'lb', 'cb', 'k'];
    const players = positions.flatMap((pos, index) => [
      player(index * 2 + 1, pos, { teamId: 1, rating: 80 }),
      player(index * 2 + 2, pos, { teamId: 2, rating: 80 }),
    ]);
    const logs = players.map(candidate => {
      if (candidate.pos === 'qb') return log(candidate.id, 1, quarterbackLine());
      if (candidate.pos === 'rb') return log(candidate.id, 1, { rush_attempts: 15, rush_yards: 100, rush_touchdowns: 1 });
      if (candidate.pos === 'wr' || candidate.pos === 'te') {
        return log(candidate.id, 1, { receiving_catches: 5, receiving_yards: 80, receiving_touchdowns: 1 });
      }
      if (candidate.pos === 'k') {
        return log(candidate.id, 1, { field_goals_made: 2, field_goals_attempted: 2, extra_points_made: 3, extra_points_attempted: 3 });
      }
      return log(candidate.id, 1, { tackles: 8, sacks: 1, interceptions: 1 });
    });
    const snapshot = buildAwardScoringSnapshot(league, players, [game(1)], logs);

    snapshot.awards.live.forEach(award => {
      const winnerId = award.placements[0].player?.id;
      expect(players.find(candidate => candidate.id === winnerId)?.teamId).toBe(1);
    });
    expect(snapshot.candidates.heisman.every(candidate =>
      candidate.teamRankShare === 0.15)).toBe(true);
    expect(snapshot.candidates.davey_obrien.every(candidate =>
      candidate.teamRankShare === 0.10)).toBe(true);
  });

  it('ignores team prestige, rating, poll score, and award-window record when rank is fixed', () => {
    const players = [
      player(1, 'qb', { teamId: 1, rating: 80 }),
      player(2, 'qb', { teamId: 2, rating: 80 }),
    ];
    const games = Array.from({ length: 6 }, (_, index) => game(index + 1));
    const logs = games.flatMap(contest => players.map(candidate =>
      log(candidate.id, contest.id, quarterbackLine()),
    ));
    const baseline = buildAwardScoringSnapshot(league, players, games, logs);
    const changedLeague = structuredClone(league);
    changedLeague.teams[0].prestige = 1;
    changedLeague.teams[0].rating = 1;
    changedLeague.teams[0].poll_score = 0;
    changedLeague.teams[1].prestige = 7;
    changedLeague.teams[1].rating = 100;
    changedLeague.teams[1].poll_score = 100;
    const reversedResults = games.map(contest => ({ ...contest, winnerId: 2 }));
    const changed = buildAwardScoringSnapshot(changedLeague, players, reversedResults, logs);

    expect(changed.candidates.heisman.map(candidate => [candidate.playerId, candidate.finalScore]))
      .toEqual(baseline.candidates.heisman.map(candidate => [candidate.playerId, candidate.finalScore]));
    expect(changed.candidates.davey_obrien.map(candidate => [candidate.playerId, candidate.finalScore]))
      .toEqual(baseline.candidates.davey_obrien.map(candidate => [candidate.playerId, candidate.finalScore]));
  });

  it('scores Maxwell across every offensive cohort without the Heisman impact blend', () => {
    const players = [
      player(1, 'qb'),
      player(2, 'rb'),
      player(3, 'wr'),
      player(4, 'te'),
    ];
    const logs = [
      log(1, 1, quarterbackLine()),
      log(2, 1, { rush_attempts: 15, rush_yards: 100, rush_touchdowns: 1 }),
      log(3, 1, { receiving_catches: 5, receiving_yards: 90, receiving_touchdowns: 1 }),
      log(4, 1, { receiving_catches: 4, receiving_yards: 70, receiving_touchdowns: 1 }),
    ];
    const baseline = buildAwardScoringSnapshot(league, players, [game(1)], logs);
    const adjustedConfig = structuredClone(AWARD_SCORING_CONFIG);
    adjustedConfig.heismanOffensiveImpactShare = 0.70;
    const adjusted = buildAwardScoringSnapshot(
      league,
      players,
      [game(1)],
      logs,
      adjustedConfig,
    );
    const maxwell = baseline.candidates.maxwell;

    expect(new Set(maxwell.map(candidate => candidate.position)))
      .toEqual(new Set(['qb', 'rb', 'wr', 'te']));
    expect(adjusted.candidates.maxwell.map(candidate => candidate.coreScore))
      .toEqual(maxwell.map(candidate => candidate.coreScore));
    expect(adjusted.candidates.heisman.find(candidate => candidate.playerId === 3)?.preTeamRankCoreScore)
      .toBeLessThan(baseline.candidates.heisman.find(candidate => candidate.playerId === 3)!.preTeamRankCoreScore);
  });

  it('keeps a good 68-catch, 1,146-yard, 11-touchdown receiver below elite Heisman production', () => {
    const games = Array.from({ length: 13 }, (_, index) => game(index + 1));
    const receiver = player(1, 'wr', { teamId: 1, rating: 90 });
    const quarterback = player(2, 'qb', { teamId: 2, rating: 90 });
    const distribute = (total: number, index: number) =>
      Math.floor(total / games.length) + (index < total % games.length ? 1 : 0);
    const logs = games.flatMap((contest, index) => [
      log(receiver.id, contest.id, {
        receiving_catches: distribute(68, index),
        receiving_yards: distribute(1_146, index),
        receiving_touchdowns: distribute(11, index),
      }),
      log(quarterback.id, contest.id, quarterbackLine({
        pass_completions: 23,
        pass_attempts: 34,
        pass_yards: 320,
        pass_touchdowns: 3,
        pass_interceptions: 0,
        rush_yards: 30,
      })),
    ]);
    const snapshot = buildAwardScoringSnapshot(
      league,
      [receiver, quarterback],
      games,
      logs,
    );

    expect(snapshot.awards.live.find(award => award.categorySlug === 'heisman')
      ?.placements[0].player?.id).toBe(quarterback.id);
    expect(snapshot.awards.live.find(award => award.categorySlug === 'biletnikoff')
      ?.placements[0].player?.id).toBe(receiver.id);
    const receiverDiagnostic = snapshot.candidates.heisman.find(candidate =>
      candidate.playerId === receiver.id)!;
    expect(receiverDiagnostic.heismanOffensiveImpact).toBeCloseTo(13.8923, 3);
    expect(receiverDiagnostic.heismanOffensiveImpactPercentile).toBe(0);
    expect(receiverDiagnostic.heismanOffensiveImpactShare).toBe(0.50);
    expect(receiverDiagnostic.preTeamRankCoreScore).toBeCloseTo(
      receiverDiagnostic.performanceScore * 0.50
      + receiverDiagnostic.heismanOffensiveImpactPercentile! * 0.50,
      10,
    );
  });

  it('still lets a genuinely dominant receiver win the Heisman and Biletnikoff', () => {
    const games = Array.from({ length: 11 }, (_, index) => game(index + 1));
    const receiver = player(1, 'wr', { teamId: 2, rating: 90 });
    const quarterback = player(2, 'qb', { teamId: 1, rating: 90 });
    const distribute = (total: number, index: number) =>
      Math.floor(total / games.length) + (index < total % games.length ? 1 : 0);
    const logs = games.flatMap((contest, index) => [
      log(receiver.id, contest.id, {
        receiving_catches: distribute(105, index),
        receiving_yards: distribute(1_750, index),
        receiving_touchdowns: distribute(20, index),
      }),
      log(quarterback.id, contest.id, quarterbackLine({
        pass_completions: 21,
        pass_attempts: 32,
        pass_yards: 285,
        pass_touchdowns: 2,
        pass_interceptions: 0,
        rush_yards: 20,
      })),
    ]);
    const awards = buildAwards(league, [receiver, quarterback], games, logs).live;

    expect(entry(awards, 'heisman').placements[0].player?.id).toBe(receiver.id);
    expect(entry(awards, 'biletnikoff').placements[0].player?.id).toBe(receiver.id);
  });

  it('retains catches and receiving efficiency in position performance', () => {
    const players = [
      player(1, 'wr', { rating: 80 }),
      player(2, 'wr', { rating: 80 }),
    ];
    const snapshot = buildAwardScoringSnapshot(league, players, [game(1)], [
      log(1, 1, { receiving_catches: 8, receiving_yards: 120, receiving_touchdowns: 1 }),
      log(2, 1, { receiving_catches: 5, receiving_yards: 120, receiving_touchdowns: 1 }),
    ]);
    const [highCatch, efficient] = snapshot.candidates.heisman;

    expect(highCatch.playerId).toBe(1);
    expect(highCatch.heismanOffensiveImpact).toBe(efficient.heismanOffensiveImpact);
    expect(highCatch.performanceScore).toBeGreaterThan(efficient.performanceScore);
    expect(highCatch.components.find(component => component.key === 'catchesPerGame'))
      .toEqual(expect.objectContaining({ value: 8, weight: 0.20, percentile: 100 }));
    expect(efficient.components.find(component => component.key === 'yardsPerCatch'))
      .toEqual(expect.objectContaining({ value: 24, weight: 0.15, percentile: 100 }));
  });

  it('scores Mackey candidates in a TE-only percentile pool', () => {
    const tightEnds = [player(1, 'te'), player(2, 'te')];
    const wideReceiver = player(3, 'wr');
    const tightEndLogs = [
      log(1, 1, { receiving_catches: 6, receiving_yards: 100, receiving_touchdowns: 1 }),
      log(2, 1, { receiving_catches: 3, receiving_yards: 45 }),
    ];
    const withoutReceiver = buildAwardScoringSnapshot(
      league,
      tightEnds,
      [game(1)],
      tightEndLogs,
    ).candidates.mackey;
    const withReceiver = buildAwardScoringSnapshot(
      league,
      [...tightEnds, wideReceiver],
      [game(1)],
      [...tightEndLogs, log(3, 1, {
        receiving_catches: 12,
        receiving_yards: 250,
        receiving_touchdowns: 3,
      })],
    ).candidates.mackey;

    expect(withReceiver.map(candidate => candidate.playerId)).toEqual([1, 2]);
    expect(withReceiver.map(candidate => candidate.finalScore))
      .toEqual(withoutReceiver.map(candidate => candidate.finalScore));
  });

  it('reproduces the Nagurski core from performance and defensive impact', () => {
    const players = [player(1, 'dl'), player(2, 'lb'), player(3, 'cb')];
    const logs = [
      log(1, 1, { tackles: 4, sacks: 2 }),
      log(2, 1, { tackles: 10, interceptions: 1 }),
      log(3, 1, { tackles: 5, interceptions: 2, fumbles_forced: 1 }),
    ];
    const candidates = buildAwardScoringSnapshot(league, players, [game(1)], logs)
      .candidates.nagurski;

    candidates.forEach(candidate => {
      expect(candidate.preTeamRankCoreScore).toBeCloseTo(
        candidate.performanceScore * 0.70
        + candidate.primaryProductionPercentile * 0.30,
        10,
      );
    });
  });

  it('lets takeaway impact produce a different Nagurski and Bednarik winner', () => {
    const players = [
      player(1, 'dl'),
      player(2, 'dl'),
      player(3, 'cb'),
      player(4, 'cb'),
    ];
    const logs = [
      log(1, 1, { tackles: 10, sacks: 4 }),
      log(2, 1, { tackles: 1 }),
      log(3, 1, {
        tackles: 1,
        interceptions: 2,
        fumbles_forced: 1,
        fumbles_recovered: 1,
      }),
      log(4, 1, { tackles: 10, fumbles_forced: 1, fumbles_recovered: 1 }),
    ];
    const awards = buildAwards(league, players, [game(1)], logs).live;

    expect(entry(awards, 'bednarik').placements[0].player?.id).toBe(1);
    expect(entry(awards, 'nagurski').placements[0].player?.id).toBe(3);
  });

  it('allows one player to win multiple awards without changing final order', () => {
    const players = [player(1, 'qb'), player(2, 'dl')];
    const logs = [
      log(1, 1, quarterbackLine()),
      log(2, 1, { tackles: 6, sacks: 2, fumbles_forced: 1 }),
    ];
    const { live, final } = buildAwards(league, players, [game(1)], logs);

    expect(entry(live, 'heisman').placements[0].player?.id).toBe(1);
    expect(entry(live, 'davey_obrien').placements[0].player?.id).toBe(1);
    expect(entry(live, 'bednarik').placements[0].player?.id).toBe(2);
    expect(entry(live, 'ted_hendricks').placements[0].player?.id).toBe(2);
    expect(final).toEqual(live);
  });

  it('keeps scores bounded and resolves complete ties by player ID', () => {
    const players = [
      player(3, 'wr', { rating: 80 }),
      player(1, 'wr', { rating: 80 }),
      player(2, 'wr', { rating: 80 }),
    ];
    const logs = players.map(candidate => log(candidate.id, 1, {
      receiving_catches: 5,
      receiving_yards: 80,
      receiving_touchdowns: 1,
    }));
    const awards = buildAwards(league, players, [game(1)], logs).live;
    const biletnikoff = entry(awards, 'biletnikoff');

    expect(ids(biletnikoff)).toEqual([1, 2, 3]);
    awards.flatMap(award => award.placements).forEach(placement => {
      if (placement.score === null) return;
      expect(placement.score).toBeGreaterThanOrEqual(0);
      expect(placement.score).toBeLessThanOrEqual(100);
    });
  });

  it('exposes diagnostics that exactly reproduce production placements and scores', () => {
    const players = [
      player(1, 'qb', { rating: 92 }),
      player(2, 'qb', { rating: 82 }),
    ];
    const logs = [
      log(1, 1, quarterbackLine({ pass_yards: 340, pass_touchdowns: 4 })),
      log(2, 1, quarterbackLine({ pass_yards: 280, pass_touchdowns: 2 })),
    ];
    const snapshot = buildAwardScoringSnapshot(league, players, [game(1)], logs);
    const diagnostics = snapshot.candidates.davey_obrien;
    const display = entry(snapshot.awards.live, 'davey_obrien');

    expect(diagnostics).toHaveLength(2);
    expect(display.placements.slice(0, 2).map(placement => [placement.player?.id, placement.score]))
      .toEqual(diagnostics.map(candidate => [candidate.playerId, candidate.finalScore]));
    diagnostics.forEach(candidate => {
      expect(candidate.components.reduce((sum, component) => sum + component.contribution, 0))
        .toBeCloseTo(candidate.performanceScore, 10);
      expect(candidate.coreScore).toBeCloseTo(
        candidate.preTeamRankCoreScore * (1 - candidate.teamRankShare)
        + candidate.teamRankPercentile * candidate.teamRankShare,
        10,
      );
      expect(candidate.finalScore).toBeCloseTo(
        candidate.coreScore * (1 - candidate.ratingPriorShare)
        + candidate.ratingPercentile * candidate.ratingPriorShare,
        10,
      );
      expect(candidate.tiebreakers).toEqual({
        performanceScore: candidate.performanceScore,
        primaryProduction: candidate.primaryProduction,
        playerId: candidate.playerId,
      });
    });
  });

  it('uses exact national-rank percentile endpoints and singleton behavior', () => {
    expect(teamRankPercentile(1, 4)).toBe(100);
    expect(teamRankPercentile(4, 4)).toBe(0);
    expect(teamRankPercentile(2, 4)).toBeCloseTo(66.6666666667, 8);
    expect(teamRankPercentile(1, 1)).toBe(100);
  });

  it('freezes final awards to the post-conference-championship ranking snapshot', () => {
    const finalLeague = buildTestLeague('summary', {
      teams: teams.map((team, index) => ({ ...team, ranking: teams.length - index })),
    });
    finalLeague.resumeSnapshot = {
      year: finalLeague.info.currentYear,
      frozenAfterWeek: 15,
      playoff: {
        teams: finalLeague.settings.playoffTeams,
        autobids: finalLeague.settings.playoffAutobids,
        conferenceChampionsReceiveTopSeeds: finalLeague.settings.conferenceChampionsReceiveTopSeeds,
      },
      teams: teams.map(team => ({
        teamId: team.id,
        name: team.name,
        ranking: team.ranking,
        conference: team.conference,
        record: team.record,
        resumeScoreRank: team.ranking,
        performanceIndexRank: team.ranking,
        top25Record: '0-0',
        bestWin: null,
        worstLoss: null,
        seed: null,
        isAutobid: false,
        hasBye: false,
        isChampion: false,
      })),
    };
    const players = [
      player(1, 'qb', { teamId: 1, rating: 80 }),
      player(2, 'qb', { teamId: 2, rating: 80 }),
    ];
    const logs = players.map(candidate => log(candidate.id, 1, quarterbackLine()));
    const before = buildAwards(finalLeague, players, [game(1)], logs).final;
    finalLeague.teams[0].ranking = 4;
    finalLeague.teams[1].ranking = 1;
    const titleGame = game(2, 'national_championship', { winnerId: 2 });
    const after = buildAwards(
      finalLeague,
      players,
      [game(1), titleGame],
      [...logs, log(2, 2, quarterbackLine({ pass_yards: 900, pass_touchdowns: 9 }))],
    ).final;

    expect(entry(before, 'davey_obrien').placements[0].player?.id).toBe(1);
    expect(after).toEqual(before);
  });

  it('rejects final awards without the frozen post-conference-championship rankings', () => {
    expect(() => buildAwards(buildTestLeague('summary', { teams, resumeSnapshot: null }), [], [], []))
      .toThrow('Final awards require post-conference-championship rankings');
  });
});
