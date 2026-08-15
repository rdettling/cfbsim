import type { AwardGroup } from '../../types/awards';

export const AWARD_DEFINITIONS = [
  {
    slug: 'heisman',
    name: 'Heisman Trophy',
    description: 'Most outstanding overall player',
    group: 'overall',
  },
  {
    slug: 'maxwell',
    name: 'Maxwell Award',
    description: 'College football player of the year',
    group: 'overall',
  },
  {
    slug: 'davey_obrien',
    name: "Davey O'Brien Award",
    description: 'Top quarterback',
    group: 'offense',
  },
  {
    slug: 'doak_walker',
    name: 'Doak Walker Award',
    description: 'Top running back',
    group: 'offense',
  },
  {
    slug: 'biletnikoff',
    name: 'Biletnikoff Award',
    description: 'Top wide receiver',
    group: 'offense',
  },
  {
    slug: 'mackey',
    name: 'John Mackey Award',
    description: 'Top tight end',
    group: 'offense',
  },
  {
    slug: 'bednarik',
    name: 'Bednarik Award',
    description: 'Defensive player of the year',
    group: 'defense',
  },
  {
    slug: 'nagurski',
    name: 'Bronko Nagurski Trophy',
    description: 'Outstanding defensive player',
    group: 'defense',
  },
  {
    slug: 'ted_hendricks',
    name: 'Ted Hendricks Award',
    description: 'Top defensive end',
    group: 'defense',
  },
  {
    slug: 'butkus',
    name: 'Butkus Award',
    description: 'Top linebacker',
    group: 'defense',
  },
  {
    slug: 'thorpe',
    name: 'Thorpe Award',
    description: 'Top defensive back',
    group: 'defense',
  },
  {
    slug: 'lou_groza',
    name: 'Lou Groza Award',
    description: 'Top placekicker',
    group: 'specialTeams',
  },
] as const satisfies readonly {
  slug: string;
  name: string;
  description: string;
  group: AwardGroup;
}[];

export type AwardSlug = (typeof AWARD_DEFINITIONS)[number]['slug'];
export type AwardDefinition = (typeof AWARD_DEFINITIONS)[number];

const DEFINITIONS_BY_SLUG = new Map<string, AwardDefinition>(
  AWARD_DEFINITIONS.map(definition => [definition.slug, definition]),
);

export const getAwardDefinition = (slug: string) => {
  const definition = DEFINITIONS_BY_SLUG.get(slug);
  if (!definition) {
    throw new Error(`Unknown award category: ${slug}.`);
  }
  return definition;
};

export const getAwardName = (slug: string) => getAwardDefinition(slug).name;
