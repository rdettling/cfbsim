import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../utils/random';

describe('seeded recruiting randomness', () => {
  it('produces a stable sequence and stable keyed forks', () => {
    const random = createSeededRandom(12345);
    expect(Array.from({ length: 4 }, () => random.next())).toEqual([
      0.9797282677609473,
      0.3067522644996643,
      0.484205421525985,
      0.817934412509203,
    ]);
    expect(createSeededRandom(12345).fork('prospect:1').next()).toBe(
      createSeededRandom(12345).fork('prospect:1').next(),
    );
    expect(createSeededRandom(12345).fork('prospect:1').next()).not.toBe(
      createSeededRandom(12345).fork('prospect:2').next(),
    );
  });

  it('handles empty, weighted, and zero-weight choices', () => {
    const random = createSeededRandom(7);
    expect(random.weightedChoice([])).toBeNull();
    expect(random.weightedChoice([{ item: 'only', weight: 5 }])).toBe('only');
    expect(
      random.weightedChoice([
        { item: 'a', weight: 0 },
        { item: 'b', weight: 0 },
      ]),
    ).toMatch(/a|b/);
  });
});
