import type { Team } from '../../types/domain';
import type {
  RankingNewsItem,
  RankingStoryAngle,
} from '../../types/news';
import type { RankingUpdate } from '../sim/rankings';
import { createSeededRandom } from '../utils/random';
import {
  scoreRankingNewsworthiness,
  type NewsworthinessBreakdown,
} from './newsworthiness';

export const RANKING_COPY_VERSION = 'v1';

export interface RankingStoryFacts {
  year: number;
  week: number;
  updates: RankingUpdate[];
  currentNumberOneId: number;
  formerNumberOneId: number;
  topFiveEntrantIds: number[];
  top25EntrantIds: number[];
  top25DropoutIds: number[];
  biggestRiserId: number | null;
  biggestFallerId: number | null;
}

export interface RankingStoryTrace {
  facts: RankingStoryFacts;
  primaryAngle: RankingStoryAngle;
  storylines: RankingStoryAngle[];
  headlineTemplateId: string;
  deckTemplateId: string;
  copyVersion: typeof RANKING_COPY_VERSION;
  newsworthiness: NewsworthinessBreakdown;
}

type CopyTemplate = { id: string; text: string };

const HEADLINES: Record<RankingStoryAngle, readonly CopyTemplate[]> = {
  new_number_one: [
    { id: 'rankings-v1-no1-01', text: '{currentNo1} takes over at No. 1' },
    { id: 'rankings-v1-no1-02', text: 'A new No. 1: {currentNo1} rises to the top' },
    { id: 'rankings-v1-no1-03', text: '{currentNo1} leads a reshaped Top 25' },
    { id: 'rankings-v1-no1-04', text: 'Top spot changes hands as {currentNo1} moves to No. 1' },
  ],
  top_five_shakeup: [
    { id: 'rankings-v1-top5-01', text: '{topFiveLead} break into a reshaped top five' },
    { id: 'rankings-v1-top5-02', text: 'Top five gets a makeover behind No. 1 {currentNo1}' },
    { id: 'rankings-v1-top5-03', text: 'New contenders arrive in the top five' },
    { id: 'rankings-v1-top5-04', text: '{topFiveCount} newcomers shake up the top five' },
  ],
  top_25_turnover: [
    { id: 'rankings-v1-top25-01', text: 'Top 25 turns over after a turbulent week' },
    { id: 'rankings-v1-top25-02', text: '{entrantLead} lead a wave of Top 25 arrivals' },
    { id: 'rankings-v1-top25-03', text: 'Poll welcomes {entrantCount} new teams after Week {week}' },
    { id: 'rankings-v1-top25-04', text: 'A changing Top 25 opens the door for {entrantLead}' },
  ],
  playoff_field: [
    { id: 'rankings-v1-field-01', text: 'No. 1 {currentNo1} leads the {fieldSize}-team playoff field' },
    { id: 'rankings-v1-field-02', text: 'Playoff set: {currentNo1} earns the top seed' },
    { id: 'rankings-v1-field-03', text: '{fieldSize}-team bracket unveiled with {currentNo1} at No. 1' },
    { id: 'rankings-v1-field-04', text: 'The playoff field runs through top-seeded {currentNo1}' },
  ],
};

const DECKS: Record<RankingStoryAngle, readonly CopyTemplate[]> = {
  new_number_one: [
    { id: 'rankings-v1-no1-deck-01', text: '{currentNo1} replaces {formerNo1} atop the poll after Week {week}.' },
    { id: 'rankings-v1-no1-deck-02', text: '{formerNo1} falls from the top spot as {currentNo1} moves to No. 1.' },
    { id: 'rankings-v1-no1-deck-03', text: 'The latest poll puts {currentNo1} first and {riserNote}.' },
    { id: 'rankings-v1-no1-deck-04', text: '{currentNo1} is the new No. 1 in a poll featuring {entrantCount} Top 25 arrivals.' },
  ],
  top_five_shakeup: [
    { id: 'rankings-v1-top5-deck-01', text: '{topFiveList} enter the top five in the latest poll.' },
    { id: 'rankings-v1-top5-deck-02', text: 'No. 1 {currentNo1} remains on top while {topFiveCount} teams enter the top five.' },
    { id: 'rankings-v1-top5-deck-03', text: 'The new poll moves {topFiveList} into the national top five.' },
    { id: 'rankings-v1-top5-deck-04', text: '{topFiveList} headline the biggest movement after Week {week}.' },
  ],
  top_25_turnover: [
    { id: 'rankings-v1-top25-deck-01', text: '{entrantList} enter as {dropoutCount} teams drop out of the Top 25.' },
    { id: 'rankings-v1-top25-deck-02', text: 'Week {week} sends {entrantCount} teams into the poll and {dropoutCount} out.' },
    { id: 'rankings-v1-top25-deck-03', text: '{entrantLead} is the highest of {entrantCount} Top 25 newcomers.' },
    { id: 'rankings-v1-top25-deck-04', text: 'The latest rankings feature {turnoverCount} combined entries and exits.' },
  ],
  playoff_field: [
    { id: 'rankings-v1-field-deck-01', text: '{fieldList} hold the first four seeds in the {fieldSize}-team bracket.' },
    { id: 'rankings-v1-field-deck-02', text: '{currentNo1} earns the top seed as the final {fieldSize}-team field is revealed.' },
    { id: 'rankings-v1-field-deck-03', text: 'The selection committee places {fieldList} at the front of the playoff field.' },
    { id: 'rankings-v1-field-deck-04', text: 'Conference championship week ends with {currentNo1} first in the {fieldSize}-team bracket.' },
  ],
};

const validateRankingCopyCatalog = () => {
  const templates = [...Object.values(HEADLINES).flat(), ...Object.values(DECKS).flat()];
  const ids = new Set<string>();
  for (const angle of Object.keys(HEADLINES) as RankingStoryAngle[]) {
    if (HEADLINES[angle].length < 4 || DECKS[angle].length < 4) {
      throw new Error(`Ranking angle ${angle} requires four headline and deck variants.`);
    }
  }
  templates.forEach(template => {
    if (ids.has(template.id)) throw new Error(`Duplicate rankings template ID ${template.id}.`);
    if (template.text.includes('!')) throw new Error(`Rankings template ${template.id} uses unsupported punctuation.`);
    ids.add(template.id);
  });
};

validateRankingCopyCatalog();

const joinNames = (names: string[]) =>
  names.length <= 1
    ? names[0] ?? ''
    : names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

const render = (template: CopyTemplate, tokens: Record<string, string | number>) =>
  template.text.replace(/\{([A-Za-z0-9]+)\}/g, (_match, token: string) => {
    const value = tokens[token];
    if (value === undefined) throw new Error(`Missing rankings copy token: ${token}`);
    return String(value);
  });

const unique = (ids: readonly (number | null)[]) =>
  [...new Set(ids.filter((id): id is number => id !== null))];

export const extractRankingStoryFacts = ({
  year,
  week,
  updates,
}: {
  year: number;
  week: number;
  updates: RankingUpdate[];
}): RankingStoryFacts => {
  if (!updates.length) throw new Error('A rankings release requires poll updates.');
  const byCurrent = [...updates].sort((a, b) => a.currentRank - b.currentRank);
  const byPrevious = [...updates].sort((a, b) => a.previousRank - b.previousRank);
  const risers = [...updates].sort((a, b) =>
    (b.previousRank - b.currentRank) - (a.previousRank - a.currentRank) ||
    a.currentRank - b.currentRank,
  );
  const fallers = [...updates].sort((a, b) =>
    (b.currentRank - b.previousRank) - (a.currentRank - a.previousRank) ||
    a.previousRank - b.previousRank,
  );
  return {
    year,
    week,
    updates,
    currentNumberOneId: byCurrent[0].teamId,
    formerNumberOneId: byPrevious[0].teamId,
    topFiveEntrantIds: byCurrent
      .filter(update => update.currentRank <= 5 && update.previousRank > 5)
      .map(update => update.teamId),
    top25EntrantIds: byCurrent
      .filter(update => update.currentRank <= 25 && update.previousRank > 25)
      .map(update => update.teamId),
    top25DropoutIds: byPrevious
      .filter(update => update.previousRank <= 25 && update.currentRank > 25)
      .map(update => update.teamId),
    biggestRiserId: risers[0].previousRank > risers[0].currentRank ? risers[0].teamId : null,
    biggestFallerId: fallers[0].currentRank > fallers[0].previousRank ? fallers[0].teamId : null,
  };
};

export const rankingStorylines = (facts: RankingStoryFacts): RankingStoryAngle[] => {
  const lines: RankingStoryAngle[] = [];
  if (facts.currentNumberOneId !== facts.formerNumberOneId) lines.push('new_number_one');
  if (facts.topFiveEntrantIds.length >= 2) lines.push('top_five_shakeup');
  if (facts.top25EntrantIds.length + facts.top25DropoutIds.length >= 5) {
    lines.push('top_25_turnover');
  }
  return lines;
};

const buildTokens = (
  facts: RankingStoryFacts,
  teamsById: Map<number, Team>,
  fieldIds: number[] = [],
) => {
  const name = (id: number) => {
    const team = teamsById.get(id);
    if (!team) throw new Error(`Rankings story references unknown team ${id}.`);
    return team.name;
  };
  const riser = facts.biggestRiserId === null
    ? 'the rest of the Top 25 settles behind it'
    : `${name(facts.biggestRiserId)} posts the week's biggest rise`;
  return {
    currentNo1: name(facts.currentNumberOneId),
    formerNo1: name(facts.formerNumberOneId),
    topFiveLead: name(facts.topFiveEntrantIds[0] ?? facts.currentNumberOneId),
    topFiveList: joinNames(facts.topFiveEntrantIds.map(name)),
    topFiveCount: facts.topFiveEntrantIds.length,
    entrantLead: name(facts.top25EntrantIds[0] ?? facts.currentNumberOneId),
    entrantList: joinNames(facts.top25EntrantIds.map(name)),
    entrantCount: facts.top25EntrantIds.length,
    dropoutCount: facts.top25DropoutIds.length,
    turnoverCount: facts.top25EntrantIds.length + facts.top25DropoutIds.length,
    fieldSize: fieldIds.length,
    fieldList: joinNames(fieldIds.slice(0, Math.min(4, fieldIds.length)).map(name)),
    riserNote: riser,
    week: facts.week,
  };
};

const generate = ({
  facts,
  teamsById,
  primaryAngle,
  storylines,
  featuredTeamIds,
  fieldIds = [],
}: {
  facts: RankingStoryFacts;
  teamsById: Map<number, Team>;
  primaryAngle: RankingStoryAngle;
  storylines: RankingStoryAngle[];
  featuredTeamIds: number[];
  fieldIds?: number[];
}) => {
  const random = createSeededRandom(facts.year * 100 + facts.week)
    .fork(`ranking-news:${RANKING_COPY_VERSION}`);
  const headlinePool = HEADLINES[primaryAngle];
  const deckPool = DECKS[primaryAngle];
  const headline = headlinePool[random.fork('headline').int(0, headlinePool.length - 1)];
  const deck = deckPool[random.fork('deck').int(0, deckPool.length - 1)];
  const tokens = buildTokens(facts, teamsById, fieldIds);
  const ranksById = new Map(facts.updates.map(update => [update.teamId, update.currentRank]));
  const newsworthiness = scoreRankingNewsworthiness({
    playoffField: primaryAngle === 'playoff_field',
    featuredRanks: featuredTeamIds.map(id => ranksById.get(id) ?? teamsById.get(id)?.ranking ?? 999),
    newNumberOne: storylines.includes('new_number_one'),
    topFiveShakeup: storylines.includes('top_five_shakeup'),
    top25Turnover: storylines.includes('top_25_turnover'),
  });
  const item: RankingNewsItem = {
    id: `rankings:${facts.year}:${facts.week}`,
    type: 'rankings',
    year: facts.year,
    week: facts.week,
    featuredTeamIds,
    headline: render(headline, tokens),
    deck: render(deck, tokens),
    primaryAngle,
    storylines,
    importance: newsworthiness.total,
  };
  return {
    item,
    trace: {
      facts,
      primaryAngle,
      storylines,
      headlineTemplateId: headline.id,
      deckTemplateId: deck.id,
      copyVersion: RANKING_COPY_VERSION,
      newsworthiness,
    } satisfies RankingStoryTrace,
  };
};

export const generateWeeklyRankingNews = ({
  year,
  week,
  updates,
  teamsById,
}: {
  year: number;
  week: number;
  updates: RankingUpdate[];
  teamsById: Map<number, Team>;
}) => {
  if (week < 1 || week > 14 || !updates.length) return null;
  const facts = extractRankingStoryFacts({ year, week, updates });
  const storylines = rankingStorylines(facts);
  const primaryAngle = storylines[0];
  if (!primaryAngle) return null;
  const featuredTeamIds = unique([
    facts.currentNumberOneId,
    facts.formerNumberOneId,
    ...facts.topFiveEntrantIds,
    ...facts.top25EntrantIds,
    ...facts.top25DropoutIds,
    facts.biggestRiserId,
    facts.biggestFallerId,
  ]);
  return generate({ facts, teamsById, primaryAngle, storylines, featuredTeamIds });
};

export const generatePlayoffFieldNews = ({
  year,
  week,
  selectedTeamIds,
  teamsById,
}: {
  year: number;
  week: number;
  selectedTeamIds: number[];
  teamsById: Map<number, Team>;
}) => {
  if (![2, 4, 12].includes(selectedTeamIds.length)) {
    throw new Error(`Unsupported playoff field size ${selectedTeamIds.length}.`);
  }
  const updates = [...teamsById.values()].map(team => ({
    teamId: team.id,
    previousRank: team.last_rank ?? team.ranking,
    currentRank: team.ranking,
    record: team.record,
    pollScore: team.poll_score,
  }));
  const facts = extractRankingStoryFacts({ year, week, updates });
  return generate({
    facts,
    teamsById,
    primaryAngle: 'playoff_field',
    storylines: ['playoff_field'],
    featuredTeamIds: [...selectedTeamIds],
    fieldIds: selectedTeamIds,
  });
};
