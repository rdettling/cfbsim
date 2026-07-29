import { describe, expect, it } from 'vitest';
import {
  calculateRecruitingClassScore,
  displayRecruitingClassScore,
  recruitingClassContribution,
  recruitingClassSlotWeight,
} from './classScoring';

describe('recruiting class scoring', () => {
  it('assigns fixed convex values to star tiers', () => {
    expect(recruitingClassContribution(1, 1)).toBe(1);
    expect(recruitingClassContribution(2, 1)).toBe(4);
    expect(recruitingClassContribution(3, 1)).toBe(9);
    expect(recruitingClassContribution(4, 1)).toBe(16);
    expect(recruitingClassContribution(5, 1)).toBe(25);
  });

  it('applies stable diminishing returns after the top recruits', () => {
    expect(recruitingClassSlotWeight(1)).toBe(1);
    expect(recruitingClassSlotWeight(19)).toBeCloseTo(
      Math.exp(-0.5),
    );
    expect(recruitingClassSlotWeight(22)).toBeLessThan(
      recruitingClassSlotWeight(19),
    );
    expect(recruitingClassSlotWeight(19)).toBeLessThan(
      recruitingClassSlotWeight(1),
    );
  });

  it('scores identical star profiles equally regardless of input order', () => {
    const first = [{ stars: 3 }, { stars: 5 }, { stars: 4 }, { stars: 4 }];
    const second = [...first].reverse();

    expect(calculateRecruitingClassScore(first)).toBe(
      calculateRecruitingClassScore(second),
    );
  });

  it('rewards elite quality without letting marginal depth dominate', () => {
    const eliteUpgrade =
      calculateRecruitingClassScore([{ stars: 5 }]) -
      calculateRecruitingClassScore([{ stars: 4 }]);
    const twentiethTwoStar = recruitingClassContribution(2, 20);

    expect(eliteUpgrade).toBeGreaterThan(twentiethTwoStar);
    expect(twentiethTwoStar).toBeGreaterThan(0);
  });

  it('rounds only the displayed score', () => {
    const exact = calculateRecruitingClassScore([
      { stars: 5 },
      { stars: 4 },
    ]);

    expect(displayRecruitingClassScore(exact)).toBe(
      Math.round(exact * 10) / 10,
    );
    expect(exact).not.toBe(displayRecruitingClassScore(exact));
  });
});
