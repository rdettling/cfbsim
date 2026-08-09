import { GAME_STORY_ANGLES, GAME_TYPES } from '../../types/news';
import type { NewsAuditEntry, NewsAuditNotice } from './audit';
import {
  DECK_TEMPLATES_BY_ID,
  renderDeckTemplate,
  type DeckRuleId,
  type DeckTemplate,
} from './deckTemplates';
import {
  EDITORIAL_RANK_LIMIT,
  FEATURED_PERFORMANCE_QUALIFIERS,
  MAJOR_UNDERDOG_WIN_PROBABILITY,
  MATERIAL_RANKING_UPSET_GAP,
  type UpsetEvidence,
} from './policy';
import {
  COPY_SYNTAX_FAMILIES,
  renderStoryTemplate,
  STORY_TEMPLATES_BY_ID,
  type StoryTemplate,
  type StoryTemplateRequirement,
} from './templates';
import {
  NEWSWORTHINESS_COMPONENTS,
  NEWSWORTHINESS_DIMENSIONS,
  type NewsworthinessComponentId,
  type NewsworthinessDimensionTotals,
} from './newsworthiness';

const notice = (code: string, message: string, storyIds: string[] = []): NewsAuditNotice => ({
  code,
  message,
  storyIds: [...storyIds].sort(),
});

const editorialRank = (rank: number) =>
  rank >= 1 && rank <= EDITORIAL_RANK_LIMIT ? rank : null;

const expectedUpsetEvidence = (entry: NewsAuditEntry): UpsetEvidence => {
  const facts = entry.trace.facts;
  const winnerRank = editorialRank(facts.winnerRank);
  const loserRank = editorialRank(facts.loserRank);
  const odds = facts.winnerWinProbability < MAJOR_UNDERDOG_WIN_PROBABILITY;
  const ranking = loserRank !== null &&
    (winnerRank === null || winnerRank - loserRank >= MATERIAL_RANKING_UPSET_GAP);
  if (odds && ranking) return 'both';
  if (odds) return 'odds';
  if (ranking) return 'ranking';
  return null;
};

const hasOdds = (entry: NewsAuditEntry) => {
  const evidence = expectedUpsetEvidence(entry);
  return evidence === 'odds' || evidence === 'both';
};

const hasRanking = (entry: NewsAuditEntry) => {
  const evidence = expectedUpsetEvidence(entry);
  return evidence === 'ranking' || evidence === 'both';
};

const validateDeckRule = (entry: NewsAuditEntry) => {
  const facts = entry.trace.facts;
  const rules: Record<DeckRuleId, boolean> = {
    late_winning_score: facts.lateWinningSecondsLeft !== null,
    fourth_quarter_comeback: facts.fourthQuarterComeback,
    major_upset_probability: hasOdds(entry),
    ranking_upset: hasRanking(entry) && facts.loserEditorialRank !== null,
    overtime: facts.overtime > 0,
    rivalry_streak: facts.rivalryKey !== null && facts.winnerSeriesStreak > 1,
    revenge: facts.revenge,
    shutout: facts.shutout,
    turnover_defense: facts.defensiveDominance && !facts.shutout,
    featured_performance: facts.featuredPerformance !== null,
    lead_changes: facts.leadChanges > 0,
    result: true,
  };
  return rules[entry.trace.deckRuleId];
};

const templateRequirementRules = (entry: NewsAuditEntry) => {
  const facts = entry.trace.facts;
  const rules: Record<StoryTemplateRequirement, boolean> = {
    odds_upset: hasOdds(entry),
    ranking_upset: hasRanking(entry),
    comeback: facts.fourthQuarterComeback,
    late_decider: facts.lateWinningSecondsLeft !== null,
    overtime: facts.overtime > 0,
    rivalry: facts.rivalryKey !== null,
    featured_player: facts.featuredPerformance !== null,
    defensive_dominance: facts.defensiveDominance,
    blowout: facts.margin >= 21,
    ranked_result: facts.winnerEditorialRank !== null || facts.loserEditorialRank !== null,
    close_result: facts.margin <= 8,
  };
  return rules;
};

export const storyTemplateSupportsEntry = (
  template: StoryTemplate,
  entry: NewsAuditEntry,
) => {
  if (!template.gameTypes.includes(entry.trace.facts.gameType)) return false;
  const rules = templateRequirementRules(entry);
  return template.requirements.every(requirement => rules[requirement]);
};

const validateTemplate = (entry: NewsAuditEntry) => {
  const template = STORY_TEMPLATES_BY_ID.get(entry.trace.templateId);
  return Boolean(template &&
    storyTemplateSupportsEntry(template, entry) &&
    template.syntaxFamily === entry.trace.headlineSyntaxFamily &&
    template.includesScore === (entry.trace.scoreLocation === 'headline' || entry.trace.scoreLocation === 'both') &&
    JSON.stringify(template.emphasizedFacts) === JSON.stringify(entry.trace.headlineFacts) &&
    renderStoryTemplate(template, entry.trace.tokens) === entry.item.headline);
};

const deckTemplateSupportsEntry = (
  template: DeckTemplate,
  entry: NewsAuditEntry,
) => template.ruleId === entry.trace.deckRuleId &&
  template.requirements.every(requirement => templateRequirementRules(entry)[requirement]);

const validateDeckTemplate = (entry: NewsAuditEntry) => {
  const template = DECK_TEMPLATES_BY_ID.get(entry.trace.deckTemplateId);
  const headline = STORY_TEMPLATES_BY_ID.get(entry.trace.templateId);
  const expectedScoreLocation = headline?.includesScore
    ? template?.includesScore ? 'both' : 'headline'
    : 'deck';
  return Boolean(template &&
    deckTemplateSupportsEntry(template, entry) &&
    template.syntaxFamily === entry.trace.deckSyntaxFamily &&
    JSON.stringify(template.emphasizedFacts) === JSON.stringify(entry.trace.deckFacts) &&
    template.includesScore &&
    entry.trace.scoreLocation === expectedScoreLocation &&
    renderDeckTemplate(template, entry.trace.tokens) === entry.item.deck);
};

const scoreIsVisible = (entry: NewsAuditEntry) => {
  const score = entry.trace.tokens.score;
  return entry.item.headline.includes(score) || entry.item.deck.includes(score);
};

const validateReaderLanguage = (entry: NewsAuditEntry) => {
  const copy = `${entry.item.headline} ${entry.item.deck}`;
  const facts = entry.trace.facts;
  const upsetLanguage = /\b(?:stun(?:s|ned|ning)?|shock(?:s|ed|ing)?)\b/i.test(copy);
  const routLanguage = /\b(?:rout|routs|routed)\b/i.test(copy);
  const closeLanguage = /\b(?:edges|escapes|survives)\b/i.test(copy);
  return (!upsetLanguage || hasOdds(entry)) &&
    (!routLanguage || facts.margin >= 21) &&
    (!closeLanguage || facts.margin <= 8 || facts.overtime > 0 || facts.lateWinningSecondsLeft !== null) &&
    !entry.item.headline.includes('!') &&
    !entry.item.deck.includes('!');
};

const validateStorylines = (entry: NewsAuditEntry) => {
  const facts = entry.trace.facts;
  const storylines = new Set(entry.item.storylines);
  const playoff = facts.gameType === 'playoff_first_round' ||
    facts.gameType === 'playoff_quarterfinal' ||
    facts.gameType === 'playoff_semifinal';
  return (!storylines.has('championship') || facts.gameType === 'national_championship' || facts.gameType === 'conference_championship') &&
    (!storylines.has('playoff_advance') || playoff) &&
    (!storylines.has('bowl_result') || facts.gameType === 'bowl') &&
    (!storylines.has('upset') || expectedUpsetEvidence(entry) !== null) &&
    (!storylines.has('comeback') || facts.fourthQuarterComeback) &&
    (!storylines.has('late_decider') || facts.lateWinningSecondsLeft !== null) &&
    (!storylines.has('overtime') || facts.overtime > 0) &&
    (!storylines.has('rivalry') || facts.rivalryKey !== null) &&
    (!storylines.has('standout_player') || facts.featuredPerformance !== null) &&
    (!storylines.has('defensive_dominance') || facts.defensiveDominance) &&
    (!storylines.has('blowout') || facts.margin >= 21) &&
    (!storylines.has('ranked_result') || facts.winnerEditorialRank !== null || facts.loserEditorialRank !== null);
};

const validateUpsetIdentity = (entry: NewsAuditEntry) => {
  const facts = entry.trace.facts;
  return facts.winnerEditorialRank === editorialRank(facts.winnerRank) &&
    facts.loserEditorialRank === editorialRank(facts.loserRank) &&
    facts.upsetEvidence === expectedUpsetEvidence(entry);
};

const expectedRankComponent = (
  winnerRank: number | null,
  loserRank: number | null,
): NewsworthinessComponentId | null => {
  const ranks = [winnerRank, loserRank].filter((rank): rank is number => rank !== null);
  if (!ranks.length) return null;
  const rank = Math.min(...ranks);
  if (rank <= 5) return 'rank_participation:1_5';
  if (rank <= 10) return 'rank_participation:6_10';
  if (rank <= 15) return 'rank_participation:11_15';
  return 'rank_participation:16_25';
};

const expectedNewsworthinessIds = (entry: NewsAuditEntry) => {
  const facts = entry.trace.facts;
  const winnerRank = editorialRank(facts.winnerRank);
  const loserRank = editorialRank(facts.loserRank);
  const ids: NewsworthinessComponentId[] = [`base:${facts.gameType}`];
  const rankComponent = expectedRankComponent(winnerRank, loserRank);
  if (rankComponent) ids.push(rankComponent);
  if (winnerRank !== null && loserRank !== null) ids.push('both_ranked');
  if (facts.rivalryKey !== null) ids.push('rivalry');
  if (facts.featuredPerformance !== null) ids.push('featured_player');
  if (hasOdds(entry)) ids.push('major_underdog_win');
  if (hasRanking(entry)) ids.push('ranking_upset');
  if (facts.overtime > 0) ids.push('overtime');
  if (facts.lateWinningSecondsLeft !== null) ids.push('late_lead_change');
  if (facts.largestWinnerDeficit >= 14) ids.push('comeback_14_plus');
  else if (facts.largestWinnerDeficit >= 7) ids.push('comeback_7_to_13');
  if (facts.shutout) ids.push('shutout');
  if (facts.margin >= 28) ids.push('margin_28_plus');
  return ids;
};

export const validateNewsworthiness = (entry: NewsAuditEntry) => {
  const expectedIds = expectedNewsworthinessIds(entry);
  const actual = entry.trace.newsworthiness;
  if (actual.components.length !== expectedIds.length) return false;
  const dimensions: NewsworthinessDimensionTotals = {
    consequence: 0,
    national_relevance: 0,
    drama: 0,
  };
  for (let index = 0; index < expectedIds.length; index += 1) {
    const id = expectedIds[index];
    const definition = NEWSWORTHINESS_COMPONENTS[id];
    const component = actual.components[index];
    if (
      component?.id !== id ||
      component.dimension !== definition.dimension ||
      component.points !== definition.points
    ) return false;
    dimensions[definition.dimension] += definition.points;
  }
  const total = Object.values(dimensions).reduce((sum, points) => sum + points, 0);
  return actual.total === total &&
    entry.item.importance === total &&
    NEWSWORTHINESS_DIMENSIONS.every(
      dimension => actual.dimensions[dimension] === dimensions[dimension],
    );
};

const qualifierSet = new Set<string>(FEATURED_PERFORMANCE_QUALIFIERS);

const validateFeaturedPerformance = (entry: NewsAuditEntry) => {
  const feature = entry.trace.facts.featuredPerformance;
  return feature === null || (
    Boolean(feature.position) &&
    feature.qualifyingFacts.length > 0 &&
    feature.qualifyingFacts.every(fact => qualifierSet.has(fact))
  );
};

const validateBowlHeadline = (entry: NewsAuditEntry) =>
  entry.trace.facts.gameType !== 'bowl' || (
    entry.trace.tokens.game_label !== 'championship' &&
    entry.item.headline.includes(entry.trace.tokens.game_label)
  );

export const referencesRankOutsideTop25 = (entry: NewsAuditEntry) =>
  [...`${entry.item.headline} ${entry.item.deck}`.matchAll(/\bNo\. (\d+)\b/g)]
    .some(match => Number(match[1]) > EDITORIAL_RANK_LIMIT);

export const buildNewsAuditViolations = (entries: NewsAuditEntry[]) => {
  const natural = entries.filter(entry => entry.source === 'simulation');
  const scenarios = entries.filter(entry => entry.source === 'scenario');
  const violations: NewsAuditNotice[] = [];
  const invalidTrace = entries.filter(entry =>
    !validateNewsworthiness(entry) ||
    entry.item.primaryAngle !== entry.trace.primaryAngle ||
    !entry.trace.candidateStorylines.includes(entry.trace.primaryAngle) ||
    entry.featuredPosition !== (entry.trace.facts.featuredPerformance?.position ?? null) ||
    /<[a-z_]+>/.test(`${entry.item.headline} ${entry.item.deck}`),
  );
  if (invalidTrace.length) violations.push(notice('invalid_editorial_trace', 'Generated story data does not agree with its editorial trace.', invalidTrace.map(entry => entry.auditId)));
  const unsupportedClaims = entries.filter(entry =>
    !validateDeckRule(entry) ||
    !validateStorylines(entry) ||
    !validateTemplate(entry) ||
    !validateDeckTemplate(entry) ||
    !validateReaderLanguage(entry),
  );
  if (unsupportedClaims.length) violations.push(notice('unsupported_factual_claim', 'Generated copy makes a claim that is not supported by its verified facts.', unsupportedClaims.map(entry => entry.auditId)));
  const invalidUpsetIdentity = entries.filter(entry => !validateUpsetIdentity(entry));
  if (invalidUpsetIdentity.length) violations.push(notice('invalid_upset_identity', 'Editorial ranks or upset evidence do not match verified game facts.', invalidUpsetIdentity.map(entry => entry.auditId)));
  const ineligibleFeatures = entries.filter(entry => !validateFeaturedPerformance(entry));
  if (ineligibleFeatures.length) violations.push(notice('ineligible_featured_performance', 'A featured performance does not contain a qualifying exceptional fact.', ineligibleFeatures.map(entry => entry.auditId)));
  const unnamedBowls = entries.filter(entry => !validateBowlHeadline(entry));
  if (unnamedBowls.length) violations.push(notice('unnamed_bowl_headline', 'A bowl headline does not preserve the game name.', unnamedBowls.map(entry => entry.auditId)));
  const invalidRankReferences = entries.filter(referencesRankOutsideTop25);
  if (invalidRankReferences.length) violations.push(notice('ranking_reference_outside_top_25', 'Reader-facing copy references a ranking outside the top 25.', invalidRankReferences.map(entry => entry.auditId)));
  const missingScores = entries.filter(entry => !scoreIsVisible(entry));
  if (missingScores.length) violations.push(notice('missing_final_score', 'A story does not expose its final score in the headline or deck.', missingScores.map(entry => entry.auditId)));
  const coveredGameTypes = new Set(natural.map(entry => entry.trace.facts.gameType));
  const missingGameTypes = GAME_TYPES.filter(type => !coveredGameTypes.has(type));
  if (missingGameTypes.length) violations.push(notice('missing_game_type_coverage', `Corpus is missing game types: ${missingGameTypes.join(', ')}.`));
  const coveredScenarioAngles = new Set(scenarios.map(entry => entry.item.primaryAngle));
  const missingAngles = GAME_STORY_ANGLES.filter(angle => !coveredScenarioAngles.has(angle));
  if (missingAngles.length) violations.push(notice('missing_scenario_angle_coverage', `Scenario pack is missing primary angles: ${missingAngles.join(', ')}.`));
  const headlineFamilies = new Set(scenarios.map(entry => entry.trace.headlineSyntaxFamily));
  const deckFamilies = new Set(scenarios.map(entry => entry.trace.deckSyntaxFamily));
  const missingHeadlineFamilies = COPY_SYNTAX_FAMILIES.filter(family => !headlineFamilies.has(family));
  const missingDeckFamilies = COPY_SYNTAX_FAMILIES.filter(family => !deckFamilies.has(family));
  if (missingHeadlineFamilies.length || missingDeckFamilies.length) {
    violations.push(notice(
      'missing_copy_family_coverage',
      `Scenario pack is missing headline families [${missingHeadlineFamilies.join(', ')}] or deck families [${missingDeckFamilies.join(', ')}].`,
    ));
  }
  return violations;
};
