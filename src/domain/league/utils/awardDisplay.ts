import type {
  AwardDisplayEntry,
  AwardDisplayPlacement,
} from '../../../types/awards';
import type { Team } from '../../../types/domain';
import {
  SeasonMemoryDataIntegrityError,
  type SeasonMemory,
} from '../../../types/memory';
import { AWARD_DEFINITIONS, getAwardDefinition } from '../awardDefinitions';
import { formatAwardStatLine } from './awardStatLine';

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

export const projectSeasonAwardWinners = (
  memory: SeasonMemory,
  identitiesById: Map<number, { id: number; first: string; last: string; pos: string }>,
  teamsById: Map<number, Team>,
) => sortAwardDisplayEntries(memory.awards.map(entry => {
  const player = identitiesById.get(entry.playerId);
  const team = teamsById.get(entry.teamId);
  if (!player || !team) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${memory.year} references an invalid ${entry.categorySlug} winner.`,
    );
  }
  return createAwardDisplayEntry(entry.categorySlug, [{
    key: 'first',
    player: {
      id: entry.playerId,
      first: player.first,
      last: player.last,
      position: player.pos,
      teamName: team.name,
    },
    score: null,
    statLine: formatAwardStatLine(entry.stats),
  }]);
}));
