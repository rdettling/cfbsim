import type {
  AwardDisplayEntry,
  AwardDisplayPlacement,
} from '../../../types/awards';
import { AWARD_DEFINITIONS, getAwardDefinition } from '../awardDefinitions';

const DISPLAY_ORDER = new Map<string, number>(
  AWARD_DEFINITIONS.map((definition, index) => [definition.slug, index]),
);

export const createAwardDisplayEntry = (
  categorySlug: string,
  placements: AwardDisplayPlacement[],
): AwardDisplayEntry => {
  const definition = getAwardDefinition(categorySlug);
  return {
    categorySlug,
    categoryName: definition.name,
    categoryDescription: definition.description,
    group: definition.group,
    placements,
  };
};

export const sortAwardDisplayEntries = (awards: AwardDisplayEntry[]) =>
  awards.slice().sort((left, right) => {
    const leftOrder = DISPLAY_ORDER.get(left.categorySlug) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = DISPLAY_ORDER.get(right.categorySlug) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.categoryName.localeCompare(right.categoryName);
  });
