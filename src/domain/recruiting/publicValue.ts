import type { AiPublicProspect } from '../../types/recruiting';
import { AI_RECRUITING } from './config';

type RankedProspect = Pick<
  AiPublicProspect,
  'id' | 'nationalRank' | 'stars'
>;

export const buildPublicRecruitingValues = (
  prospects: RankedProspect[],
) => {
  const prospectsByStars = new Map<number, RankedProspect[]>();
  prospects.forEach(prospect => {
    const group = prospectsByStars.get(prospect.stars) ?? [];
    group.push(prospect);
    prospectsByStars.set(prospect.stars, group);
  });

  const values = new Map<number, number>();
  prospectsByStars.forEach(group => {
    const ordered = [...group].sort(
      (left, right) =>
        left.nationalRank - right.nationalRank || left.id - right.id,
    );
    ordered.forEach((prospect, index) => {
      const rankScore =
        ordered.length === 1
          ? 100
          : ((ordered.length - index - 1) / (ordered.length - 1)) * 100;
      values.set(
        prospect.id,
        prospect.stars *
          20 *
          AI_RECRUITING.publicValueStarsWeight +
          rankScore * AI_RECRUITING.publicValueRankWeight,
      );
    });
  });
  return values;
};
