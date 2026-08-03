import type { PlayerRecord } from '../types/db';
import type { Team } from '../types/domain';
import type { RandomSource } from './recruiting/random';
import { ROSTER } from './rosterConfig';

const OFFENSE_WEIGHT = 0.6;
const DEFENSE_WEIGHT = 0.4;
const OFFENSIVE_WEIGHTS: Record<string, number> = {
  qb: 40,
  rb: 10,
  wr: 25,
  te: 5,
  ol: 20,
};
const DEFENSIVE_WEIGHTS: Record<string, number> = {
  dl: 35,
  lb: 20,
  cb: 30,
  s: 15,
};
export const setStarters = (teams: Team[], players: PlayerRecord[]) => {
  players.forEach(player => {
    player.starter = false;
  });

  teams.forEach(team => {
    Object.entries(ROSTER).forEach(([position, config]) => {
      players
        .filter(
          player =>
            player.teamId === team.id &&
            player.pos === position,
        )
        .sort((left, right) => right.rating - left.rating)
        .slice(0, config.starters)
        .forEach(player => {
          player.starter = true;
        });
    });
  });
};

const calculateTeamRating = (
  players: PlayerRecord[],
  random: RandomSource,
) => {
  const weightedPlayers = players
    .filter(player => player.starter)
    .map(player => {
      const weight =
        OFFENSIVE_WEIGHTS[player.pos] ?? DEFENSIVE_WEIGHTS[player.pos] ?? 0;
      return {
        position: player.pos,
        weight,
        weightedRating: player.rating * weight,
      };
    });
  const calculateSide = (weights: Record<string, number>) => {
    const side = weightedPlayers.filter(player => player.position in weights);
    const totalWeight = side.reduce((sum, player) => sum + player.weight, 0);
    if (!totalWeight) return 0;
    return (
      side.reduce((sum, player) => sum + player.weightedRating, 0) / totalWeight
    );
  };
  const offense = calculateSide(OFFENSIVE_WEIGHTS) + random.normal(0, 3);
  const defense = calculateSide(DEFENSIVE_WEIGHTS) + random.normal(0, 3);

  return {
    offense: Math.round(offense),
    defense: Math.round(defense),
    overall: Math.round(
      offense * OFFENSE_WEIGHT + defense * DEFENSE_WEIGHT,
    ),
  };
};

export const recalculateTeamStrengths = (
  teams: Team[],
  players: PlayerRecord[],
  random: RandomSource,
) => {
  teams.forEach(team => {
    const ratings = calculateTeamRating(
      players.filter(player => player.teamId === team.id),
      random.fork(`team:${team.id}`),
    );
    team.offense = ratings.offense;
    team.defense = ratings.defense;
    team.rating = ratings.overall;
  });
};

export const recalculateTeamRatings = (
  teams: Team[],
  players: PlayerRecord[],
  random: RandomSource,
) => {
  recalculateTeamStrengths(teams, players, random);

  [...teams]
    .sort((left, right) => right.rating - left.rating)
    .forEach((team, index) => {
      team.ranking = index + 1;
      team.last_rank = index + 1;
    });
};
