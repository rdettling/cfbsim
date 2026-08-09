import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import type { GameDetailRecord, GameRecord } from '../../types/db';
import { extractGameStoryFacts, type FeaturedPerformance } from './facts';
import {
  generateGameNews,
} from './generate';
import { sortNewsItems } from './ordering';
import { scoreGameNewsworthiness } from './newsworthiness';

const teamA = buildTestTeam({ id: 1, name: 'Test State', ranking: 0 });
const teamB = buildTestTeam({ id: 2, name: 'Other State', ranking: 0 });

const game = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 10,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId: 1,
  baseLabel: 'Test State vs Other State',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 6,
  year: 2025,
  rankATOG: 0,
  rankBTOG: 0,
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  scoreA: 21,
  scoreB: 14,
  watchability: 50,
  ...overrides,
});

const stats = (
  playerId: number,
  overrides: Partial<GameDetailRecord['playerStats'][number]> = {},
): GameDetailRecord['playerStats'][number] => ({
  playerId,
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

const scoringDrive = ({
  driveNum,
  offenseId,
  scoreA,
  scoreB,
  quarter,
  secondsLeft,
}: {
  driveNum: number;
  offenseId: number;
  scoreA: number;
  scoreB: number;
  quarter: number;
  secondsLeft: number;
}): GameDetailRecord['drives'][number] => ({
  driveNum,
  offenseId,
  defenseId: offenseId === 1 ? 2 : 1,
  startingFP: 25,
  result: 'touchdown',
  points: 7,
  points_needed: 0,
  scoreAAfter: scoreA,
  scoreBAfter: scoreB,
  plays: [{
    startingFP: 75,
    down: 1,
    yardsLeft: 0,
    playType: 'run',
    yardsGained: 25,
    result: 'touchdown',
    text: 'Touchdown',
    header: '1st & 10',
    scoreA: scoreA - (offenseId === 1 ? 7 : 0),
    scoreB: scoreB - (offenseId === 2 ? 7 : 0),
    quarter,
    clockSecondsLeft: secondsLeft + 5,
    playSeconds: 5,
  }],
});

const comebackDetail = (): GameDetailRecord => ({
  gameId: 10,
  year: 2025,
  drives: [
    scoringDrive({ driveNum: 1, offenseId: 2, scoreA: 0, scoreB: 7, quarter: 1, secondsLeft: 500 }),
    scoringDrive({ driveNum: 2, offenseId: 2, scoreA: 0, scoreB: 14, quarter: 2, secondsLeft: 300 }),
    scoringDrive({ driveNum: 3, offenseId: 1, scoreA: 7, scoreB: 14, quarter: 3, secondsLeft: 200 }),
    scoringDrive({ driveNum: 4, offenseId: 1, scoreA: 14, scoreB: 14, quarter: 4, secondsLeft: 300 }),
    scoringDrive({ driveNum: 5, offenseId: 1, scoreA: 21, scoreB: 14, quarter: 4, secondsLeft: 95 }),
  ],
  playerStats: [],
});

const factsFor = (
  record: GameRecord,
  detail: GameDetailRecord,
  players = [buildTestPlayer({ id: 1, teamId: 1 })],
  games: GameRecord[] = [],
) => extractGameStoryFacts({
  game: record,
  detail,
  teamsById: new Map([[1, teamA], [2, teamB]]),
  playersById: new Map(players.map(player => [player.id, player])),
  games,
});

describe('league news game facts', () => {
  it('proves a 14-point fourth-quarter comeback and late winning score', () => {
    const facts = factsFor(game(), comebackDetail());
    expect(facts).toMatchObject({
      largestWinnerDeficit: 14,
      fourthQuarterComeback: true,
      leadChanges: 1,
      turnoversForcedByWinner: 0,
    });
    expect(facts.lateWinningScore).toMatchObject({ quarter: 4, secondsLeft: 95 });
    const { item: story } = generateGameNews(facts);
    expect(story.primaryAngle).toBe('comeback');
    expect(story.headline).toContain('14');
    expect(story.deck).toContain('1:35');
  });

  it('does not misclassify overtime scoring as a late regulation winner', () => {
    const record = game({ overtime: 2, scoreA: 28, scoreB: 21 });
    const detail = comebackDetail();
    const facts = factsFor(record, detail);
    expect(facts.lateWinningScore).toBeNull();
    expect(facts.fourthQuarterComeback).toBe(false);
    const { item: story } = generateGameNews(facts);
    expect(story.primaryAngle).toBe('overtime');
    expect(`${story.headline} ${story.deck}`).toContain('double overtime');
  });

  it.each([
    ['qb', 'pass_yards', 350],
    ['qb', 'pass_touchdowns', 4],
    ['rb', 'rush_yards', 175],
    ['rb', 'rush_touchdowns', 3],
    ['wr', 'receiving_yards', 175],
    ['wr', 'receiving_touchdowns', 3],
    ['lb', 'tackles', 15],
    ['dl', 'sacks', 3],
    ['cb', 'interceptions', 2],
    ['k', 'field_goals_made', 4],
  ] as const)('enforces the exceptional %s %s threshold at %i', (pos, field, threshold) => {
    const player = buildTestPlayer({ id: 7, teamId: 1, pos });
    const detail = (value: number): GameDetailRecord => ({
      gameId: 10,
      year: 2025,
      drives: [],
      playerStats: [stats(7, { [field]: value })],
    });
    expect(factsFor(game(), detail(threshold - 1), [player]).featuredPerformance).toBeNull();
    expect(factsFor(game(), detail(threshold), [player]).featuredPerformance).toMatchObject({
      playerId: 7,
      position: pos,
    });
    expect(factsFor(game(), detail(threshold + 1), [player]).featuredPerformance?.playerId).toBe(7);
  });

  it('renders singular defensive statistics grammatically', () => {
    const player = buildTestPlayer({ id: 7, teamId: 1, pos: 'cb' });
    const detail: GameDetailRecord = {
      gameId: 10,
      year: 2025,
      drives: [],
      playerStats: [stats(7, { tackles: 1, interceptions: 2 })],
    };
    expect(factsFor(game(), detail, [player]).featuredPerformance?.summary)
      .toBe('1 tackle, 2 interceptions');
  });

  it('counts turnovers and recognizes a shutout without inventing chronology', () => {
    const detail: GameDetailRecord = {
      gameId: 10,
      year: 2025,
      drives: [
        { ...scoringDrive({ driveNum: 1, offenseId: 2, scoreA: 0, scoreB: 0, quarter: 1, secondsLeft: 500 }), result: 'interception', points: 0, plays: [] },
        { ...scoringDrive({ driveNum: 2, offenseId: 2, scoreA: 0, scoreB: 0, quarter: 2, secondsLeft: 400 }), result: 'fumble', points: 0, plays: [] },
        { ...scoringDrive({ driveNum: 3, offenseId: 2, scoreA: 0, scoreB: 0, quarter: 3, secondsLeft: 300 }), result: 'interception', points: 0, plays: [] },
      ],
      playerStats: [],
    };
    const facts = factsFor(game({ scoreA: 24, scoreB: 0 }), detail);
    expect(facts).toMatchObject({
      turnoversForcedByWinner: 3,
      shutout: true,
      defensiveDominance: true,
      lateWinningScore: null,
    });
  });
});

describe('league news editorial selection', () => {
  it('preserves copy while exposing a complete non-persisted editorial trace', () => {
    const generated = generateGameNews(factsFor(
      game(),
      { gameId: 10, year: 2025, drives: [], playerStats: [] },
    ));
    expect(generated.item).toMatchObject({ primaryAngle: 'routine_result', importance: 10 });
    expect(generated.item.headline).toContain('Test State');
    expect(generated.item.headline).toContain('Other State');
    expect(`${generated.item.headline} ${generated.item.deck}`).toContain('21-14');
    expect(generated.trace).toMatchObject({
      templateVersion: 'v3',
      primaryAngle: 'routine_result',
      templateId: expect.stringMatching(/^routine\.v3\./),
      deckRuleId: 'result',
      deckTemplateId: expect.stringMatching(/^result\.v3\./),
      scoreLocation: 'both',
      tokens: { winner: 'Test State', loser: 'Other State', score: '21-14' },
      newsworthiness: {
        total: 10,
        components: [{ id: 'base:regular_season', points: 10 }],
      },
    });
    expect(generated.trace.facts).toMatchObject({
      margin: 7,
      overtime: 0,
      winnerRank: 0,
      loserRank: 0,
      winnerEditorialRank: null,
      loserEditorialRank: null,
      upsetEvidence: null,
    });
  });

  it('combines championship consequence with verified overtime context', () => {
    const { item: story } = generateGameNews(factsFor(
      game({ gameType: 'national_championship', name: 'National Championship', overtime: 2, scoreA: 28, scoreB: 21 }),
      { gameId: 10, year: 2025, drives: [], playerStats: [] },
    ));
    expect(story.primaryAngle).toBe('championship');
    expect(story.storylines).toContain('overtime');
    expect(story.headline).toContain('double overtime');
  });

  it('uses decks to add the strongest unused fact before reinforcing the headline', () => {
    const combined = generateGameNews(factsFor(game(), comebackDetail()));
    expect(combined.trace.headlineFacts).toContain('comeback');
    expect(combined.trace.deckRuleId).toBe('late_winning_score');
    expect(combined.trace.deckFacts).toEqual(['late_decider']);

    const oddsOnly = generateGameNews(factsFor(
      game({ winProbA: 0.1 }),
      { gameId: 10, year: 2025, drives: [], playerStats: [] },
    ));
    expect(oddsOnly.trace.headlineFacts).toContain('odds_upset');
    expect(oddsOnly.trace.deckRuleId).toBe('major_upset_probability');
  });

  it('places the final score in the deck whenever a headline omits it', () => {
    const detail = { gameId: 10, year: 2025, drives: [], playerStats: [] } satisfies GameDetailRecord;
    const generated = Array.from({ length: 30 }, (_, index) => {
      const record = game({ id: index + 1, winProbA: 0.1 });
      return generateGameNews(factsFor(record, { ...detail, gameId: record.id }));
    });
    const deckOnly = generated.find(story => story.trace.scoreLocation === 'deck');
    expect(deckOnly).toBeDefined();
    expect(deckOnly!.item.headline).not.toContain('21-14');
    expect(deckOnly!.item.deck).toContain('21-14');
  });

  it('describes a ranked favorite accurately when the loser is unranked', () => {
    const { item: story } = generateGameNews(factsFor(
      game({ rankATOG: 5, rankBTOG: 0, winProbA: 0.75 }),
      { gameId: 10, year: 2025, drives: [], playerStats: [] },
    ));
    expect(story.primaryAngle).toBe('ranked_result');
    expect(story.headline).toContain('No. 5 Test State');
    expect(story.headline).not.toContain('ranked Other State');
    expect(story.headline).not.toContain('knocks off');
  });

  it('uses top-25 identity and separates ranking upsets from betting upsets', () => {
    const detail = { gameId: 10, year: 2025, drives: [], playerStats: [] } satisfies GameDetailRecord;
    const rankingOnly = factsFor(
      game({ rankATOG: 26, rankBTOG: 12, winProbA: 0.7 }),
      detail,
    );
    expect(rankingOnly).toMatchObject({
      winnerEditorialRank: null,
      loserEditorialRank: 12,
      upsetEvidence: 'ranking',
    });
    const rankingStory = generateGameNews(rankingOnly);
    expect(rankingStory.item.headline).not.toContain('No. 26');
    expect(rankingStory.item.deck).toMatch(/poll|ranking/);
    expect(rankingStory.item.deck).not.toContain('pregame expectations');
    expect(rankingStory.trace.newsworthiness).toMatchObject({
      total: 36,
      dimensions: { consequence: 10, national_relevance: 6, drama: 20 },
      components: expect.arrayContaining([
        expect.objectContaining({ id: 'ranking_upset', points: 20 }),
      ]),
    });
    expect(rankingStory.trace.newsworthiness.components)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'major_underdog_win' })]));

    expect(factsFor(game({ rankATOG: 25, rankBTOG: 15 }), detail).upsetEvidence).toBe('ranking');
    expect(factsFor(game({ rankATOG: 24, rankBTOG: 15 }), detail).upsetEvidence).toBeNull();
    expect(factsFor(game({ rankATOG: 26, rankBTOG: 27 }), detail)).toMatchObject({
      winnerEditorialRank: null,
      loserEditorialRank: null,
      upsetEvidence: null,
    });

    const oddsOnly = factsFor(game({ rankATOG: 26, rankBTOG: 27, winProbA: 0.14 }), detail);
    expect(oddsOnly.upsetEvidence).toBe('odds');
    const oddsStory = generateGameNews(oddsOnly);
    expect(oddsStory.item.deck).toContain('14%');
    expect(oddsStory.trace.newsworthiness).toMatchObject({
      total: 35,
      components: expect.arrayContaining([
        expect.objectContaining({ id: 'major_underdog_win', points: 25 }),
      ]),
    });
    expect(oddsStory.trace.newsworthiness.components)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'ranking_upset' })]));
  });

  it('keeps postseason consequence ahead of conflicting game contexts', () => {
    const detail = { gameId: 10, year: 2025, drives: [], playerStats: [] } satisfies GameDetailRecord;
    const bowl = generateGameNews(factsFor(
      game({ gameType: 'bowl', name: 'Citrus Bowl', overtime: 2 }),
      detail,
    )).item;
    expect(bowl.primaryAngle).toBe('bowl_result');
    expect(bowl.storylines).toContain('overtime');
    expect(bowl.headline).toContain('Citrus Bowl');
  });

  it('uses the complete regular-season editorial hierarchy', () => {
    const base = factsFor(
      game({ rankATOG: 8, rankBTOG: 0 }),
      { gameId: 10, year: 2025, drives: [], playerStats: [] },
    );
    const late = {
      driveNum: 9,
      teamId: 1,
      points: 7,
      quarter: 4,
      secondsLeft: 45,
      scoreA: 21,
      scoreB: 14,
      leadTaking: true,
    };
    const feature = {
      playerId: 7,
      teamId: 1,
      playerName: 'Alex Star',
      position: 'qb',
      summary: '401 passing yards and 4 passing touchdowns',
      score: 681,
      qualifyingFacts: ['passing_yards_350', 'passing_touchdowns_4'],
    } satisfies FeaturedPerformance;
    const angle = (overrides: Partial<typeof base>) =>
      generateGameNews({ ...base, ...overrides }).item.primaryAngle;

    expect(angle({
      upsetEvidence: 'odds',
      winnerWinProbability: 0.1,
      fourthQuarterComeback: true,
      lateWinningScore: late,
    })).toBe('upset');
    expect(angle({ fourthQuarterComeback: true, lateWinningScore: late })).toBe('comeback');
    expect(angle({ lateWinningScore: late, game: { ...base.game, overtime: 1 } })).toBe('late_decider');
    expect(angle({ game: { ...base.game, overtime: 1, rivalryKey: 'rivalry' } })).toBe('overtime');
    expect(angle({ game: { ...base.game, rivalryKey: 'rivalry' }, defensiveDominance: true })).toBe('rivalry');
    expect(angle({ defensiveDominance: true, margin: 28, featuredPerformance: feature })).toBe('defensive_dominance');
    expect(angle({ margin: 28, featuredPerformance: feature })).toBe('blowout');
    expect(angle({ featuredPerformance: feature })).toBe('standout_player');
    expect(angle({})).toBe('ranked_result');
  });

  it('is deterministic while allowing seeded variants between games', () => {
    const detail = { gameId: 10, year: 2025, drives: [], playerStats: [] } satisfies GameDetailRecord;
    const first = generateGameNews(factsFor(game(), detail));
    expect(generateGameNews(factsFor(game(), detail))).toEqual(first);
    const variants = new Set(
      Array.from({ length: 20 }, (_, index) => {
        const record = game({ id: index + 1 });
        return generateGameNews(factsFor(record, { ...detail, gameId: record.id })).item.headline;
      }),
    );
    expect(variants.size).toBeGreaterThan(1);
  });

  it('produces the same copy regardless of generation order', () => {
    const detail = { gameId: 10, year: 2025, drives: [], playerStats: [] } satisfies GameDetailRecord;
    const records = [game({ id: 21 }), game({ id: 22, winProbA: 0.1 })];
    const generate = (record: GameRecord) => generateGameNews(factsFor(
      record,
      { ...detail, gameId: record.id },
    ));
    const forward = records.map(generate);
    const reverse = [...records].reverse().map(generate).reverse();
    expect(reverse).toEqual(forward);
  });

  it('uses the fixed importance table and national tie-breaker', () => {
    const facts = factsFor(game({ winProbA: 0.1 }), comebackDetail());
    expect(scoreGameNewsworthiness(facts)).toMatchObject({
      total: 59,
      dimensions: { consequence: 10, national_relevance: 0, drama: 49 },
    });
    expect(sortNewsItems([
      { id: 'game:1', type: 'game' as const, importance: 20, gameId: 1 },
      { id: 'game:2', type: 'game' as const, importance: 20, gameId: 2 },
      { id: 'game:3', type: 'game' as const, importance: 30, gameId: 3 },
    ])).toEqual([
      { id: 'game:3', type: 'game', importance: 30, gameId: 3 },
      { id: 'game:2', type: 'game', importance: 20, gameId: 2 },
      { id: 'game:1', type: 'game', importance: 20, gameId: 1 },
    ]);
  });
});
