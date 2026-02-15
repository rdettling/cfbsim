import {
  DEFENSE_WEIGHT,
  DEFENSIVE_WEIGHTS,
  OFFENSE_WEIGHT,
  OFFENSIVE_WEIGHTS,
  RANDOM_VARIANCE_RANGE,
  RECRUIT_CLASS_YEARS,
  RECRUIT_POSITION_NEED_BIAS,
  RECRUIT_PRESTIGE_BIAS,
  RECRUIT_STAR_COUNTS,
  ROSTER,
} from './constants/playerConstants';
import { createRecruitProfile, LoadedNames } from './playerGeneration';
import { randomChoice, randomNormal, weightedChoice } from './random';
import type { PlayerRecord, TeamRecord } from '../db/schema';

export interface StateWeights {
  states: string[];
  weights: number[];
}

export const loadStateWeights = async (): Promise<StateWeights> => {
  const response = await fetch('/data/states.json');
  if (!response.ok) {
    throw new Error(`Failed to load states.json: ${response.status}`);
  }
  const data = await response.json();
  const states = Object.keys(data);
  const weights = Object.values(data) as number[];
  return { states, weights };
};

const buildClassTargets = (teams: TeamRecord[]) => {
  const baseTargets: Record<string, number> = {};
  Object.entries(ROSTER).forEach(([pos, config]) => {
    const perCycle = config.total / RECRUIT_CLASS_YEARS;
    baseTargets[pos] = Number.isInteger(perCycle) ? perCycle : Math.floor(perCycle) + 1;
  });

  const minPositions = Object.entries(ROSTER)
    .filter(([, config]) => config.total > 0 && config.total <= RECRUIT_CLASS_YEARS)
    .map(([pos]) => pos);

  minPositions.forEach(pos => {
    if (!baseTargets[pos]) baseTargets[pos] = 1;
  });

  const targets: Record<number, Record<string, number>> = {};
  teams.forEach(team => {
    targets[team.id] = { ...baseTargets };
  });

  return targets;
};

const getRosterCounts = (players: PlayerRecord[], teams: TeamRecord[]) => {
  const counts: Record<number, Record<string, number>> = {};
  teams.forEach(team => {
    counts[team.id] = {};
    Object.keys(ROSTER).forEach(pos => {
      counts[team.id][pos] = 0;
    });
  });

  players.forEach(player => {
    if (!player.active) return;
    const teamCounts = counts[player.team_id];
    if (teamCounts && Object.prototype.hasOwnProperty.call(teamCounts, player.pos)) {
      teamCounts[player.pos] += 1;
    }
  });

  return counts;
};

const buildTeamNeeds = (
  teams: TeamRecord[],
  rosterCounts: Record<number, Record<string, number>>
) => {
  const needs: Record<number, Record<string, number>> = {};
  teams.forEach(team => {
    const teamNeeds: Record<string, number> = {};
    const counts = rosterCounts[team.id] || {};
    Object.entries(ROSTER).forEach(([pos, config]) => {
      teamNeeds[pos] = Math.max(0, config.total - (counts[pos] || 0));
    });
    needs[team.id] = teamNeeds;
  });
  return needs;
};

const generateRecruitPool = (names: LoadedNames, stateWeights: StateWeights) => {
  const recruits: Array<any> = [];
  const positions = Object.keys(ROSTER);
  const positionWeights = positions.map(pos => ROSTER[pos].total);

  Object.entries(RECRUIT_STAR_COUNTS).forEach(([starsStr, count]) => {
    const stars = Number(starsStr);
    for (let i = 0; i < count; i += 1) {
      const pos = weightedChoice(positions, positionWeights);
      recruits.push(createRecruitProfile(pos, stars, names, stateWeights));
    }
  });

  return recruits;
};

const assignRecruitsToTeams = (
  teams: TeamRecord[],
  recruits: Array<any>,
  teamNeeds: Record<number, Record<string, number>>
) => {
  const classAssignments: Record<number, Array<any>> = {};
  teams.forEach(team => {
    classAssignments[team.id] = [];
  });

  const positionNeeds: Record<string, number> = {};
  Object.keys(ROSTER).forEach(pos => {
    positionNeeds[pos] = teams.reduce((sum, team) => sum + teamNeeds[team.id][pos], 0);
  });

  const recruitsByPos: Record<string, Array<any>> = {};
  Object.keys(ROSTER).forEach(pos => {
    recruitsByPos[pos] = [];
  });

  recruits.forEach(recruit => {
    recruitsByPos[recruit.pos].push(recruit);
  });

  Object.keys(ROSTER).forEach(pos => {
    recruitsByPos[pos].sort((a, b) => b.stars - a.stars || b.rating_fr - a.rating_fr);
  });

  const totalNeeds = Object.values(positionNeeds).reduce((sum, n) => sum + n, 0);
  if (totalNeeds === 0) return classAssignments;

  const positionOrder = Object.keys(ROSTER).sort((a, b) => {
    const needA = positionNeeds[a] || 0;
    const needB = positionNeeds[b] || 0;
    if (needA === needB) return 0;
    return needB - needA;
  });

  positionOrder.forEach(pos => {
    const recruitsForPos = recruitsByPos[pos];
    recruitsForPos.forEach(recruit => {
      const eligibleTeams = teams.filter(team => teamNeeds[team.id][pos] > 0);
      if (!eligibleTeams.length) return;

      const scores = eligibleTeams.map(team => {
        const prestigeScore = team.prestige ** 2 * RECRUIT_PRESTIGE_BIAS;
        const needScore = teamNeeds[team.id][pos] * RECRUIT_POSITION_NEED_BIAS;
        const score = prestigeScore + needScore + Math.random() * 5;
        return { teamId: team.id, score };
      });

      scores.sort((a, b) => b.score - a.score);
      const chosen = scores[0];
      classAssignments[chosen.teamId].push(recruit);
      teamNeeds[chosen.teamId][pos] -= 1;
    });
  });

  return classAssignments;
};

export const recruitingCycle = (
  teams: TeamRecord[],
  players: PlayerRecord[],
  names: LoadedNames,
  stateWeights: StateWeights,
  teamNeedsOverride?: Record<number, Record<string, number>>
) => {
  const recruits = generateRecruitPool(names, stateWeights);
  const rosterCounts = getRosterCounts(players, teams);
  const teamNeeds = teamNeedsOverride ?? buildTeamNeeds(teams, rosterCounts);
  const classAssignments = assignRecruitsToTeams(teams, recruits, teamNeeds);

  const newPlayers: PlayerRecord[] = [];
  Object.entries(classAssignments).forEach(([teamIdStr, teamRecruits]) => {
    const teamId = Number(teamIdStr);
    teamRecruits.forEach(recruit => {
      newPlayers.push({
        id: 0,
        info_id: '',
        team_id: teamId,
        first: recruit.first,
        last: recruit.last,
        year: 'fr',
        pos: recruit.pos,
        rating: recruit.rating_fr,
        rating_fr: recruit.rating_fr,
        rating_so: recruit.rating_so,
        rating_jr: recruit.rating_jr,
        rating_sr: recruit.rating_sr,
        stars: recruit.stars,
        development_trait: recruit.development_trait,
        starter: false,
        active: true,
      });
    });
  });

  return newPlayers;
};

export const applyRosterCuts = (players: PlayerRecord[], teams: TeamRecord[]) => {
  teams.forEach(team => {
    Object.entries(ROSTER).forEach(([pos, config]) => {
      const posPlayers = players.filter(
        player => player.active && player.team_id === team.id && player.pos === pos
      );
      if (posPlayers.length <= config.total) return;

      posPlayers.sort((a, b) => {
        if (b.rating_sr !== a.rating_sr) return b.rating_sr - a.rating_sr;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return a.year.localeCompare(b.year);
      });

      posPlayers.slice(config.total).forEach(player => {
        player.active = false;
        player.starter = false;
      });
    });
  });
};

export const setStarters = (players: PlayerRecord[]) => {
  players.forEach(player => {
    if (player.active) player.starter = false;
  });

  const sorted = players
    .filter(player => player.active)
    .sort((a, b) => {
      if (a.team_id !== b.team_id) return a.team_id - b.team_id;
      if (a.pos !== b.pos) return a.pos.localeCompare(b.pos);
      return b.rating - a.rating;
    });

  const starterCounts: Record<string, number> = {};
  sorted.forEach(player => {
    const key = `${player.team_id}:${player.pos}`;
    const limit = ROSTER[player.pos]?.starters ?? 0;
    const count = starterCounts[key] ?? 0;
    if (count >= limit) return;
    starterCounts[key] = count + 1;
    player.starter = true;
  });
};

export const calculateTeamRatings = (players: PlayerRecord[]) => {
  const starters = players.filter(player => player.starter);

  const weighted = starters.map(player => {
    const pos = player.pos;
    const rating = player.rating;
    const weight = OFFENSIVE_WEIGHTS[pos] ?? DEFENSIVE_WEIGHTS[pos] ?? 0;
    return { pos, rating, weight, weightedRating: rating * weight };
  });

  const offensivePlayers = weighted.filter(p => p.pos in OFFENSIVE_WEIGHTS);
  const defensivePlayers = weighted.filter(p => p.pos in DEFENSIVE_WEIGHTS);

  let offensiveRating = 0;
  if (offensivePlayers.length) {
    const totalWeight = offensivePlayers.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight > 0) {
      offensiveRating =
        offensivePlayers.reduce((sum, p) => sum + p.weightedRating, 0) / totalWeight;
    }
  }

  let defensiveRating = 0;
  if (defensivePlayers.length) {
    const totalWeight = defensivePlayers.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight > 0) {
      defensiveRating =
        defensivePlayers.reduce((sum, p) => sum + p.weightedRating, 0) / totalWeight;
    }
  }

  offensiveRating += randomNormal(
    (RANDOM_VARIANCE_RANGE[0] + RANDOM_VARIANCE_RANGE[1]) / 2,
    (RANDOM_VARIANCE_RANGE[1] - RANDOM_VARIANCE_RANGE[0]) / 6
  );
  defensiveRating += randomNormal(
    (RANDOM_VARIANCE_RANGE[0] + RANDOM_VARIANCE_RANGE[1]) / 2,
    (RANDOM_VARIANCE_RANGE[1] - RANDOM_VARIANCE_RANGE[0]) / 6
  );

  const overall = offensiveRating * OFFENSE_WEIGHT + defensiveRating * DEFENSE_WEIGHT;

  return {
    offense: Math.round(offensiveRating),
    defense: Math.round(defensiveRating),
    overall: Math.round(overall),
  };
};

export const calculateAllTeamRatings = (teams: TeamRecord[], players: PlayerRecord[]) => {
  teams.forEach(team => {
    const teamPlayers = players.filter(
      player => player.team_id === team.id && player.starter && player.active
    );
    const ratings = calculateTeamRatings(teamPlayers);
    team.offense = ratings.offense;
    team.defense = ratings.defense;
    team.rating = ratings.overall;
  });
};

export const initRosters = async (
  teams: TeamRecord[],
  infoId: string,
  names: LoadedNames,
  stateWeights: StateWeights
) => {
  const classTargets = buildClassTargets(teams);
  const players: PlayerRecord[] = [];

  let newPlayers = recruitingCycle(teams, players, names, stateWeights, classTargets);
  newPlayers.forEach(player => (player.info_id = infoId));
  players.push(...newPlayers);

  for (let i = 0; i < RECRUIT_CLASS_YEARS - 1; i += 1) {
    players.forEach(player => {
      if (!player.active) return;
      if (player.year === 'fr') {
        player.year = 'so';
        player.rating = player.rating_so;
      } else if (player.year === 'so') {
        player.year = 'jr';
        player.rating = player.rating_jr;
      } else if (player.year === 'jr') {
        player.year = 'sr';
        player.rating = player.rating_sr;
      }
    });

    newPlayers = recruitingCycle(teams, players, names, stateWeights, classTargets);
    newPlayers.forEach(player => (player.info_id = infoId));
    players.push(...newPlayers);
  }

  applyRosterCuts(players, teams);
  return players;
};
