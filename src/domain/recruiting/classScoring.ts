export const RECRUITING_CLASS_SCORE_SIGMA = 18;

export const RECRUITING_STAR_VALUES: Record<number, number> = {
  1: 1,
  2: 4,
  3: 9,
  4: 16,
  5: 25,
};

export const recruitingClassSlotWeight = (slot: number) =>
  Math.exp(
    -0.5 *
      ((Math.max(1, slot) - 1) / RECRUITING_CLASS_SCORE_SIGMA) ** 2,
  );

export const recruitingClassContribution = (
  stars: number,
  slot: number,
) =>
  (RECRUITING_STAR_VALUES[stars] ?? 0) *
  recruitingClassSlotWeight(slot);

export const calculateRecruitingClassScore = (
  recruits: ReadonlyArray<{ stars: number }>,
) =>
  [...recruits]
    .sort((left, right) => right.stars - left.stars)
    .reduce(
      (score, recruit, index) =>
        score +
        recruitingClassContribution(recruit.stars, index + 1),
      0,
    );

export const displayRecruitingClassScore = (score: number) =>
  Math.round(score * 10) / 10;
