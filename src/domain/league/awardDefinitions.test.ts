import { describe, expect, it } from 'vitest';
import {
  AWARD_DEFINITIONS,
  getAwardDefinition,
} from './awardDefinitions';

describe('award definitions', () => {
  it('keeps the canonical display order', () => {
    expect(AWARD_DEFINITIONS.map(definition => definition.slug)).toEqual([
      'heisman',
      'maxwell',
      'davey_obrien',
      'doak_walker',
      'biletnikoff',
      'mackey',
      'bednarik',
      'nagurski',
      'ted_hendricks',
      'butkus',
      'thorpe',
      'lou_groza',
    ]);
  });

  it('rejects unknown persisted categories', () => {
    expect(() => getAwardDefinition('unknown_award')).toThrow(
      'Unknown award category: unknown_award.',
    );
  });
});
