import type { PlayerRecord } from '../types/db';
import type { Team } from '../types/domain';
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
const TEAM_STRENGTH_FLOOR = 25;
const TEAM_STRENGTH_ELITE_RAW = 90;
const TEAM_STRENGTH_ELITE_MAPPED = 96;
const TEAM_STRENGTH_CEILING = 99;
const TEAM_STRENGTH_EXPONENT = 2.15;

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const mapTeamStrength = (value: number) => {
  if (value <= TEAM_STRENGTH_FLOOR) return TEAM_STRENGTH_FLOOR;
  if (value >= TEAM_STRENGTH_CEILING) return TEAM_STRENGTH_CEILING;
  if (value <= TEAM_STRENGTH_ELITE_RAW) {
    const normalized = (
      (value - TEAM_STRENGTH_FLOOR) /
      (TEAM_STRENGTH_ELITE_RAW - TEAM_STRENGTH_FLOOR)
    );
    return TEAM_STRENGTH_FLOOR +
      (TEAM_STRENGTH_ELITE_MAPPED - TEAM_STRENGTH_FLOOR) *
        normalized ** TEAM_STRENGTH_EXPONENT;
  }
  return TEAM_STRENGTH_ELITE_MAPPED +
    ((value - TEAM_STRENGTH_ELITE_RAW) /
      (TEAM_STRENGTH_CEILING - TEAM_STRENGTH_ELITE_RAW)) *
      (TEAM_STRENGTH_CEILING - TEAM_STRENGTH_ELITE_MAPPED);
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
  team: Team,
  players: PlayerRecord[],
) => {
  const starters = players.filter(player => player.starter);
  const positionRating = (position: string) => {
    const ratings = starters
      .filter(player => player.pos === position)
      .map(player => player.rating);
    if (!ratings.length) {
      throw new Error(
        `Cannot calculate ratings for ${team.name}: missing starting ${position.toUpperCase()}.`,
      );
    }
    return average(ratings);
  };
  const calculateSide = (weights: Record<string, number>) => {
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    return entries.reduce(
      (sum, [position, weight]) => sum + positionRating(position) * weight,
      0,
    ) / totalWeight;
  };
  const rawOffense = calculateSide(OFFENSIVE_WEIGHTS);
  const rawDefense = calculateSide(DEFENSIVE_WEIGHTS);
  const rawOverall = Math.round(
    rawOffense * OFFENSE_WEIGHT + rawDefense * DEFENSE_WEIGHT,
  );
  const offense = mapTeamStrength(Math.round(rawOffense));
  const defense = mapTeamStrength(Math.round(rawDefense));

  return {
    offense: Math.round(offense),
    defense: Math.round(defense),
    overall: Math.round(mapTeamStrength(rawOverall)),
  };
};

export const recalculateTeamStrengths = (
  teams: Team[],
  players: PlayerRecord[],
) => {
  teams.forEach(team => {
    const ratings = calculateTeamRating(
      team,
      players.filter(player => player.teamId === team.id),
    );
    team.offense = ratings.offense;
    team.defense = ratings.defense;
    team.rating = ratings.overall;
  });
};

export const recalculateTeamRatings = (
  teams: Team[],
  players: PlayerRecord[],
) => {
  recalculateTeamStrengths(teams, players);

  [...teams]
    .sort((left, right) => right.rating - left.rating)
    .forEach((team, index) => {
      team.ranking = index + 1;
      team.last_rank = index + 1;
    });
};
