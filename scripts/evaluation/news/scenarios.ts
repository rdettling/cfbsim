import type { GameRecord, PlayerRecord } from '../../../src/types/db';
import type { Team } from '../../../src/types/domain';
import type { NewsAuditEntry } from './audit';
import type { GameStoryFacts, ScoringEvent } from '../../../src/domain/news/facts';
import { generateGameNews } from '../../../src/domain/news/generate';
import {
  deriveEditorialIdentity,
  type FeaturedPerformanceQualifier,
} from '../../../src/domain/news/policy';

const baseScenarioFacts = (
  game: GameRecord,
  winner: Team,
  loser: Team,
): GameStoryFacts => ({
  game,
  winner,
  loser,
  winnerScore: 24,
  loserScore: 17,
  margin: 7,
  winnerRank: 0,
  loserRank: 0,
  winnerEditorialRank: null,
  loserEditorialRank: null,
  winnerWinProbability: 0.65,
  upsetEvidence: null,
  scoringEvents: [],
  leadChanges: 0,
  largestWinnerDeficit: 0,
  fourthQuarterComeback: false,
  lateWinningScore: null,
  turnoversForcedByWinner: 0,
  turnoversCommittedByWinner: 0,
  shutout: false,
  defensiveDominance: false,
  featuredPerformance: null,
  priorMeetings: 0,
  winnerSeriesStreak: 1,
  revenge: false,
  postseasonRematch: false,
});

export const buildNewsAuditScenarioEntries = (
  teams: Team[],
  players: PlayerRecord[],
  rootSeed: number,
) => {
  const winner = teams[0];
  const loser = teams[1];
  const positions = ['qb', 'rb', 'wr', 'te', 'dl', 'lb', 'cb', 's', 'k'];
  let nextId = 9_000_000;
  const make = (
    label: string,
    overrides: Partial<GameStoryFacts>,
    gameOverrides: Partial<GameRecord> = {},
    featuredPosition: string | null = null,
  ): NewsAuditEntry => {
    const game: GameRecord = {
      id: nextId++,
      teamAId: winner.id,
      teamBId: loser.id,
      homeTeamId: winner.id,
      awayTeamId: loser.id,
      neutralSite: false,
      venue: winner.stadium,
      winnerId: winner.id,
      baseLabel: `${winner.name} vs ${loser.name}`,
      name: null,
      gameType: 'regular_season',
      rivalryKey: null,
      spreadA: '-3',
      spreadB: '+3',
      moneylineA: '-150',
      moneylineB: '+130',
      winProbA: 0.65,
      winProbB: 0.35,
      weekPlayed: 1,
      year: 2026,
      rankATOG: 0,
      rankBTOG: 0,
      resultA: 'W',
      resultB: 'L',
      overtime: 0,
      quarter: 4,
      clockSecondsLeft: 0,
      scoreA: 24,
      scoreB: 17,
      watchability: 50,
      ...gameOverrides,
    };
    game.rankATOG = overrides.winnerRank ?? game.rankATOG;
    game.rankBTOG = overrides.loserRank ?? game.rankBTOG;
    game.winProbA = overrides.winnerWinProbability ?? game.winProbA;
    game.winProbB = 1 - game.winProbA;
    const draft = { ...baseScenarioFacts(game, winner, loser), ...overrides, game };
    const identity = deriveEditorialIdentity({
      winnerRank: draft.winnerRank,
      loserRank: draft.loserRank,
      winnerWinProbability: draft.winnerWinProbability,
    });
    const facts: GameStoryFacts = { ...draft, ...identity };
    const generated = generateGameNews(facts);
    return {
      ...generated,
      auditId: `scenario:${label}`,
      source: 'scenario',
      rootSeed,
      sample: 0,
      season: 0,
      winnerName: winner.name,
      loserName: loser.name,
      winnerConference: winner.conference,
      loserConference: loser.conference,
      featuredPosition,
    };
  };
  const lateEvent: ScoringEvent = {
    driveNum: 10,
    teamId: winner.id,
    points: 7,
    quarter: 4,
    secondsLeft: 42,
    scoreA: 24,
    scoreB: 17,
    leadTaking: true,
  };
  const featuredPlayer = (position: string) =>
    players.find(player => player.teamId === winner.id && player.pos === position)!;
  const entries = [
    make('championship', {}, { gameType: 'national_championship', name: 'National Championship' }),
    make('playoff_advance', {}, { gameType: 'playoff_quarterfinal', name: 'Rose Bowl' }),
    make('bowl_result', {}, { gameType: 'bowl', name: 'Citrus Bowl' }),
    make('upset', { winnerWinProbability: 0.1, winnerRank: 22, loserRank: 3 }),
    make('comeback', { largestWinnerDeficit: 14, fourthQuarterComeback: true }),
    make('late_decider', { lateWinningScore: lateEvent, leadChanges: 2 }),
    make('overtime', {}, { overtime: 2 }),
    make('rivalry', {}, { rivalryKey: 'audit-rivalry', name: 'Audit Rivalry' }),
    make('defensive_dominance', { winnerScore: 24, loserScore: 0, margin: 24, shutout: true, defensiveDominance: true }, { scoreA: 24, scoreB: 0 }),
    make('blowout', { winnerScore: 42, loserScore: 10, margin: 32 }, { scoreA: 42, scoreB: 10 }),
    make('ranked_result', { winnerRank: 8, loserRank: 0 }),
    make('routine_result', {}),
    make('odds_only_upset', { winnerWinProbability: 0.1, winnerRank: 26, loserRank: 27 }),
    make('ranking_only_upset', { winnerWinProbability: 0.65, winnerRank: 26, loserRank: 12 }),
    make('combined_upset', { winnerWinProbability: 0.1, winnerRank: 25, loserRank: 5 }),
    make('rank_25_identity', { winnerRank: 25, loserRank: 26 }),
    make('rank_26_boundary', { winnerRank: 26, loserRank: 27 }),
    make('overtime_championship_upset', { winnerWinProbability: 0.1 }, { gameType: 'national_championship', name: 'National Championship', overtime: 1 }),
    make('bowl_upset', { winnerWinProbability: 0.1 }, { gameType: 'bowl', name: 'Fiesta Bowl' }),
    make('bowl_comeback', { largestWinnerDeficit: 14, fourthQuarterComeback: true }, { gameType: 'bowl', name: 'Cotton Bowl' }),
    make('bowl_late', { lateWinningScore: lateEvent }, { gameType: 'bowl', name: 'Peach Bowl' }),
    make('bowl_overtime', {}, { gameType: 'bowl', name: 'Sugar Bowl', overtime: 2 }),
    make('bowl_rivalry', {}, { gameType: 'bowl', name: 'Holiday Bowl', rivalryKey: 'audit-rivalry' }),
    make('bowl_defense', { winnerScore: 24, loserScore: 0, margin: 24, shutout: true, defensiveDominance: true }, { gameType: 'bowl', name: 'Orange Bowl', scoreA: 24, scoreB: 0 }),
    make('bowl_blowout', { winnerScore: 42, loserScore: 10, margin: 32 }, { gameType: 'bowl', name: 'Citrus Bowl', scoreA: 42, scoreB: 10 }),
    make('rivalry_comeback', { largestWinnerDeficit: 10, fourthQuarterComeback: true }, { rivalryKey: 'audit-rivalry', name: 'Audit Rivalry' }),
    make('late_rivalry', { lateWinningScore: lateEvent }, { rivalryKey: 'audit-rivalry', name: 'Audit Rivalry' }),
    make('revenge', { revenge: true, priorMeetings: 1 }),
    make('rivalry_streak', { priorMeetings: 3, winnerSeriesStreak: 4 }, { rivalryKey: 'audit-rivalry', name: 'Audit Rivalry' }),
  ];
  positions.forEach(position => {
    const player = featuredPlayer(position);
    const qualifier: FeaturedPerformanceQualifier = position === 'qb'
      ? 'passing_yards_350'
      : position === 'rb'
        ? 'rushing_yards_175'
        : position === 'wr' || position === 'te'
          ? 'receiving_yards_175'
          : position === 'k'
            ? 'field_goals_made_4'
            : 'interceptions_2';
    entries.push(make(`standout_${position}`, {
      featuredPerformance: {
        playerId: player.id,
        teamId: winner.id,
        playerName: `${player.first} ${player.last}`,
        position,
        summary: position === 'k' ? '4 made field goals' : 'a qualifying audit performance',
        score: 300,
        qualifyingFacts: [qualifier],
      },
    }, {}, position));
    if (position === 'qb') {
      entries.push(make('bowl_player', {
        featuredPerformance: {
          playerId: player.id,
          teamId: winner.id,
          playerName: `${player.first} ${player.last}`,
          position,
          summary: '401 passing yards and 4 passing touchdowns',
          score: 681,
          qualifyingFacts: ['passing_yards_350', 'passing_touchdowns_4'],
        },
      }, { gameType: 'bowl', name: 'Alamo Bowl' }, position));
    }
  });
  const thresholdScenarios = [
    ['pass_touchdowns', 'qb', '4 passing touchdowns', 'passing_touchdowns_4'],
    ['rush_touchdowns', 'rb', '3 rushing touchdowns', 'rushing_touchdowns_3'],
    ['receiving_touchdowns', 'wr', '3 receiving touchdowns', 'receiving_touchdowns_3'],
    ['tackles', 'lb', '15 tackles', 'tackles_15'],
    ['sacks', 'dl', '3 sacks', 'sacks_3'],
  ] as const;
  thresholdScenarios.forEach(([label, position, summary, qualifier]) => {
    const player = featuredPlayer(position);
    entries.push(make(`standout_${label}_threshold`, {
      featuredPerformance: {
        playerId: player.id,
        teamId: winner.id,
        playerName: `${player.first} ${player.last}`,
        position,
        summary,
        score: 300,
        qualifyingFacts: [qualifier],
      },
    }, {}, position));
  });
  return entries;
};
