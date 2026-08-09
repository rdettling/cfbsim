import type { Team } from '../types/domain';
import type { WeightedNameData } from '../types/recruiting';
import {
  RECRUIT_STAR_COUNTS,
  type RecruitStarCounts,
} from './recruiting/config';
import {
  generateName,
  generatePlayerRatings,
} from './recruiting/generation';
import type { RandomSource } from './utils/random';
import { ROSTER } from './rosterConfig';

interface BootstrapRecruit {
  rid?: number;
  first: string;
  last: string;
  pos: string;
  stars: number;
  state: string;
  rating_fr: number;
  rating_so: number;
  rating_jr: number;
  rating_sr: number;
  development_trait: number;
}

const PRESTIGE_BIAS = 8;
const PRESTIGE_EXPONENT = 1.25;
const RANDOMNESS = 20;

const recruit = (
  pos: string,
  stars: number,
  names: WeightedNameData,
  states: string[],
  stateWeights: number[],
  random: RandomSource,
): BootstrapRecruit => {
  const ratings = generatePlayerRatings(stars, random);
  return {
    ...generateName(pos, names, random),
    pos,
    stars,
    state:
      random.weightedChoice(
        states.map((state, index) => ({
          item: state,
          weight: stateWeights[index],
        })),
      ) ?? 'Unknown',
    rating_fr: ratings.fr,
    rating_so: ratings.so,
    rating_jr: ratings.jr,
    rating_sr: ratings.sr,
    development_trait: ratings.developmentTrait,
  };
};

const generatePool = (
  names: WeightedNameData,
  states: string[],
  stateWeights: number[],
  random: RandomSource,
  starCounts: RecruitStarCounts,
) => {
  const positions = Object.keys(ROSTER);
  const recruits: BootstrapRecruit[] = [];
  Object.entries(starCounts).forEach(([starKey, count]) => {
    for (let index = 0; index < count; index += 1) {
      const candidateRandom = random.fork(`candidate:${starKey}:${index}`);
      const position =
        candidateRandom.fork('position').weightedChoice(
          positions.map(item => ({
            item,
            weight: ROSTER[item].total,
          })),
        ) ?? 'qb';
      recruits.push(
        recruit(
          position,
          Number(starKey),
          names,
          states,
          stateWeights,
          candidateRandom,
        ),
      );
    }
  });
  return recruits;
};

const matchPosition = (
  recruits: BootstrapRecruit[],
  teams: Team[],
  needs: Record<number, Record<string, number>>,
  position: string,
  random: RandomSource,
) => {
  const assignments: Record<number, BootstrapRecruit[]> = Object.fromEntries(
    teams.map(team => [team.id, []]),
  );
  const preferences = new Map<number, number[]>();
  const nextPreference = new Map<number, number>();
  const queue = recruits.filter(candidate => {
    const eligible = teams
      .filter(
        team =>
          needs[team.id][position] > 0 && team.prestige >= candidate.stars,
      )
      .map(team => ({
        teamId: team.id,
        score:
          team.prestige ** PRESTIGE_EXPONENT * PRESTIGE_BIAS +
          random.fork(`preference:${candidate.rid}:${team.id}`).next() *
            RANDOMNESS,
      }))
      .sort((left, right) => right.score - left.score);
    if (!eligible.length) return false;
    preferences.set(candidate.rid!, eligible.map(item => item.teamId));
    nextPreference.set(candidate.rid!, 0);
    return true;
  });

  while (queue.length) {
    const candidate = queue.shift()!;
    const index = nextPreference.get(candidate.rid!)!;
    const teamId = preferences.get(candidate.rid!)?.[index];
    if (teamId === undefined) continue;
    nextPreference.set(candidate.rid!, index + 1);
    const teamRecruits = assignments[teamId];
    if (teamRecruits.length < needs[teamId][position]) {
      teamRecruits.push(candidate);
      continue;
    }
    const score = (item: BootstrapRecruit) =>
      item.stars * 100 + item.rating_fr;
    const worst = teamRecruits.reduce(
      (worstIndex, item, itemIndex) =>
        score(item) < score(teamRecruits[worstIndex]) ? itemIndex : worstIndex,
      0,
    );
    if (score(candidate) > score(teamRecruits[worst])) {
      queue.push(teamRecruits[worst]);
      teamRecruits[worst] = candidate;
    } else {
      queue.push(candidate);
    }
  }
  return assignments;
};

export const assignBootstrapClass = (
  teams: Team[],
  needs: Record<number, Record<string, number>>,
  names: WeightedNameData,
  states: string[],
  stateWeights: number[],
  random: RandomSource,
  starCounts: RecruitStarCounts = RECRUIT_STAR_COUNTS,
) => {
  const recruits = generatePool(
    names,
    states,
    stateWeights,
    random.fork('pool'),
    starCounts,
  );
  const assignments: Record<number, BootstrapRecruit[]> = Object.fromEntries(
    teams.map(team => [team.id, []]),
  );
  const remaining = Object.fromEntries(
    teams.map(team => [team.id, { ...needs[team.id] }]),
  );
  recruits.forEach((candidate, index) => {
    candidate.rid = index;
  });

  Object.keys(ROSTER).forEach(position => {
    const matches = matchPosition(
      recruits.filter(candidate => candidate.pos === position),
      teams,
      remaining,
      position,
      random.fork(`position:${position}`),
    );
    teams.forEach(team => {
      assignments[team.id].push(...matches[team.id]);
      remaining[team.id][position] -= matches[team.id].length;
    });
  });

  teams.forEach(team => {
    while (Object.values(remaining[team.id]).some(value => value > 0)) {
      const position = Object.keys(remaining[team.id])
        .filter(candidate => remaining[team.id][candidate] > 0)
        .sort(
          (left, right) =>
            remaining[team.id][right] - remaining[team.id][left],
        )[0];
      remaining[team.id][position] -= 1;
      assignments[team.id].push(
        recruit(
          position,
          1,
          names,
          states,
          stateWeights,
          random.fork(
            `fallback:${team.id}:${position}:${assignments[team.id].length}`,
          ),
        ),
      );
    }
  });
  return assignments;
};
