import type { RandomSource } from '../utils/random';
import { GAME_TYPES, type GameType } from '../../types/news';

export const COPY_SYNTAX_FAMILIES = [
  'winner_first',
  'context_first',
  'consequence_first',
  'player_first',
  'opponent_first',
] as const;

export type CopySyntaxFamily = (typeof COPY_SYNTAX_FAMILIES)[number];

export const EDITORIAL_FACT_IDS = [
  'result',
  'postseason',
  'odds_upset',
  'ranking_upset',
  'comeback',
  'late_decider',
  'overtime',
  'rivalry',
  'rivalry_streak',
  'revenge',
  'featured_player',
  'defensive_dominance',
  'shutout',
  'turnover_defense',
  'blowout',
  'ranked_result',
  'lead_changes',
] as const;

export type EditorialFactId = (typeof EDITORIAL_FACT_IDS)[number];

export const COPY_TOKEN_IDS = [
  'winner', 'loser', 'winner_name', 'loser_name', 'score', 'margin', 'deficit',
  'game_label', 'ot_label', 'rivalry_label', 'player', 'player_summary', 'clock',
  'win_probability', 'rivalry_streak', 'lead_changes', 'lead_change_label',
  'turnovers', 'loser_score',
] as const;

export type CopyToken = (typeof COPY_TOKEN_IDS)[number];

export type CopyTokens = Record<CopyToken, string>;
export type StoryTokens = CopyTokens;

export const STORY_TEMPLATE_REQUIREMENTS = [
  'odds_upset',
  'ranking_upset',
  'comeback',
  'late_decider',
  'overtime',
  'rivalry',
  'featured_player',
  'defensive_dominance',
  'blowout',
  'ranked_result',
  'close_result',
] as const;

export type StoryTemplateRequirement =
  (typeof STORY_TEMPLATE_REQUIREMENTS)[number];

export interface StoryTemplate {
  id: string;
  text: string;
  gameTypes: readonly GameType[];
  requirements: readonly StoryTemplateRequirement[];
  syntaxFamily: CopySyntaxFamily;
  emphasizedFacts: readonly EditorialFactId[];
  includesScore: boolean;
}

interface Variant {
  text: string;
  syntaxFamily: CopySyntaxFamily;
}

const variant = (text: string, syntaxFamily: CopySyntaxFamily): Variant => ({
  text,
  syntaxFamily,
});

const TOKEN_PATTERN = /<([a-z_]+)>/g;
const KNOWN_TOKENS = new Set<CopyToken>(COPY_TOKEN_IDS);

const TOKEN_REQUIREMENTS: Partial<Record<CopyToken, StoryTemplateRequirement>> = {
  deficit: 'comeback',
  ot_label: 'overtime',
  rivalry_label: 'rivalry',
  player: 'featured_player',
  player_summary: 'featured_player',
  clock: 'late_decider',
  win_probability: 'odds_upset',
};

const REQUIREMENT_FACT: Partial<Record<StoryTemplateRequirement, EditorialFactId>> = {
  odds_upset: 'odds_upset',
  ranking_upset: 'ranking_upset',
  comeback: 'comeback',
  late_decider: 'late_decider',
  overtime: 'overtime',
  rivalry: 'rivalry',
  featured_player: 'featured_player',
  defensive_dominance: 'defensive_dominance',
  blowout: 'blowout',
  ranked_result: 'ranked_result',
};

const tokensIn = (text: string) =>
  [...text.matchAll(TOKEN_PATTERN)].map(match => match[1] as CopyToken);

export const validateStoryTemplates = (templates: readonly StoryTemplate[]) => {
  const ids = new Set<string>();
  for (const template of templates) {
    if (ids.has(template.id)) throw new Error(`Duplicate news template ID: ${template.id}`);
    ids.add(template.id);
    if (!template.gameTypes.length) throw new Error(`News template has no game types: ${template.id}`);
    if (template.gameTypes.some(gameType => !GAME_TYPES.includes(gameType))) {
      throw new Error(`News template has an unsupported game type: ${template.id}`);
    }
    if (!COPY_SYNTAX_FAMILIES.includes(template.syntaxFamily)) {
      throw new Error(`News template has an unsupported syntax family: ${template.id}`);
    }
    if (template.requirements.some(requirement =>
      !STORY_TEMPLATE_REQUIREMENTS.includes(requirement as StoryTemplateRequirement)
    )) throw new Error(`News template has an unsupported requirement: ${template.id}`);
    if (template.emphasizedFacts.some(fact => !EDITORIAL_FACT_IDS.includes(fact))) {
      throw new Error(`News template has an unsupported emphasized fact: ${template.id}`);
    }
    const tokens = tokensIn(template.text);
    if (tokens.some(token => !KNOWN_TOKENS.has(token))) {
      throw new Error(`News template contains an unsupported token: ${template.text}`);
    }
    for (const token of tokens) {
      const requirement = TOKEN_REQUIREMENTS[token];
      if (requirement && !template.requirements.includes(requirement)) {
        throw new Error(`News template ${template.id} uses <${token}> without ${requirement}.`);
      }
    }
    for (const requirement of template.requirements) {
      const fact = REQUIREMENT_FACT[requirement];
      if (fact && !template.emphasizedFacts.includes(fact)) {
        throw new Error(`News template ${template.id} requires ${requirement} without emphasizing it.`);
      }
    }
    if (tokens.includes('game_label') && template.gameTypes.includes('regular_season')) {
      throw new Error(`Regular-season template ${template.id} cannot require <game_label>.`);
    }
    if (tokens.includes('score') !== template.includesScore) {
      throw new Error(`News template ${template.id} has inconsistent score metadata.`);
    }
    if (template.text.includes('!')) throw new Error(`News headline cannot use exclamation points: ${template.id}`);
    if (/\b(?:stun(?:s|ned|ning)?|shock(?:s|ed|ing)?)\b/i.test(template.text) && !template.requirements.includes('odds_upset')) {
      throw new Error(`News template ${template.id} uses odds-upset language without odds evidence.`);
    }
    if (/\b(?:rout|routs|routed)\b/i.test(template.text) && !template.requirements.includes('blowout')) {
      throw new Error(`News template ${template.id} uses rout language without a blowout.`);
    }
    if (/\b(?:edges|escapes|survives)\b/i.test(template.text) &&
      !template.requirements.some(requirement =>
        requirement === 'close_result' || requirement === 'late_decider' || requirement === 'overtime'
      )) {
      throw new Error(`News template ${template.id} uses close-game language without support.`);
    }
  }
};

export const renderCopyTemplate = (
  template: Pick<StoryTemplate, 'id' | 'text'>,
  tokens: CopyTokens,
) => {
  const rendered = template.text.replace(TOKEN_PATTERN, (_, token: CopyToken) => tokens[token]);
  if (/<[a-z_]+>/.test(rendered)) {
    throw new Error(`News template contains an unresolved token: ${template.text}`);
  }
  return rendered;
};

export const renderStoryTemplate = (template: StoryTemplate, tokens: CopyTokens) => {
  validateStoryTemplates([template]);
  return renderCopyTemplate(template, tokens);
};

export const chooseStoryTemplate = (
  templates: readonly StoryTemplate[],
  random: RandomSource,
  selectionKey = 0,
) => {
  validateStoryTemplates(templates);
  if (!templates.length) throw new Error('News template pool cannot be empty.');
  const randomIndex = random.int(0, templates.length - 1);
  return templates[(randomIndex + Math.abs(selectionKey)) % templates.length];
};

const storyTemplates = (
  group: string,
  gameTypes: readonly GameType[],
  requirements: readonly StoryTemplateRequirement[],
  variants: readonly Variant[],
): StoryTemplate[] => variants.map(({ text, syntaxFamily }, index) => ({
  id: `${group}.v3.${index + 1}`,
  text,
  gameTypes,
  requirements,
  syntaxFamily,
  emphasizedFacts: [
    'result',
    ...(gameTypes.some(gameType => gameType !== 'regular_season') ? ['postseason' as const] : []),
    ...requirements.map(requirement => REQUIREMENT_FACT[requirement]).filter(
      (fact): fact is EditorialFactId => fact !== undefined,
    ),
  ],
  includesScore: tokensIn(text).includes('score'),
}));

const regular = (group: string, requirements: readonly StoryTemplateRequirement[], variants: readonly Variant[]) =>
  storyTemplates(group, ['regular_season'], requirements, variants);
const title = (group: string, requirements: readonly StoryTemplateRequirement[], variants: readonly Variant[]) =>
  storyTemplates(group, ['national_championship', 'conference_championship'], requirements, variants);
const national = (group: string, requirements: readonly StoryTemplateRequirement[], variants: readonly Variant[]) =>
  storyTemplates(group, ['national_championship'], requirements, variants);
const conference = (group: string, requirements: readonly StoryTemplateRequirement[], variants: readonly Variant[]) =>
  storyTemplates(group, ['conference_championship'], requirements, variants);
const playoff = (group: string, requirements: readonly StoryTemplateRequirement[], variants: readonly Variant[]) =>
  storyTemplates(group, ['playoff_first_round', 'playoff_quarterfinal', 'playoff_semifinal'], requirements, variants);
const bowl = (group: string, requirements: readonly StoryTemplateRequirement[], variants: readonly Variant[]) =>
  storyTemplates(group, ['bowl'], requirements, variants);

const consequenceVariants = (noun: string): Variant[] => [
  variant(`<winner> claims ${noun} with <score> win over <loser>`, 'winner_first'),
  variant(`Victory over <loser> gives <winner> ${noun}`, 'consequence_first'),
  variant(`<winner> beats <loser> <score> to secure ${noun}`, 'winner_first'),
  variant(`After topping <loser>, <winner> takes ${noun}`, 'context_first'),
];

const postseasonContext = (action: string, requirementText: string): Variant[] => [
  variant(`<winner> ${action} <loser> <score> to claim <game_label>`, 'winner_first'),
  variant(`<game_label> goes to <winner> after ${requirementText} against <loser>`, 'consequence_first'),
  variant(`With ${requirementText}, <winner> gets past <loser> for <game_label>`, 'context_first'),
  variant(`<winner> secures <game_label>, beating <loser> <score>`, 'winner_first'),
];

const playoffContext = (action: string, requirementText: string): Variant[] => [
  variant(`<winner> ${action} <loser> <score> to advance`, 'winner_first'),
  variant(`With ${requirementText}, <winner> moves into the next round`, 'context_first'),
  variant(`<winner> moves on after beating <loser> <score>`, 'consequence_first'),
  variant(`<loser> exits as <winner> advances with ${requirementText}`, 'opponent_first'),
];

const bowlContext = (action: string, requirementText: string): Variant[] => [
  variant(`<winner> ${action} <loser> <score> to win <game_label>`, 'winner_first'),
  variant(`<game_label> goes to <winner> after ${requirementText}`, 'consequence_first'),
  variant(`With ${requirementText}, <winner> gets past <loser> in <game_label>`, 'context_first'),
  variant(`<winner> closes <game_label> with victory over <loser>`, 'winner_first'),
];

export const STORY_TEMPLATES = {
  nationalChampionship: national('national_championship', [], consequenceVariants('the national championship')),
  nationalChampionshipOvertime: national('national_championship_overtime', ['overtime'], [
    variant(`<winner> wins national title in <ot_label>, tops <loser> <score>`, 'winner_first'),
    variant(`After <ot_label>, <winner> stands as national champion`, 'context_first'),
    variant(`National title goes to <winner> after <ot_label> win over <loser>`, 'consequence_first'),
    variant(`<loser> falls in <ot_label> as <winner> takes the national crown`, 'opponent_first'),
  ]),
  nationalChampionshipUpset: national('national_championship_upset', ['odds_upset'], [
    variant(`<winner> shocks <loser> <score> to win national championship`, 'winner_first'),
    variant(`National title belongs to <winner> after stunning <loser>`, 'consequence_first'),
    variant(`Against the odds, <winner> takes the national crown`, 'context_first'),
    variant(`<loser> stunned as <winner> completes championship upset`, 'opponent_first'),
  ]),
  titleUpset: title('title_upset', ['odds_upset'], postseasonContext('stuns', 'an upset')),
  titleRankingUpset: title('title_ranking_upset', ['ranking_upset'], postseasonContext('knocks off', 'a poll upset')),
  titleComeback: title('title_comeback', ['comeback'], [
    variant(`<winner> rallies from <deficit> down to win <game_label> <score>`, 'winner_first'),
    variant(`<game_label> goes to <winner> after a <deficit>-point comeback`, 'consequence_first'),
    variant(`A <deficit>-point rally carries <winner> to <game_label>`, 'context_first'),
    variant(`<loser> lets <game_label> slip as <winner> storms back`, 'opponent_first'),
  ]),
  titleLate: title('title_late', ['late_decider'], postseasonContext('beats', 'a late winner')),
  titleOvertime: title('title_overtime', ['overtime'], postseasonContext('outlasts', '<ot_label> drama')),
  titleRivalry: title('title_rivalry', ['rivalry'], postseasonContext('beats', '<rivalry_label> bragging rights')),
  titleDefense: title('title_defense', ['defensive_dominance'], postseasonContext('shuts down', 'a dominant defensive showing')),
  titleBlowout: title('title_blowout', ['blowout'], postseasonContext('routs', 'a runaway win')),
  titlePlayer: title('title_player', ['featured_player'], [
    variant(`<player> powers <winner> to <game_label> with <score> win`, 'player_first'),
    variant(`<game_label> goes to <winner> behind <player>`, 'consequence_first'),
    variant(`Behind <player>, <winner> claims <game_label>`, 'context_first'),
    variant(`<winner> rides <player> past <loser> for <game_label>`, 'winner_first'),
  ]),
  conferenceChampionship: conference('conference_championship', [], consequenceVariants('<game_label>')),
  playoff: playoff('playoff', [], [
    variant(`<winner> advances with <score> win over <loser>`, 'winner_first'),
    variant(`Next round awaits <winner> after victory over <loser>`, 'consequence_first'),
    variant(`<winner> moves on after beating <loser> <score>`, 'winner_first'),
    variant(`<loser> exits as <winner> books a place in the next round`, 'opponent_first'),
    variant(`Playoff path stays open for <winner> after <score> result`, 'consequence_first'),
    variant(`With <loser> dispatched, <winner> turns to the next round`, 'context_first'),
    variant(`<winner> clears <loser> and continues its postseason run`, 'winner_first'),
    variant(`<loser> bows out while <winner> keeps moving`, 'opponent_first'),
    variant(`A <score> win puts <winner> through to the next round`, 'consequence_first'),
    variant(`Postseason progress continues for <winner> at <loser>'s expense`, 'context_first'),
    variant(`<winner> takes another step with victory over <loser>`, 'winner_first'),
    variant(`<loser> sees its run end against <winner>`, 'opponent_first'),
    variant(`The bracket now carries <winner> forward`, 'consequence_first'),
    variant(`One round down, <winner> moves beyond <loser>`, 'context_first'),
    variant(`<winner> earns its place in the next playoff stage`, 'winner_first'),
    variant(`Season ends for <loser> as <winner> advances`, 'opponent_first'),
  ]),
  playoffOvertime: playoff('playoff_overtime', ['overtime'], playoffContext('outlasts', '<ot_label> drama')),
  playoffUpset: playoff('playoff_upset', ['odds_upset'], playoffContext('stuns', 'a playoff upset')),
  playoffRankingUpset: playoff('playoff_ranking_upset', ['ranking_upset'], playoffContext('knocks out', 'a poll upset')),
  playoffComeback: playoff('playoff_comeback', ['comeback'], playoffContext('rallies past', 'a <deficit>-point comeback')),
  playoffLate: playoff('playoff_late', ['late_decider'], playoffContext('beats', 'a late winner')),
  playoffRivalry: playoff('playoff_rivalry', ['rivalry'], playoffContext('beats', '<rivalry_label> bragging rights')),
  playoffDefense: playoff('playoff_defense', ['defensive_dominance'], playoffContext('shuts down', 'a dominant defensive showing')),
  playoffBlowout: playoff('playoff_blowout', ['blowout'], playoffContext('routs', 'a runaway win')),
  playoffPlayer: playoff('playoff_player', ['featured_player'], [
    variant(`<player> powers <winner> past <loser> <score> in playoff`, 'player_first'),
    variant(`Next round awaits <winner> after <player> takes over`, 'consequence_first'),
    variant(`Behind <player>, <winner> knocks out <loser>`, 'context_first'),
    variant(`<winner> advances on the strength of <player>`, 'winner_first'),
  ]),
  comebackUpset: regular('comeback_upset', ['odds_upset', 'comeback'], [
    variant(`<winner> erases <deficit>-point deficit, stuns <loser> <score>`, 'winner_first'),
    variant(`From <deficit> down, <winner> storms back to shock <loser>`, 'context_first'),
    variant(`<loser> stunned as <winner> completes an improbable rally`, 'opponent_first'),
    variant(`An upset takes shape as <winner> wipes out <deficit>-point hole`, 'consequence_first'),
  ]),
  overtimeUpset: regular('overtime_upset', ['odds_upset', 'overtime'], [
    variant(`<winner> stuns <loser> <score> in <ot_label>`, 'winner_first'),
    variant(`In <ot_label>, <winner> delivers an upset over <loser>`, 'context_first'),
    variant(`<loser> shocked as <winner> finishes upset in <ot_label>`, 'opponent_first'),
    variant(`Against the odds, <winner> outlasts <loser> in <ot_label>`, 'consequence_first'),
  ]),
  upset: regular('upset', ['odds_upset'], [
    variant(`<winner> stuns <loser> <score>`, 'winner_first'),
    variant(`Against the odds, <winner> takes down <loser>`, 'context_first'),
    variant(`<loser> shocked by <winner> in <score> upset`, 'opponent_first'),
    variant(`Upset belongs to <winner> after win over <loser>`, 'consequence_first'),
    variant(`<winner> turns long odds into victory over <loser>`, 'winner_first'),
    variant(`Underdog <winner> springs surprise on <loser>`, 'context_first'),
  ]),
  rankingUpset: regular('ranking_upset', ['ranking_upset'], [
    variant(`<winner> knocks off <loser> <score>`, 'winner_first'),
    variant(`Poll upset sends <winner> past <loser>`, 'context_first'),
    variant(`<loser> falls to <winner> in ranked shakeup`, 'opponent_first'),
    variant(`Signature ranked win belongs to <winner> after beating <loser>`, 'consequence_first'),
    variant(`<winner> takes down <loser> and reshapes the poll picture`, 'winner_first'),
    variant(`On a statement day, <winner> topples <loser>`, 'context_first'),
    variant(`<winner> changes the rankings conversation with win over <loser>`, 'winner_first'),
    variant(`Poll order gives way as <winner> beats <loser> <score>`, 'context_first'),
    variant(`<loser> takes a rankings hit in loss to <winner>`, 'opponent_first'),
    variant(`A ranked breakthrough belongs to <winner> after beating <loser>`, 'consequence_first'),
    variant(`<winner> lands a defining win against <loser>`, 'winner_first'),
    variant(`In a poll-shifting result, <winner> defeats <loser>`, 'context_first'),
    variant(`<winner> adds a marquee ranked victory over <loser>`, 'winner_first'),
    variant(`<winner>'s win over <loser> shakes up the rankings`, 'context_first'),
    variant(`<loser> drops a poll-shaping decision to <winner> <score>`, 'opponent_first'),
    variant(`A breakthrough against <loser> elevates <winner>`, 'consequence_first'),
    variant(`<winner> makes a poll statement against <loser>`, 'winner_first'),
    variant(`<winner> shifts the poll picture by beating <loser>`, 'context_first'),
  ]),
  comebackRivalry: regular('comeback_rivalry', ['comeback', 'rivalry'], [
    variant(`<winner> rallies from <deficit> down to win <rivalry_label> <score>`, 'winner_first'),
    variant(`Bragging rights in <rivalry_label> swing to <winner> after <deficit>-point rally`, 'consequence_first'),
    variant(`From <deficit> down, <winner> takes rivalry bragging rights`, 'context_first'),
    variant(`<loser> lets rivalry lead slip as <winner> storms back`, 'opponent_first'),
  ]),
  comeback: regular('comeback', ['comeback'], [
    variant(`<winner> erases <deficit>-point deficit, beats <loser> <score>`, 'winner_first'),
    variant(`From <deficit> down, <winner> storms past <loser>`, 'context_first'),
    variant(`<loser> lets lead slip as <winner> completes comeback`, 'opponent_first'),
    variant(`Comeback carries <winner> past <loser>`, 'consequence_first'),
    variant(`<winner> turns <deficit>-point hole into victory`, 'winner_first'),
    variant(`A fourth-quarter rally sends <winner> past <loser>`, 'context_first'),
  ]),
  lateRivalry: regular('late_rivalry', ['late_decider', 'rivalry'], [
    variant(`<winner> claims <rivalry_label> with late <score> win`, 'winner_first'),
    variant(`Late turn gives <winner> rivalry bragging rights`, 'context_first'),
    variant(`Bragging rights in <rivalry_label> swing to <winner> in closing minutes`, 'consequence_first'),
    variant(`<loser> loses late lead as <winner> takes the rivalry`, 'opponent_first'),
  ]),
  late: regular('late', ['late_decider'], [
    variant(`<winner> takes late lead, edges <loser> <score>`, 'winner_first'),
    variant(`Late strike lifts <winner> past <loser>`, 'context_first'),
    variant(`<loser> falls after <winner> moves ahead late`, 'opponent_first'),
    variant(`Closing minutes belong to <winner> in win over <loser>`, 'consequence_first'),
  ]),
  overtime: regular('overtime', ['overtime'], [
    variant(`<winner> outlasts <loser> <score> in <ot_label>`, 'winner_first'),
    variant(`After <ot_label>, <winner> finishes ahead of <loser>`, 'context_first'),
    variant(`<loser> falls as <winner> survives <ot_label>`, 'opponent_first'),
    variant(`Extra time belongs to <winner> against <loser>`, 'consequence_first'),
    variant(`<winner> finds a way past <loser> in <ot_label>`, 'winner_first'),
    variant(`After regulation settles nothing, <winner> beats <loser> <score>`, 'context_first'),
  ]),
  rivalry: regular('rivalry', ['rivalry'], [
    variant(`<winner> claims <rivalry_label> with <score> win over <loser>`, 'winner_first'),
    variant(`Bragging rights in <rivalry_label> belong to <winner> after beating <loser>`, 'consequence_first'),
    variant(`Bragging rights go to <winner> against <loser>`, 'context_first'),
    variant(`<loser> yields rivalry stage to <winner>`, 'opponent_first'),
    variant(`<winner> takes rivalry bragging rights from <loser>`, 'winner_first'),
    variant(`On rivalry day, <winner> gets the better of <loser>`, 'context_first'),
  ]),
  player: regular('player', ['featured_player'], [
    variant(`<player> powers <winner> past <loser> <score>`, 'player_first'),
    variant(`<winner> rides <player> to victory over <loser>`, 'winner_first'),
    variant(`Behind <player>, <winner> takes down <loser>`, 'context_first'),
    variant(`<loser> cannot contain <player> in loss to <winner>`, 'opponent_first'),
    variant(`<player> delivers as <winner> beats <loser>`, 'player_first'),
    variant(`A star turn from <player> carries <winner>`, 'consequence_first'),
  ]),
  defense: regular('defense', ['defensive_dominance'], [
    variant(`<winner> defense shuts down <loser> in <score> win`, 'winner_first'),
    variant(`Defense carries <winner> past <loser>`, 'context_first'),
    variant(`<loser> bottled up by <winner> defense`, 'opponent_first'),
    variant(`A defensive statement sends <winner> past <loser>`, 'consequence_first'),
    variant(`<winner> clamps down on <loser> for victory`, 'winner_first'),
    variant(`On a dominant defensive day, <winner> beats <loser>`, 'context_first'),
  ]),
  blowout: regular('blowout', ['blowout'], [
    variant(`<winner> overwhelms <loser> <score>`, 'winner_first'),
    variant(`Runaway win sends <winner> past <loser>`, 'context_first'),
    variant(`<loser> routed by <winner> in one-sided result`, 'opponent_first'),
    variant(`Statement rout belongs to <winner> over <loser>`, 'consequence_first'),
    variant(`<winner> pulls away and leaves <loser> behind`, 'winner_first'),
    variant(`All <winner> in decisive victory over <loser>`, 'context_first'),
  ]),
  rankedLoser: regular('ranked_loser', ['ranked_result'], [
    variant(`<winner> beats <loser> <score>`, 'winner_first'),
    variant(`Ranked matchup goes to <winner> over <loser>`, 'context_first'),
    variant(`<loser> comes up short against <winner>`, 'opponent_first'),
    variant(`Ranked result belongs to <winner>`, 'consequence_first'),
    variant(`<winner> gets past <loser> in ranked matchup`, 'winner_first'),
    variant(`With the poll in view, <winner> beats <loser>`, 'context_first'),
  ]),
  rankedWinner: regular('ranked_winner', ['ranked_result'], [
    variant(`<winner> handles <loser> <score>`, 'winner_first'),
    variant(`<winner> handles business against <loser>`, 'context_first'),
    variant(`<loser> cannot derail <winner>`, 'opponent_first'),
    variant(`Expected result sends <winner> past <loser>`, 'consequence_first'),
    variant(`<winner> stays on course with win over <loser>`, 'winner_first'),
    variant(`On a steady day, <winner> dispatches <loser>`, 'context_first'),
  ]),
  bowl: bowl('bowl', [], consequenceVariants('<game_label>')),
  bowlUpset: bowl('bowl_upset', ['odds_upset'], bowlContext('stuns', 'an upset')),
  bowlRankingUpset: bowl('bowl_ranking_upset', ['ranking_upset'], bowlContext('knocks off', 'a poll upset')),
  bowlComeback: bowl('bowl_comeback', ['comeback'], bowlContext('rallies past', 'a <deficit>-point comeback')),
  bowlLate: bowl('bowl_late', ['late_decider'], bowlContext('beats', 'a late winner')),
  bowlOvertime: bowl('bowl_overtime', ['overtime'], bowlContext('outlasts', '<ot_label> drama')),
  bowlRivalry: bowl('bowl_rivalry', ['rivalry'], bowlContext('beats', '<rivalry_label> bragging rights')),
  bowlDefense: bowl('bowl_defense', ['defensive_dominance'], bowlContext('shuts down', 'a dominant defensive showing')),
  bowlBlowout: bowl('bowl_blowout', ['blowout'], bowlContext('routs', 'a runaway win')),
  bowlPlayer: bowl('bowl_player', ['featured_player'], [
    variant(`<player> powers <winner> to <score> <game_label> win`, 'player_first'),
    variant(`<game_label> belongs to <winner> behind <player>`, 'consequence_first'),
    variant(`Behind <player>, <winner> takes <game_label>`, 'context_first'),
    variant(`<winner> rides <player> past <loser> in <game_label>`, 'winner_first'),
  ]),
  routine: regular('routine', [], [
    variant(`<winner> beats <loser> <score>`, 'winner_first'),
    variant(`<winner> tops <loser> <score>`, 'winner_first'),
    variant(`<loser> falls to <winner> <score>`, 'opponent_first'),
    variant(`Victory goes to <winner> over <loser> <score>`, 'consequence_first'),
    variant(`<winner> gets past <loser> <score>`, 'winner_first'),
    variant(`On the day, <winner> finishes ahead of <loser> <score>`, 'context_first'),
  ]),
} as const;

export const ALL_STORY_TEMPLATES: readonly StoryTemplate[] =
  Object.values(STORY_TEMPLATES).flat();

validateStoryTemplates(ALL_STORY_TEMPLATES);

export const STORY_TEMPLATES_BY_ID = new Map(
  ALL_STORY_TEMPLATES.map(template => [template.id, template]),
);
