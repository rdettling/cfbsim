import type { GameNewsItem, GameStoryAngle, GameType } from '../../types/news';
import { createSeededRandom } from '../utils/random';
import { formatGameClock, type GameStoryFacts } from './facts';
import {
  chooseStoryTemplate,
  renderStoryTemplate,
  STORY_TEMPLATES,
  type EditorialFactId,
  type StoryTokens,
} from './templates';
import {
  chooseDeckTemplate,
  deckRuleFact,
  renderDeckTemplate,
  type DeckRuleId,
} from './deckTemplates';
import {
  hasEditorialUpset,
  hasOddsUpset,
  hasRankingUpset,
} from './policy';
import {
  scoreGameNewsworthiness,
  type NewsworthinessBreakdown,
} from './newsworthiness';

export const NEWS_TEMPLATE_VERSION = 'v3';

export interface GameNewsEditorialFacts {
  gameType: GameType;
  rivalryKey: string | null;
  winnerId: number;
  loserId: number;
  winnerScore: number;
  loserScore: number;
  margin: number;
  winnerRank: number;
  loserRank: number;
  winnerEditorialRank: number | null;
  loserEditorialRank: number | null;
  winnerWinProbability: number;
  upsetEvidence: GameStoryFacts['upsetEvidence'];
  overtime: number;
  leadChanges: number;
  largestWinnerDeficit: number;
  fourthQuarterComeback: boolean;
  lateWinningSecondsLeft: number | null;
  turnoversForcedByWinner: number;
  turnoversCommittedByWinner: number;
  shutout: boolean;
  defensiveDominance: boolean;
  featuredPerformance: GameStoryFacts['featuredPerformance'];
  priorMeetings: number;
  winnerSeriesStreak: number;
  revenge: boolean;
  postseasonRematch: boolean;
}

export interface GameNewsEditorialTrace {
  templateVersion: typeof NEWS_TEMPLATE_VERSION;
  facts: GameNewsEditorialFacts;
  candidateStorylines: GameStoryAngle[];
  primaryAngle: GameStoryAngle;
  templateId: string;
  deckRuleId: DeckRuleId;
  deckTemplateId: string;
  headlineSyntaxFamily: import('./templates').CopySyntaxFamily;
  deckSyntaxFamily: import('./templates').CopySyntaxFamily;
  headlineFacts: readonly EditorialFactId[];
  deckFacts: readonly EditorialFactId[];
  scoreLocation: 'headline' | 'deck' | 'both';
  tokens: StoryTokens;
  newsworthiness: NewsworthinessBreakdown;
}

export interface GeneratedGameNews {
  item: GameNewsItem;
  trace: GameNewsEditorialTrace;
}

const PLAYOFF_TYPES = new Set<GameType>([
  'playoff_first_round',
  'playoff_quarterfinal',
  'playoff_semifinal',
]);

const rankedName = (name: string, rank: number | null) => rank !== null ? `No. ${rank} ${name}` : name;

const overtimeLabel = (count: number) => {
  if (count <= 1) return 'overtime';
  if (count === 2) return 'double overtime';
  return `${count}OT`;
};

export const detectStorylines = (facts: GameStoryFacts): GameStoryAngle[] => {
  const lines: GameStoryAngle[] = [];
  if (
    facts.game.gameType === 'national_championship' ||
    facts.game.gameType === 'conference_championship'
  ) lines.push('championship');
  if (PLAYOFF_TYPES.has(facts.game.gameType)) lines.push('playoff_advance');
  if (facts.game.gameType === 'bowl') lines.push('bowl_result');
  if (hasEditorialUpset(facts.upsetEvidence)) lines.push('upset');
  if (facts.fourthQuarterComeback) lines.push('comeback');
  if (facts.lateWinningScore) lines.push('late_decider');
  if (facts.game.overtime > 0) lines.push('overtime');
  if (facts.game.rivalryKey) lines.push('rivalry');
  if (facts.featuredPerformance) lines.push('standout_player');
  if (facts.defensiveDominance) lines.push('defensive_dominance');
  if (facts.margin >= 21) lines.push('blowout');
  if (facts.winnerEditorialRank !== null || facts.loserEditorialRank !== null) lines.push('ranked_result');
  if (!lines.length) lines.push('routine_result');
  return lines;
};

const primaryAngle = (facts: GameStoryFacts): GameStoryAngle => {
  if (
    facts.game.gameType === 'national_championship' ||
    facts.game.gameType === 'conference_championship'
  ) return 'championship';
  if (PLAYOFF_TYPES.has(facts.game.gameType)) return 'playoff_advance';
  if (facts.game.gameType === 'bowl') return 'bowl_result';
  if (hasEditorialUpset(facts.upsetEvidence)) return 'upset';
  if (facts.fourthQuarterComeback) return 'comeback';
  if (facts.lateWinningScore) return 'late_decider';
  if (facts.game.overtime > 0) return 'overtime';
  if (facts.game.rivalryKey) return 'rivalry';
  if (facts.defensiveDominance) return 'defensive_dominance';
  if (facts.margin >= 21) return 'blowout';
  if (facts.featuredPerformance) return 'standout_player';
  if (facts.winnerEditorialRank !== null || facts.loserEditorialRank !== null) return 'ranked_result';
  return 'routine_result';
};

const headlinePool = (facts: GameStoryFacts, angle: GameStoryAngle) => {
  if (angle === 'championship') {
    if (hasEditorialUpset(facts.upsetEvidence)) return facts.upsetEvidence === 'ranking'
      ? STORY_TEMPLATES.titleRankingUpset
      : facts.game.gameType === 'national_championship'
        ? STORY_TEMPLATES.nationalChampionshipUpset
        : STORY_TEMPLATES.titleUpset;
    if (facts.fourthQuarterComeback) return STORY_TEMPLATES.titleComeback;
    if (facts.lateWinningScore) return STORY_TEMPLATES.titleLate;
    if (facts.game.overtime) return facts.game.gameType === 'national_championship'
      ? STORY_TEMPLATES.nationalChampionshipOvertime
      : STORY_TEMPLATES.titleOvertime;
    if (facts.game.rivalryKey) return STORY_TEMPLATES.titleRivalry;
    if (facts.defensiveDominance) return STORY_TEMPLATES.titleDefense;
    if (facts.margin >= 21) return STORY_TEMPLATES.titleBlowout;
    if (facts.featuredPerformance) return STORY_TEMPLATES.titlePlayer;
    return facts.game.gameType === 'national_championship'
      ? STORY_TEMPLATES.nationalChampionship
      : STORY_TEMPLATES.conferenceChampionship;
  }
  if (angle === 'playoff_advance') {
    if (hasEditorialUpset(facts.upsetEvidence)) return facts.upsetEvidence === 'ranking'
      ? STORY_TEMPLATES.playoffRankingUpset
      : STORY_TEMPLATES.playoffUpset;
    if (facts.fourthQuarterComeback) return STORY_TEMPLATES.playoffComeback;
    if (facts.lateWinningScore) return STORY_TEMPLATES.playoffLate;
    if (facts.game.overtime) return STORY_TEMPLATES.playoffOvertime;
    if (facts.game.rivalryKey) return STORY_TEMPLATES.playoffRivalry;
    if (facts.defensiveDominance) return STORY_TEMPLATES.playoffDefense;
    if (facts.margin >= 21) return STORY_TEMPLATES.playoffBlowout;
    if (facts.featuredPerformance) return STORY_TEMPLATES.playoffPlayer;
    return STORY_TEMPLATES.playoff;
  }
  if (angle === 'bowl_result') {
    if (hasEditorialUpset(facts.upsetEvidence)) return facts.upsetEvidence === 'ranking'
      ? STORY_TEMPLATES.bowlRankingUpset
      : STORY_TEMPLATES.bowlUpset;
    if (facts.fourthQuarterComeback) return STORY_TEMPLATES.bowlComeback;
    if (facts.lateWinningScore) return STORY_TEMPLATES.bowlLate;
    if (facts.game.overtime) return STORY_TEMPLATES.bowlOvertime;
    if (facts.game.rivalryKey) return STORY_TEMPLATES.bowlRivalry;
    if (facts.defensiveDominance) return STORY_TEMPLATES.bowlDefense;
    if (facts.margin >= 21) return STORY_TEMPLATES.bowlBlowout;
    if (facts.featuredPerformance) return STORY_TEMPLATES.bowlPlayer;
    return STORY_TEMPLATES.bowl;
  }
  if (angle === 'upset') {
    if (facts.upsetEvidence === 'ranking') return STORY_TEMPLATES.rankingUpset;
    if (facts.fourthQuarterComeback) return STORY_TEMPLATES.comebackUpset;
    if (facts.game.overtime) return STORY_TEMPLATES.overtimeUpset;
    return STORY_TEMPLATES.upset;
  }
  if (angle === 'comeback') {
    return facts.game.rivalryKey ? STORY_TEMPLATES.comebackRivalry : STORY_TEMPLATES.comeback;
  }
  if (angle === 'late_decider') {
    return facts.game.rivalryKey ? STORY_TEMPLATES.lateRivalry : STORY_TEMPLATES.late;
  }
  if (angle === 'overtime') return STORY_TEMPLATES.overtime;
  if (angle === 'rivalry') return STORY_TEMPLATES.rivalry;
  if (angle === 'standout_player') return STORY_TEMPLATES.player;
  if (angle === 'defensive_dominance') return STORY_TEMPLATES.defense;
  if (angle === 'blowout') return STORY_TEMPLATES.blowout;
  if (angle === 'ranked_result') {
    return facts.loserEditorialRank !== null ? STORY_TEMPLATES.rankedLoser : STORY_TEMPLATES.rankedWinner;
  }
  return STORY_TEMPLATES.routine;
};

const eligibleDeckRules = (facts: GameStoryFacts): DeckRuleId[] => {
  const rules: DeckRuleId[] = [];
  if (facts.lateWinningScore) rules.push('late_winning_score');
  if (facts.fourthQuarterComeback) rules.push('fourth_quarter_comeback');
  if (hasOddsUpset(facts.upsetEvidence)) rules.push('major_upset_probability');
  if (hasRankingUpset(facts.upsetEvidence)) rules.push('ranking_upset');
  if (facts.game.overtime > 0) rules.push('overtime');
  if (facts.game.rivalryKey && facts.winnerSeriesStreak > 1) rules.push('rivalry_streak');
  if (facts.revenge) rules.push('revenge');
  if (facts.defensiveDominance) rules.push(facts.shutout ? 'shutout' : 'turnover_defense');
  if (facts.featuredPerformance) rules.push('featured_performance');
  if (facts.leadChanges > 0) rules.push('lead_changes');
  rules.push('result');
  return rules;
};

const selectDeckRule = (
  facts: GameStoryFacts,
  headlineFacts: readonly EditorialFactId[],
) => {
  const rules = eligibleDeckRules(facts);
  return rules.find(rule =>
    rule !== 'result' && !headlineFacts.includes(deckRuleFact(rule))
  ) ?? rules[0];
};

export const generateGameNews = (facts: GameStoryFacts): GeneratedGameNews => {
  const angle = primaryAngle(facts);
  const storylines = detectStorylines(facts);
  const random = createSeededRandom(facts.game.id).fork(`news-templates:${NEWS_TEMPLATE_VERSION}`);
  const score = `${facts.winnerScore}-${facts.loserScore}`;
  const copySelectionKey =
    (facts.game.id + facts.winner.id + facts.loser.id) * 2 +
    facts.game.weekPlayed * 7 +
    facts.game.year;
  const tokens: StoryTokens = {
    winner: rankedName(facts.winner.name, facts.winnerEditorialRank),
    loser: rankedName(facts.loser.name, facts.loserEditorialRank),
    winner_name: facts.winner.name,
    loser_name: facts.loser.name,
    score,
    margin: String(facts.margin),
    deficit: String(facts.largestWinnerDeficit),
    game_label: facts.game.name ?? 'championship',
    ot_label: overtimeLabel(facts.game.overtime),
    rivalry_label: facts.game.name && facts.game.name !== 'Rivalry'
      ? facts.game.name
      : 'the rivalry',
    player: facts.featuredPerformance?.playerName ?? '',
    player_summary: facts.featuredPerformance?.summary ?? '',
    clock: facts.lateWinningScore ? formatGameClock(facts.lateWinningScore.secondsLeft) : '',
    win_probability: String(Math.round(facts.winnerWinProbability * 100)),
    rivalry_streak: String(facts.winnerSeriesStreak),
    lead_changes: String(facts.leadChanges),
    lead_change_label: facts.leadChanges === 1 ? 'lead change' : 'lead changes',
    turnovers: String(facts.turnoversForcedByWinner),
    loser_score: String(facts.loserScore),
  };
  const template = chooseStoryTemplate(
    headlinePool(facts, angle),
    random.fork('headline'),
    copySelectionKey,
  );
  const deckRuleId = selectDeckRule(facts, template.emphasizedFacts);
  const deckTemplate = chooseDeckTemplate(
    deckRuleId,
    random.fork(`deck:${deckRuleId}`),
    !template.includesScore,
    copySelectionKey,
  );
  const headline = renderStoryTemplate(template, tokens);
  const deck = renderDeckTemplate(deckTemplate, tokens);
  const newsworthiness = scoreGameNewsworthiness(facts);
  const item: GameNewsItem = {
    id: `game:${facts.game.id}`,
    type: 'game',
    year: facts.game.year,
    week: facts.game.weekPlayed,
    gameId: facts.game.id,
    teamIds: [facts.game.teamAId, facts.game.teamBId],
    featuredPlayerId: facts.featuredPerformance?.playerId ?? null,
    headline,
    deck,
    primaryAngle: angle,
    storylines,
    importance: newsworthiness.total,
  };
  return {
    item,
    trace: {
      templateVersion: NEWS_TEMPLATE_VERSION,
      facts: {
        gameType: facts.game.gameType,
        rivalryKey: facts.game.rivalryKey,
        winnerId: facts.winner.id,
        loserId: facts.loser.id,
        winnerScore: facts.winnerScore,
        loserScore: facts.loserScore,
        margin: facts.margin,
        winnerRank: facts.winnerRank,
        loserRank: facts.loserRank,
        winnerEditorialRank: facts.winnerEditorialRank,
        loserEditorialRank: facts.loserEditorialRank,
        winnerWinProbability: facts.winnerWinProbability,
        upsetEvidence: facts.upsetEvidence,
        overtime: facts.game.overtime,
        leadChanges: facts.leadChanges,
        largestWinnerDeficit: facts.largestWinnerDeficit,
        fourthQuarterComeback: facts.fourthQuarterComeback,
        lateWinningSecondsLeft: facts.lateWinningScore?.secondsLeft ?? null,
        turnoversForcedByWinner: facts.turnoversForcedByWinner,
        turnoversCommittedByWinner: facts.turnoversCommittedByWinner,
        shutout: facts.shutout,
        defensiveDominance: facts.defensiveDominance,
        featuredPerformance: facts.featuredPerformance,
        priorMeetings: facts.priorMeetings,
        winnerSeriesStreak: facts.winnerSeriesStreak,
        revenge: facts.revenge,
        postseasonRematch: facts.postseasonRematch,
      },
      candidateStorylines: storylines,
      primaryAngle: angle,
      templateId: template.id,
      deckRuleId,
      deckTemplateId: deckTemplate.id,
      headlineSyntaxFamily: template.syntaxFamily,
      deckSyntaxFamily: deckTemplate.syntaxFamily,
      headlineFacts: template.emphasizedFacts,
      deckFacts: deckTemplate.emphasizedFacts,
      scoreLocation: template.includesScore ? 'both' : 'deck',
      tokens,
      newsworthiness,
    },
  };
};
