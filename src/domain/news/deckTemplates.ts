import type { RandomSource } from '../utils/random';
import {
  COPY_SYNTAX_FAMILIES,
  COPY_TOKEN_IDS,
  EDITORIAL_FACT_IDS,
  renderCopyTemplate,
  type CopySyntaxFamily,
  type CopyTokens,
  type EditorialFactId,
  type StoryTemplateRequirement,
} from './templates';
export const DECK_RULE_IDS = [
  'late_winning_score',
  'fourth_quarter_comeback',
  'major_upset_probability',
  'ranking_upset',
  'overtime',
  'rivalry_streak',
  'revenge',
  'shutout',
  'turnover_defense',
  'featured_performance',
  'lead_changes',
  'result',
] as const;

export type DeckRuleId = (typeof DECK_RULE_IDS)[number];

export interface DeckTemplate {
  id: string;
  ruleId: DeckRuleId;
  text: string;
  requirements: readonly StoryTemplateRequirement[];
  syntaxFamily: CopySyntaxFamily;
  emphasizedFacts: readonly EditorialFactId[];
  includesScore: boolean;
}

interface DeckVariant {
  text: string;
  syntaxFamily: CopySyntaxFamily;
  includesScore: boolean;
}

const variant = (
  text: string,
  syntaxFamily: CopySyntaxFamily,
  includesScore = text.includes('<score>'),
): DeckVariant => ({ text, syntaxFamily, includesScore });

const RULE_FACT: Record<DeckRuleId, EditorialFactId> = {
  late_winning_score: 'late_decider',
  fourth_quarter_comeback: 'comeback',
  major_upset_probability: 'odds_upset',
  ranking_upset: 'ranking_upset',
  overtime: 'overtime',
  rivalry_streak: 'rivalry_streak',
  revenge: 'revenge',
  shutout: 'shutout',
  turnover_defense: 'turnover_defense',
  featured_performance: 'featured_player',
  lead_changes: 'lead_changes',
  result: 'result',
};

const RULE_REQUIREMENTS: Partial<Record<DeckRuleId, readonly StoryTemplateRequirement[]>> = {
  late_winning_score: ['late_decider'],
  fourth_quarter_comeback: ['comeback'],
  major_upset_probability: ['odds_upset'],
  ranking_upset: ['ranking_upset'],
  overtime: ['overtime'],
  featured_performance: ['featured_player'],
};

const pool = (ruleId: DeckRuleId, variants: readonly DeckVariant[]): DeckTemplate[] =>
  variants.map(({ text, syntaxFamily, includesScore }, index) => ({
    id: `${ruleId}.v3.${index + 1}`,
    ruleId,
    text,
    requirements: RULE_REQUIREMENTS[ruleId] ?? [],
    syntaxFamily,
    emphasizedFacts: [RULE_FACT[ruleId]],
    includesScore,
  }));

export const DECK_TEMPLATES: Record<DeckRuleId, readonly DeckTemplate[]> = {
  late_winning_score: pool('late_winning_score', [
    variant(`<winner_name> beat <loser_name> <score> after moving ahead with <clock> remaining.`, 'winner_first'),
    variant(`With <clock> left, <winner_name> took the lead for good in a <score> win over <loser_name>.`, 'context_first'),
    variant(`<loser_name> yielded the decisive lead with <clock> remaining as <winner_name> won <score>.`, 'opponent_first'),
    variant(`The final lead change came at <clock>, sending <winner_name> past <loser_name> <score>.`, 'consequence_first'),
  ]),
  fourth_quarter_comeback: pool('fourth_quarter_comeback', [
    variant(`<winner_name> erased a <deficit>-point deficit before beating <loser_name> <score>.`, 'winner_first'),
    variant(`A <deficit>-point fourth-quarter rally carried <winner_name> past <loser_name> <score>.`, 'context_first'),
    variant(`<loser_name> lost a <deficit>-point cushion as <winner_name> completed a <score> comeback.`, 'opponent_first'),
    variant(`The <score> result capped a <deficit>-point comeback by <winner_name>.`, 'consequence_first'),
  ]),
  major_upset_probability: pool('major_upset_probability', [
    variant(`<winner_name> entered with a <win_probability>% win probability before beating <loser_name> <score>.`, 'winner_first'),
    variant(`Given only a <win_probability>% pregame chance, <winner_name> overturned expectations in a <score> win.`, 'context_first'),
    variant(`<loser_name> fell <score> to a <winner_name> team carrying <win_probability>% pregame odds.`, 'opponent_first'),
    variant(`A <win_probability>% pregame chance became a <score> victory for <winner_name>.`, 'consequence_first'),
  ]),
  ranking_upset: pool('ranking_upset', [
    variant(`<winner_name> completed a material poll upset by beating <loser> <score>.`, 'winner_first'),
    variant(`The poll picture shifted when <winner_name> took down <loser> <score>.`, 'context_first'),
    variant(`<loser> absorbed a <score> loss to <winner_name> in a material ranking upset.`, 'opponent_first'),
    variant(`A material poll upset ended <score> in favor of <winner_name> over <loser_name>.`, 'consequence_first'),
  ]),
  overtime: pool('overtime', [
    variant(`<winner_name> prevailed <score> after the game reached <ot_label>.`, 'winner_first'),
    variant(`After regulation settled nothing, <winner_name> beat <loser_name> <score> in <ot_label>.`, 'context_first'),
    variant(`<loser_name> fell <score> when <winner_name> finished the job in <ot_label>.`, 'opponent_first'),
    variant(`The trip to <ot_label> produced a <score> victory for <winner_name> over <loser_name>.`, 'consequence_first'),
  ]),
  rivalry_streak: pool('rivalry_streak', [
    variant(`<winner_name> beat <loser_name> <score>, extending the dynasty-era series streak to <rivalry_streak>.`, 'winner_first'),
    variant(`The <score> result gave <winner_name> <rivalry_streak> straight dynasty-era wins over <loser_name>.`, 'consequence_first'),
    variant(`With the series streak at <rivalry_streak>, <winner_name> again beat <loser_name> <score>.`, 'context_first'),
    variant(`<loser_name> has now dropped <rivalry_streak> straight dynasty-era meetings after the <score> result.`, 'opponent_first'),
  ]),
  revenge: pool('revenge', [
    variant(`<winner_name> reversed the previous dynasty-era result with a <score> win over <loser_name>.`, 'winner_first'),
    variant(`After losing the previous dynasty-era meeting, <winner_name> answered with a <score> victory.`, 'context_first'),
    variant(`<loser_name> could not repeat the previous result, falling <score> to <winner_name>.`, 'opponent_first'),
    variant(`The <score> finish gave <winner_name> its answer to the teams' previous meeting.`, 'consequence_first'),
  ]),
  shutout: pool('shutout', [
    variant(`<winner_name> blanked <loser_name> <score>, never allowing a point.`, 'winner_first'),
    variant(`A wire-to-wire shutout carried <winner_name> past <loser_name> <score>.`, 'context_first'),
    variant(`<loser_name> never reached the scoreboard in a <score> loss to <winner_name>.`, 'opponent_first'),
    variant(`The <score> result marked a shutout for <winner_name>.`, 'consequence_first'),
  ]),
  turnover_defense: pool('turnover_defense', [
    variant(`<winner_name> forced <turnovers> turnovers while holding <loser_name> to <loser_score> points in a <score> win.`, 'winner_first'),
    variant(`<turnovers> takeaways powered <winner_name> past <loser_name> <score>.`, 'context_first'),
    variant(`<loser_name> committed <turnovers> turnovers and scored only <loser_score> points in the <score> loss.`, 'opponent_first'),
    variant(`A <turnovers>-takeaway defensive effort delivered a <score> victory for <winner_name>.`, 'consequence_first'),
  ]),
  featured_performance: pool('featured_performance', [
    variant(`<player> led <winner_name> past <loser_name> <score> with <player_summary>.`, 'player_first'),
    variant(`Behind <player>'s <player_summary>, <winner_name> beat <loser_name> <score>.`, 'context_first'),
    variant(`<loser_name> had no answer for <player>, who posted <player_summary> in the <score> result.`, 'opponent_first'),
    variant(`<player> supplied <player_summary> as <winner_name> earned a <score> win.`, 'consequence_first'),
    variant(`<winner_name> won <score> as <player> delivered <player_summary>.`, 'winner_first'),
    variant(`<player> turned in <player_summary>, carrying <winner_name> over <loser_name> <score>.`, 'player_first'),
  ]),
  lead_changes: pool('lead_changes', [
    variant(`<winner_name> beat <loser_name> <score> after <lead_changes> <lead_change_label>.`, 'winner_first'),
    variant(`A game with <lead_changes> <lead_change_label> ended <score> for <winner_name>.`, 'context_first'),
    variant(`<loser_name> finished behind <winner_name> <score> after <lead_changes> <lead_change_label>.`, 'opponent_first'),
    variant(`After <lead_changes> <lead_change_label>, the <score> result belonged to <winner_name>.`, 'consequence_first'),
    variant(`<winner_name> emerged with a <score> victory from a game featuring <lead_changes> <lead_change_label>.`, 'winner_first'),
    variant(`After <lead_changes> <lead_change_label>, <winner_name> finished off a <score> win.`, 'context_first'),
    variant(`<winner_name> owned the last of <lead_changes> <lead_change_label> in a <score> win.`, 'winner_first'),
    variant(`Through <lead_changes> <lead_change_label>, <winner_name> found the last answer in a <score> win.`, 'context_first'),
    variant(`<loser_name> held the advantage during a back-and-forth game but lost <score> to <winner_name>.`, 'opponent_first'),
    variant(`The last word in a game of <lead_changes> <lead_change_label> belonged to <winner_name>, <score>.`, 'consequence_first'),
    variant(`<winner_name> weathered <lead_changes> <lead_change_label> to defeat <loser_name> <score>.`, 'winner_first'),
    variant(`Back and forth through <lead_changes> <lead_change_label>, the game ended <score> for <winner_name>.`, 'context_first'),
  ]),
  result: pool('result', [
    variant(`<winner_name> secured a <margin>-point victory over <loser_name>, <score>.`, 'winner_first'),
    variant(`The <score> result gave <winner_name> a <margin>-point win over <loser_name>.`, 'consequence_first'),
    variant(`By a <margin>-point margin, <winner_name> finished ahead of <loser_name> <score>.`, 'context_first'),
    variant(`<loser_name> fell <score> as <winner_name> won by <margin>.`, 'opponent_first'),
    variant(`<winner_name> closed out <loser_name> <score> for a <margin>-point victory.`, 'winner_first'),
    variant(`A <margin>-point difference separated <winner_name> and <loser_name> in the <score> final.`, 'context_first'),
  ]),
};

export const ALL_DECK_TEMPLATES = DECK_RULE_IDS.flatMap(ruleId => DECK_TEMPLATES[ruleId]);

export const validateDeckTemplates = (templates: readonly DeckTemplate[]) => {
  const ids = new Set<string>();
  for (const template of templates) {
    if (ids.has(template.id)) throw new Error(`Duplicate deck template ID: ${template.id}`);
    ids.add(template.id);
    if (!DECK_RULE_IDS.includes(template.ruleId)) throw new Error(`Unknown deck rule: ${template.id}`);
    if (!COPY_SYNTAX_FAMILIES.includes(template.syntaxFamily)) throw new Error(`Unknown deck syntax family: ${template.id}`);
    if (template.emphasizedFacts.some(fact => !EDITORIAL_FACT_IDS.includes(fact))) {
      throw new Error(`Unknown deck emphasized fact: ${template.id}`);
    }
    const tokens = [...template.text.matchAll(/<([a-z_]+)>/g)].map(match => match[1]);
    if (tokens.some(token => !COPY_TOKEN_IDS.includes(token as never))) {
      throw new Error(`Deck template contains an unsupported token: ${template.id}`);
    }
    if (template.text.includes('<score>') !== template.includesScore) {
      throw new Error(`Deck template ${template.id} has inconsistent score metadata.`);
    }
    if (!template.text.endsWith('.')) throw new Error(`Deck template must be a sentence: ${template.id}`);
    if (template.text.includes('!')) throw new Error(`Deck template cannot use exclamation points: ${template.id}`);
  }
};

validateDeckTemplates(ALL_DECK_TEMPLATES);

export const DECK_TEMPLATES_BY_ID = new Map(
  ALL_DECK_TEMPLATES.map(template => [template.id, template]),
);

export const chooseDeckTemplate = (
  ruleId: DeckRuleId,
  random: RandomSource,
  requireScore: boolean,
  selectionKey = 0,
) => {
  const eligible = DECK_TEMPLATES[ruleId].filter(template => !requireScore || template.includesScore);
  if (!eligible.length) throw new Error(`Deck rule ${ruleId} has no score-bearing template.`);
  const randomIndex = random.int(0, eligible.length - 1);
  return eligible[(randomIndex + Math.abs(selectionKey)) % eligible.length];
};

export const renderDeckTemplate = (template: DeckTemplate, tokens: CopyTokens) =>
  renderCopyTemplate(template, tokens);

export const deckRuleFact = (ruleId: DeckRuleId) => RULE_FACT[ruleId];
