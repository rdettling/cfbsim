import type { PreviewStoryAngle } from '../../types/news';
import { createSeededRandom } from '../utils/random';

export const PREVIEW_COPY_VERSION = 'v1';

export interface PreviewTemplate {
  id: string;
  text: string;
}

export const POLL_HEADLINES: readonly PreviewTemplate[] = [
  { id: 'preview-v1-poll-01', text: 'No. 1 {topTeam} leads the preseason poll' },
  { id: 'preview-v1-poll-02', text: '{topTeam} opens the season atop the poll' },
  { id: 'preview-v1-poll-03', text: 'Preseason rankings start with {topTeam} at No. 1' },
  { id: 'preview-v1-poll-04', text: 'The season starts with {topTeam} at No. 1' },
];

export const POLL_DECKS: readonly PreviewTemplate[] = [
  { id: 'preview-v1-poll-deck-01', text: '{topGroup} lead the preseason rankings.' },
  { id: 'preview-v1-poll-deck-02', text: '{topTeam} sets the early pace ahead of {nextTeams}.' },
  { id: 'preview-v1-poll-deck-03', text: 'The first poll places {topTeam} first, followed by {nextTeams}.' },
  { id: 'preview-v1-poll-deck-04', text: '{topTeam} carries the No. 1 ranking into opening weekend.' },
];

export const OUTLOOK_HEADLINES: readonly PreviewTemplate[] = [
  { id: 'preview-v1-outlook-01', text: '{topTeam} sets the pace in the national title chase' },
  { id: 'preview-v1-outlook-02', text: 'Title race opens with {topTeam} at the front' },
  { id: 'preview-v1-outlook-03', text: 'The national outlook starts with No. 1 {topTeam}' },
  { id: 'preview-v1-outlook-04', text: '{topTeam} leads the first look at the playoff race' },
];

export const DEFENSE_HEADLINES: readonly PreviewTemplate[] = [
  { id: 'preview-v1-defense-01', text: '{champion} begins its national title defense' },
  { id: 'preview-v1-defense-02', text: 'The chase starts with champion {champion} back in focus' },
  { id: 'preview-v1-defense-03', text: '{champion} returns with a championship to defend' },
  { id: 'preview-v1-defense-04', text: 'National champion {champion} faces a new title chase' },
];

export const OUTLOOK_DECKS: readonly PreviewTemplate[] = [
  { id: 'preview-v1-outlook-deck-01', text: '{contenders} enter the season as the highest-ranked title contenders.' },
  { id: 'preview-v1-outlook-deck-02', text: 'The opening poll puts {contenders} at the front of the national race.' },
  { id: 'preview-v1-outlook-deck-03', text: '{topTeam} leads a contender group that includes {nextTeams}.' },
  { id: 'preview-v1-outlook-deck-04', text: 'The playoff picture begins with {contenders} occupying the highest spots.' },
];

export const DEFENSE_DECKS: readonly PreviewTemplate[] = [
  { id: 'preview-v1-defense-deck-01', text: '{champion} returns from last season’s championship as {contenders} lead the new poll.' },
  { id: 'preview-v1-defense-deck-02', text: 'The reigning champion opens a new race headed by {contenders}.' },
  { id: 'preview-v1-defense-deck-03', text: '{champion} carries the crown into a season with {topTeam} ranked No. 1.' },
  { id: 'preview-v1-defense-deck-04', text: 'A new title chase begins after {champion} won last season’s national championship.' },
];

export const MATCHUP_HEADLINES: readonly PreviewTemplate[] = [
  { id: 'preview-v1-matchup-01', text: '{teamA} and {teamB} meet in the Week {openingWeek} spotlight' },
  { id: 'preview-v1-matchup-02', text: 'Opening weekend centers on {teamA} vs. {teamB}' },
  { id: 'preview-v1-matchup-03', text: '{teamA} faces {teamB} in a marquee opener' },
  { id: 'preview-v1-matchup-04', text: 'Week {openingWeek} brings a {teamA}-{teamB} showdown' },
];

export const MATCHUP_DECKS: readonly PreviewTemplate[] = [
  { id: 'preview-v1-matchup-deck-01', text: '{favorite} enters the matchup with a {winProbability}% pregame win probability.' },
  { id: 'preview-v1-matchup-deck-02', text: 'The opening-week matchup pairs {teamA} with {teamB}.' },
  { id: 'preview-v1-matchup-deck-03', text: '{teamA} and {teamB} headline the first full week of the season.' },
  { id: 'preview-v1-matchup-deck-04', text: 'The national schedule begins with {teamA} taking on {teamB}.' },
];

export const RIVALRY_DECKS: readonly PreviewTemplate[] = [
  { id: 'preview-v1-rivalry-deck-01', text: '{teamA} and {teamB} renew their rivalry in the opening week.' },
  { id: 'preview-v1-rivalry-deck-02', text: 'The rivalry opens a new chapter with {favorite} holding a {winProbability}% pregame win probability.' },
  { id: 'preview-v1-rivalry-deck-03', text: 'Opening weekend brings the rivalry between {teamA} and {teamB} back to center stage.' },
  { id: 'preview-v1-rivalry-deck-04', text: '{teamA}-{teamB} gives Week {openingWeek} a rivalry showcase.' },
];

const allTemplates = [
  ...POLL_HEADLINES,
  ...POLL_DECKS,
  ...OUTLOOK_HEADLINES,
  ...DEFENSE_HEADLINES,
  ...OUTLOOK_DECKS,
  ...DEFENSE_DECKS,
  ...MATCHUP_HEADLINES,
  ...MATCHUP_DECKS,
  ...RIVALRY_DECKS,
];

if (new Set(allTemplates.map(template => template.id)).size !== allTemplates.length) {
  throw new Error('Preseason news template IDs must be unique.');
}

export const PREVIEW_TEMPLATES_BY_ID = new Map(
  allTemplates.map(template => [template.id, template]),
);

export const renderPreviewTemplate = (
  template: PreviewTemplate,
  tokens: Record<string, string | number>,
) => template.text.replace(/\{([A-Za-z0-9]+)\}/g, (_match, token: string) => {
  const value = tokens[token];
  if (value === undefined) throw new Error(`Missing preseason news token: ${token}`);
  return String(value);
});

export const selectPreviewTemplate = (
  year: number,
  angle: PreviewStoryAngle,
  kind: 'headline' | 'deck',
  templates: readonly PreviewTemplate[],
) => templates[createSeededRandom(year)
  .fork(`preview:${PREVIEW_COPY_VERSION}:${angle}:${kind}`)
  .int(0, templates.length - 1)];
