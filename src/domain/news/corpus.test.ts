import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ConferencesData, TeamsData, SeasonData } from '../../types/baseData';
import type { NamesData } from '../../types/baseData';
import { normalizeRivalriesData } from '../rivalryData';
import { GAME_STORY_ANGLES, GAME_TYPES } from '../../types/news';
import { evaluateNewsAudit } from './audit';
import { storyTemplateSupportsEntry } from './auditValidation';
import {
  generateNewsAuditCorpus,
  type NewsAuditCorpusData,
} from './corpus';
import { createSeededRandom, withSeededMathRandom } from '../utils/random';
import { deriveEditorialIdentity } from './policy';
import { STORY_TEMPLATES_BY_ID } from './templates';

const readJson = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

const teamsData = readJson<TeamsData>('../../../public/data/teams.json');
const data: NewsAuditCorpusData = {
  yearData: readJson<SeasonData>('../../../public/data/seasons/2026.json'),
  teamsData,
  conferencesData: readJson<ConferencesData>('../../../public/data/conferences.json'),
  names: readJson<NamesData>('../../../public/data/names.json'),
  states: readJson<Record<string, number>>('../../../public/data/states.json'),
  rivalries: normalizeRivalriesData(
    readJson<unknown>('../../../public/data/rivalries.json'),
    new Set(Object.keys(teamsData.teams)),
  ),
  bettingOdds: readJson<unknown>('../../../public/data/betting_odds.json'),
};

const configuration = {
  seed: 20260809,
  seeds: 1,
  seasons: 2,
  replaySeeds: 1,
  startYear: 2026,
};

describe('news editorial audit corpus', () => {
  it('is reproducible, varies by seed, covers the system, and carries series context', () => {
    const originalRandom = Math.random;
    const first = generateNewsAuditCorpus(data, configuration);
    expect(Math.random).toBe(originalRandom);
    const replay = generateNewsAuditCorpus(data, configuration);
    const different = generateNewsAuditCorpus(data, { ...configuration, seed: 20260810 });
    const firstSummary = evaluateNewsAudit(first, configuration);
    expect(evaluateNewsAudit(replay, configuration).checksum).toBe(firstSummary.checksum);
    expect(evaluateNewsAudit(different, { ...configuration, seed: 20260810 }).checksum)
      .not.toBe(firstSummary.checksum);
    const copyOnlyChange = structuredClone(first);
    copyOnlyChange.forEach(entry => {
      entry.item.headline = `Changed ${entry.item.id}`;
      entry.item.deck = `Changed ${entry.item.id}.`;
    });
    expect(evaluateNewsAudit(copyOnlyChange, configuration).editorialOutcomeChecksum)
      .toBe(firstSummary.editorialOutcomeChecksum);
    const importanceOnlyChange = structuredClone(first);
    importanceOnlyChange.forEach(entry => {
      entry.item.importance += 100;
    });
    expect(evaluateNewsAudit(importanceOnlyChange, configuration).newsContentChecksum)
      .toBe(firstSummary.newsContentChecksum);
    expect(firstSummary.violations).toEqual([]);
    expect(first.filter(entry => entry.source === 'scenario').every(entry => {
      const facts = entry.trace.facts;
      return facts.upsetEvidence === deriveEditorialIdentity({
        winnerRank: facts.winnerRank,
        loserRank: facts.loserRank,
        winnerWinProbability: facts.winnerWinProbability,
      }).upsetEvidence;
    })).toBe(true);
    expect(new Set(first.filter(entry => entry.source === 'simulation').map(entry => entry.trace.facts.gameType)))
      .toEqual(new Set(GAME_TYPES));
    expect(new Set(first.filter(entry => entry.source === 'scenario').map(entry => entry.item.primaryAngle)))
      .toEqual(new Set(GAME_STORY_ANGLES));
    expect(first.some(entry =>
      entry.source === 'simulation' &&
      entry.season === 1 &&
      entry.trace.facts.priorMeetings > 0,
    )).toBe(true);
    expect(firstSummary.metrics.rankingReferencesOutsideTop25).toEqual([]);
    expect(firstSummary.metrics.dimensionScores).toEqual(expect.objectContaining({
      consequence: expect.objectContaining({ min: 10 }),
      national_relevance: expect.any(Object),
      drama: expect.any(Object),
    }));
    expect(firstSummary.metrics.frontPageComposition.topFiveSlots).toBeGreaterThan(0);
    for (const ids of Object.values(firstSummary.metrics.crossSeedHeadlineDuplicates)) {
      expect(new Set(ids.map(id => id.split(':').slice(1, 3).join(':'))).size).toBeGreaterThan(1);
    }
    expect(first.filter(entry => entry.trace.facts.gameType === 'bowl'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ item: expect.objectContaining({ primaryAngle: 'bowl_result' }) }),
      ]));
    expect(first.filter(entry => entry.trace.facts.gameType === 'bowl').every(entry =>
      entry.item.headline.includes(entry.trace.tokens.game_label),
    )).toBe(true);
    expect(first.filter(entry => entry.source === 'simulation').every(entry => {
      const type = entry.trace.facts.gameType;
      if (type === 'national_championship' || type === 'conference_championship') {
        return entry.item.primaryAngle === 'championship';
      }
      if (type.startsWith('playoff_')) return entry.item.primaryAngle === 'playoff_advance';
      if (type === 'bowl') return entry.item.primaryAngle === 'bowl_result';
      return true;
    })).toBe(true);
    const bowlHybrids = first.filter(entry => entry.auditId.startsWith('scenario:bowl_'));
    expect(bowlHybrids.length).toBeGreaterThanOrEqual(8);
    expect(bowlHybrids.every(entry =>
      entry.item.primaryAngle === 'bowl_result' &&
      STORY_TEMPLATES_BY_ID.get(entry.trace.templateId)?.gameTypes.includes('bowl') &&
      entry.item.headline.includes(entry.trace.tokens.game_label),
    )).toBe(true);
    expect(new Set(first
      .filter(entry => entry.source === 'scenario')
      .flatMap(entry => entry.trace.facts.featuredPerformance?.qualifyingFacts ?? [])))
      .toEqual(new Set([
        'passing_yards_350',
        'passing_touchdowns_4',
        'rushing_yards_175',
        'rushing_touchdowns_3',
        'receiving_yards_175',
        'receiving_touchdowns_3',
        'tackles_15',
        'sacks_3',
        'interceptions_2',
        'field_goals_made_4',
      ]));
    const overtimeScenario = first.find(entry => entry.auditId === 'scenario:overtime')!;
    expect(storyTemplateSupportsEntry({
      id: 'neutral.1',
      text: '<winner> wins in <ot_label>',
      gameTypes: ['regular_season'],
      requirements: ['overtime'],
      syntaxFamily: 'winner_first',
      emphasizedFacts: ['result', 'overtime'],
      includesScore: false,
    }, overtimeScenario)).toBe(true);
    expect(storyTemplateSupportsEntry({
      id: 'neutral.2',
      text: '<winner> wins',
      gameTypes: ['regular_season'],
      requirements: ['comeback'],
      syntaxFamily: 'winner_first',
      emphasizedFacts: ['result', 'comeback'],
      includesScore: false,
    }, overtimeScenario)).toBe(false);
    const invalid = structuredClone(first);
    invalid[0].item.importance += 1;
    invalid[1].trace.newsworthiness.dimensions.national_relevance += 1;
    expect(evaluateNewsAudit(invalid, configuration).violations)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_editorial_trace' }),
      ]));

    const invalidEditorial = structuredClone(first);
    invalidEditorial.find(entry => entry.auditId === 'scenario:rank_26_boundary')!.item.headline += ' No. 26';
    invalidEditorial.find(entry => entry.auditId === 'scenario:bowl_result')!.item.headline = 'Generic postseason win';
    invalidEditorial.find(entry => entry.auditId === 'scenario:odds_only_upset')!.trace.facts.upsetEvidence = 'ranking';
    invalidEditorial.find(entry => entry.auditId === 'scenario:standout_qb')!
      .trace.facts.featuredPerformance!.qualifyingFacts = [];
    invalidEditorial.find(entry => entry.auditId === 'scenario:routine_result')!
      .trace.templateId = 'missing.1';
    invalidEditorial.find(entry => entry.auditId === 'scenario:overtime')!
      .trace.deckTemplateId = 'missing.deck';
    const wrongRankComponent = invalidEditorial.find(
      entry => entry.auditId === 'scenario:rank_25_identity',
    )!.trace.newsworthiness.components.find(component =>
      component.id.startsWith('rank_participation:'),
    )!;
    wrongRankComponent.id = 'rank_participation:1_5';
    const missingScore = invalidEditorial.find(entry => entry.auditId === 'scenario:late_decider')!;
    missingScore.item.headline = 'Ohio State wins late';
    missingScore.item.deck = 'Ohio State took the lead for good.';
    expect(evaluateNewsAudit(invalidEditorial, configuration).violations.map(violation => violation.code))
      .toEqual(expect.arrayContaining([
        'ranking_reference_outside_top_25',
        'unnamed_bowl_headline',
        'invalid_upset_identity',
        'ineligible_featured_performance',
        'missing_final_score',
        'unsupported_factual_claim',
      ]));
  }, 30_000);

  it('restores Math.random after a failed seeded run', () => {
    const originalRandom = Math.random;
    expect(() => withSeededMathRandom(createSeededRandom(1), () => {
      throw new Error('audit failure');
    })).toThrow('audit failure');
    expect(Math.random).toBe(originalRandom);
  });
});
