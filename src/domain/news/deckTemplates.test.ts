import { describe, expect, it } from 'vitest';
import {
  ALL_DECK_TEMPLATES,
  DECK_RULE_IDS,
  DECK_TEMPLATES,
  DECK_TEMPLATES_BY_ID,
  renderDeckTemplate,
  type DeckTemplate,
  validateDeckTemplates,
} from './deckTemplates';
import type { CopyTokens } from './templates';

const tokens: CopyTokens = {
  winner: 'No. 4 Winner',
  loser: 'No. 8 Loser',
  winner_name: 'Winner',
  loser_name: 'Loser',
  score: '31-24',
  margin: '7',
  deficit: '14',
  game_label: 'Rose Bowl',
  ot_label: 'overtime',
  rivalry_label: 'the rivalry',
  player: 'Alex Smith',
  player_summary: '175 rushing yards',
  clock: '1:35',
  win_probability: '12',
  rivalry_streak: '3',
  lead_changes: '1',
  lead_change_label: 'lead change',
  turnovers: '3',
  loser_score: '24',
};

const deck = (overrides: Partial<DeckTemplate> = {}): DeckTemplate => ({
  id: 'result.test.1',
  ruleId: 'result',
  text: '<winner_name> beat <loser_name> <score>.',
  requirements: [],
  syntaxFamily: 'winner_first',
  emphasizedFacts: ['result'],
  includesScore: true,
  ...overrides,
});

describe('league news deck template contracts', () => {
  it('registers every deck rule and stable ID', () => {
    expect(Object.keys(DECK_TEMPLATES).sort()).toEqual([...DECK_RULE_IDS].sort());
    expect(DECK_TEMPLATES_BY_ID.size).toBe(ALL_DECK_TEMPLATES.length);
    expect(() => validateDeckTemplates(ALL_DECK_TEMPLATES)).not.toThrow();
  });

  it('provides score-bearing structural variety for every rule', () => {
    for (const [rule, pool] of Object.entries(DECK_TEMPLATES)) {
      expect(pool.length, rule).toBeGreaterThanOrEqual(4);
      expect(new Set(pool.map(entry => entry.syntaxFamily)).size, rule).toBeGreaterThanOrEqual(3);
      expect(pool.some(entry => entry.includesScore), rule).toBe(true);
    }
  });

  it('rejects duplicate IDs, bad tokens, incomplete sentences, and score mismatches', () => {
    expect(() => validateDeckTemplates([deck(), deck()])).toThrow('Duplicate');
    expect(() => validateDeckTemplates([deck({ text: '<unknown> wins <score>.' })]))
      .toThrow('unsupported token');
    expect(() => validateDeckTemplates([deck({ text: '<winner_name> wins <score>' })]))
      .toThrow('sentence');
    expect(() => validateDeckTemplates([deck({ includesScore: false })]))
      .toThrow('score metadata');
  });

  it('renders sentence-case copy with singular lead-change grammar', () => {
    for (const entry of ALL_DECK_TEMPLATES) {
      expect(renderDeckTemplate(entry, tokens), entry.id).toMatch(/^[A-Z0-9].*\.$/);
    }
    for (const entry of DECK_TEMPLATES.lead_changes) {
      expect(renderDeckTemplate(entry, tokens), entry.id).not.toMatch(/\b1 times\b|\b1-change\b/);
    }
  });
});
