import { describe, expect, it } from 'vitest';
import type { StoryTemplate } from './templates';
import {
  ALL_STORY_TEMPLATES,
  type CopyTokens,
  STORY_TEMPLATES,
  STORY_TEMPLATES_BY_ID,
  renderStoryTemplate,
  validateStoryTemplates,
} from './templates';

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

const template = (overrides: Partial<StoryTemplate> = {}): StoryTemplate => ({
  id: 'neutral.1',
  text: '<winner> beats <loser> <score>',
  gameTypes: ['regular_season'],
  requirements: [],
  syntaxFamily: 'winner_first',
  emphasizedFacts: ['result'],
  includesScore: true,
  ...overrides,
});

describe('league news template contracts', () => {
  it('registers every stable template ID exactly once', () => {
    expect(STORY_TEMPLATES_BY_ID.size).toBe(ALL_STORY_TEMPLATES.length);
    expect(() => validateStoryTemplates(ALL_STORY_TEMPLATES)).not.toThrow();
  });

  it('rejects duplicate IDs and incomplete contracts', () => {
    expect(() => validateStoryTemplates([template(), template()])).toThrow('Duplicate');
    expect(() => validateStoryTemplates([template({ gameTypes: [] })])).toThrow('no game types');
    expect(() => validateStoryTemplates([
      template({ gameTypes: ['unknown' as never] }),
    ])).toThrow('unsupported game type');
    expect(() => validateStoryTemplates([
      template({ requirements: ['unknown' as never] }),
    ])).toThrow('unsupported requirement');
  });

  it('enforces token requirements independently of template names', () => {
    expect(() => validateStoryTemplates([
      template({ text: '<player> leads <winner> over <loser>' }),
    ])).toThrow('featured_player');
    expect(() => validateStoryTemplates([
      template({ text: '<winner> wins <game_label>' }),
    ])).toThrow('game_label');
    expect(() => validateStoryTemplates([
      template({
        text: '<player> leads <winner> over <loser>',
        requirements: ['featured_player'],
        emphasizedFacts: ['result', 'featured_player'],
        includesScore: false,
      }),
    ])).not.toThrow();
  });

  it('provides structural variety in every headline pool', () => {
    const highVolume = new Set([
      'rankingUpset', 'comeback', 'overtime', 'rivalry', 'player', 'defense',
      'blowout', 'rankedLoser', 'rankedWinner', 'routine',
    ]);
    for (const [name, pool] of Object.entries(STORY_TEMPLATES)) {
      expect(pool.length, name).toBeGreaterThanOrEqual(highVolume.has(name) ? 6 : 4);
      expect(new Set(pool.map(entry => entry.syntaxFamily)).size, name)
        .toBeGreaterThanOrEqual(highVolume.has(name) ? 3 : 2);
    }
  });

  it('enforces score metadata and evidence-bound dramatic language', () => {
    expect(() => validateStoryTemplates([
      template({ includesScore: false }),
    ])).toThrow('score metadata');
    expect(() => validateStoryTemplates([
      template({ text: '<winner> shocks <loser> <score>' }),
    ])).toThrow('odds-upset language');
    expect(() => validateStoryTemplates([
      template({ text: '<winner> routs <loser> <score>' }),
    ])).toThrow('rout language');
    expect(() => validateStoryTemplates([
      template({ text: '<winner> survives <loser> <score>' }),
    ])).toThrow('close-game language');
    expect(() => validateStoryTemplates([
      template({ text: '<winner> stunned <loser> <score>' }),
    ])).toThrow('odds-upset language');
  });

  it('renders every catalog entry as a sentence-case headline', () => {
    for (const entry of ALL_STORY_TEMPLATES) {
      expect(renderStoryTemplate(entry, tokens), entry.id).toMatch(/^[A-Z0-9]/);
    }
  });
});
