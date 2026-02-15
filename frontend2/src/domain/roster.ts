import type { Info, Team } from '../types/domain';
import type { LeagueState } from '../types/league';
import type { Recruit } from '../types/roster';
import { getNamesData, getStatesData } from '../db/baseData';
import { savePlayers, getPlayersByTeam, clearPlayers } from '../db/simRepo';
import type { PlayerRecord } from '../types/db';

const STARS_BASE: Record<number, number> = { 1: 30, 2: 40, 3: 50, 4: 60, 5: 70 };
const BASE_DEVELOPMENT = 4;
const RATING_STD_DEV = 5;
const DEVELOPMENT_STD_DEV = 4;
const RANDOM_VARIANCE_RANGE: [number, number] = [5, 9];

const RECRUIT_CLASS_YEARS = 4;
const RECRUIT_STAR_COUNTS: Record<number, number> = { 5: 32, 4: 340, 3: 2000, 2: 500 };
const RECRUIT_PRESTIGE_BIAS = 8;
const RECRUIT_PRESTIGE_EXPONENT = 1.25;
const RECRUIT_RANDOMNESS = 20;

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

export const ROSTER: Record<string, { starters: number; total: number }> = {
  qb: { starters: 1, total: 4 },
  rb: { starters: 2, total: 5 },
  wr: { starters: 3, total: 7 },
  te: { starters: 1, total: 5 },
  ol: { starters: 5, total: 12 },
  dl: { starters: 4, total: 9 },
  lb: { starters: 3, total: 7 },
  cb: { starters: 2, total: 6 },
  s: { starters: 2, total: 5 },
  k: { starters: 1, total: 2 },
  p: { starters: 1, total: 2 },
};

export const POSITION_ORDER = Object.keys(ROSTER);

const gaussian = (mean: number, stdDev: number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stdDev + mean;
};

const weightedChoice = <T,>(items: Array<{ item: T; weight: number }>) => {
  const total = items.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)]?.item ?? null;
  let threshold = Math.random() * total;
  for (const entry of items) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry.item;
  }
  return items[items.length - 1]?.item ?? null;
};

const normalizeCounters = (league: LeagueState) => {
  if (!league.idCounters) {
    league.idCounters = { game: 1, drive: 1, play: 1, gameLog: 1, player: 1 };
  }
  if (!league.idCounters.player) league.idCounters.player = 1;
  return league.idCounters;
};

const nextPlayerId = (league: LeagueState) => {
  const counters = normalizeCounters(league);
  const value = counters.player ?? 1;
  counters.player = value + 1;
  return value;
};

const buildRatings = (baseRating: number) => {
  const variance = gaussian(0, RATING_STD_DEV);
  const fr = Math.max(1, baseRating + variance);
  const developmentTrait = Math.floor(Math.random() * 5) + 1;
  const growth = BASE_DEVELOPMENT + developmentTrait + gaussian(0, DEVELOPMENT_STD_DEV);
  const so = Math.min(Math.max(fr + growth * 0.6, fr), 99);
  const jr = Math.min(Math.max(fr + growth * 0.9, so), 99);
  const sr = Math.min(Math.max(fr + growth * 1.1, jr), 99);

  return {
    fr: Math.min(Math.round(fr), 99),
    so: Math.round(so),
    jr: Math.round(jr),
    sr: Math.round(sr),
    developmentTrait,
  };
};

const generatePlayerRatings = (stars: number) => {
  const base = STARS_BASE[stars] ?? STARS_BASE[1];
  return buildRatings(base);
};

const loadNames = async () => {
  const namesData = await getNamesData();
  const processed = {
    black: { first: [] as string[], last: [] as string[] },
    white: { first: [] as string[], last: [] as string[] },
  };

  (['black', 'white'] as const).forEach(race => {
    (['first', 'last'] as const).forEach(type => {
      const list = namesData[race]?.[type] ?? [];
      list.forEach(entry => {
        for (let i = 0; i < entry.weight; i += 1) {
          processed[race][type].push(entry.name);
        }
      });
    });
  });

  return processed;
};

const generateName = (position: string, names: { black: { first: string[]; last: string[] }; white: { first: string[]; last: string[] } }) => {
  const positionBias: Record<string, number> = {
    qb: 15,
    rb: 70,
    wr: 70,
    te: 30,
    ol: 20,
    dl: 70,
    lb: 50,
    cb: 90,
    s: 70,
    k: 0,
    p: 0,
  };
  const bias = positionBias[position] ?? 50;
  const race = Math.random() <= bias / 100 ? 'black' : 'white';
  const firstList = names[race].first;
  const lastList = names[race].last;
  const first = firstList[Math.floor(Math.random() * firstList.length)] || 'Player';
  const last = lastList[Math.floor(Math.random() * lastList.length)] || 'Unknown';
  return { first, last };
};

const buildClassTargets = (teams: Team[]) => {
  const baseTargets: Record<string, number> = {};
  Object.entries(ROSTER).forEach(([pos, config]) => {
    const perCycle = config.total / RECRUIT_CLASS_YEARS;
    baseTargets[pos] = Number.isInteger(perCycle) ? perCycle : Math.floor(perCycle) + 1;
  });

  Object.entries(ROSTER).forEach(([pos, config]) => {
    if (config.total > 0 && config.total <= RECRUIT_CLASS_YEARS && baseTargets[pos] === 0) {
      baseTargets[pos] = 1;
    }
  });

  return Object.fromEntries(teams.map(team => [team.id, { ...baseTargets }]));
};

const getRosterCounts = (players: PlayerRecord[], teams: Team[]) => {
  const counts: Record<number, Record<string, number>> = {};
  teams.forEach(team => {
    counts[team.id] = Object.fromEntries(Object.keys(ROSTER).map(pos => [pos, 0]));
  });
  players.forEach(player => {
    if (!player.active) return;
    const teamCounts = counts[player.teamId];
    if (teamCounts && player.pos in teamCounts) {
      teamCounts[player.pos] += 1;
    }
  });
  return counts;
};

const buildTeamNeeds = (teams: Team[], counts: Record<number, Record<string, number>>) => {
  const needs: Record<number, Record<string, number>> = {};
  teams.forEach(team => {
    const teamCounts = counts[team.id] ?? {};
    const teamNeeds: Record<string, number> = {};
    Object.entries(ROSTER).forEach(([pos, config]) => {
      teamNeeds[pos] = Math.max(0, config.total - (teamCounts[pos] ?? 0));
    });
    needs[team.id] = teamNeeds;
  });
  return needs;
};

const generateRecruitPool = (
  names: { black: { first: string[]; last: string[] }; white: { first: string[]; last: string[] } },
  states: string[],
  stateWeights: number[]
) => {
  const recruits: Recruit[] = [];
  const positions = Object.keys(ROSTER);
  const positionWeights = positions.map(pos => ROSTER[pos].total);

  Object.entries(RECRUIT_STAR_COUNTS).forEach(([starsKey, count]) => {
    const stars = Number(starsKey);
    for (let i = 0; i < count; i += 1) {
      const pos = weightedChoice(positions.map((item, idx) => ({ item, weight: positionWeights[idx] }))) ?? 'qb';
      const { first, last } = generateName(pos, names);
      const ratings = generatePlayerRatings(stars);
      const state = weightedChoice(states.map((item, idx) => ({ item, weight: stateWeights[idx] }))) ?? 'Unknown';
      recruits.push({
        first,
        last,
        pos,
        stars,
        state,
        rating_fr: ratings.fr,
        rating_so: ratings.so,
        rating_jr: ratings.jr,
        rating_sr: ratings.sr,
        development_trait: ratings.developmentTrait,
      });
    }
  });

  return recruits;
};

const matchRecruitsForPosition = (recruits: Recruit[], teams: Team[], positionNeeds: Record<number, Record<string, number>>, pos: string) => {
  const assignments: Record<number, Recruit[]> = Object.fromEntries(teams.map(team => [team.id, []]));
  const capacities = Object.fromEntries(teams.map(team => [team.id, positionNeeds[team.id][pos]]));
  const recruitPrefs: Record<number, number[]> = {};
  const recruitPrefIndex: Record<number, number> = {};
  const queue: Recruit[] = [];

  recruits.forEach(recruit => {
    const eligible = teams.filter(team => capacities[team.id] > 0 && team.prestige >= recruit.stars);
    if (!eligible.length) return;
    const scores = eligible.map(team => ({
      teamId: team.id,
      score:
        team.prestige ** RECRUIT_PRESTIGE_EXPONENT * RECRUIT_PRESTIGE_BIAS +
        Math.random() * RECRUIT_RANDOMNESS,
    }));
    scores.sort((a, b) => b.score - a.score);
    recruitPrefs[recruit.rid ?? 0] = scores.map(score => score.teamId);
    recruitPrefIndex[recruit.rid ?? 0] = 0;
    queue.push(recruit);
  });

  while (queue.length) {
    const recruit = queue.shift()!;
    const prefs = recruitPrefs[recruit.rid ?? 0];
    if (!prefs) continue;
    const prefIndex = recruitPrefIndex[recruit.rid ?? 0];
    if (prefIndex >= prefs.length) continue;
    const teamId = prefs[prefIndex];
    recruitPrefIndex[recruit.rid ?? 0] = prefIndex + 1;

    const teamList = assignments[teamId];
    if (teamList.length < capacities[teamId]) {
      teamList.push(recruit);
      continue;
    }

    const newScore = recruit.stars * 100 + recruit.rating_fr;
    let worstIndex = 0;
    let worstScore = teamList[0].stars * 100 + teamList[0].rating_fr;
    for (let i = 1; i < teamList.length; i += 1) {
      const score = teamList[i].stars * 100 + teamList[i].rating_fr;
      if (score < worstScore) {
        worstScore = score;
        worstIndex = i;
      }
    }

    if (newScore > worstScore) {
      const replaced = teamList[worstIndex];
      teamList[worstIndex] = recruit;
      queue.push(replaced);
    } else {
      queue.push(recruit);
    }
  }

  return assignments;
};

const assignRecruitsToTeams = (
  teams: Team[],
  recruits: Recruit[],
  teamNeeds: Record<number, Record<string, number>>,
  names: { black: { first: string[]; last: string[] }; white: { first: string[]; last: string[] } },
  states: string[],
  stateWeights: number[]
) => {
  const classAssignments: Record<number, Recruit[]> = Object.fromEntries(teams.map(team => [team.id, []]));
  const positionRemaining: Record<number, Record<string, number>> = {};
  teams.forEach(team => {
    positionRemaining[team.id] = { ...teamNeeds[team.id] };
  });

  recruits.forEach((recruit, index) => {
    recruit.rid = index;
  });

  const recruitsByPos: Record<string, Recruit[]> = Object.fromEntries(Object.keys(ROSTER).map(pos => [pos, []]));
  recruits.forEach(recruit => {
    recruitsByPos[recruit.pos].push(recruit);
  });

  Object.entries(recruitsByPos).forEach(([pos, posRecruits]) => {
    if (!posRecruits.length) return;
    const assignments = matchRecruitsForPosition(posRecruits, teams, positionRemaining, pos);
    Object.entries(assignments).forEach(([teamIdStr, assigned]) => {
      const teamId = Number(teamIdStr);
      if (!assigned.length) return;
      classAssignments[teamId].push(...assigned);
      positionRemaining[teamId][pos] -= assigned.length;
    });
  });

  const classRemaining: Record<number, number> = {};
  teams.forEach(team => {
    classRemaining[team.id] = Object.values(positionRemaining[team.id]).reduce((sum, value) => sum + value, 0);
  });

  teams.forEach(team => {
    while (classRemaining[team.id] > 0) {
      const needs = positionRemaining[team.id];
      const needPositions = Object.keys(needs).filter(pos => needs[pos] > 0);
      let pos = '';
      if (needPositions.length) {
        pos = needPositions.reduce((best, current) => (needs[current] > needs[best] ? current : best));
        positionRemaining[team.id][pos] -= 1;
      } else {
        const positions = Object.keys(ROSTER);
        const weights = positions.map(key => ROSTER[key].total);
        pos = weightedChoice(positions.map((item, idx) => ({ item, weight: weights[idx] }))) ?? 'qb';
      }
      const { first, last } = generateName(pos, names);
      const ratings = generatePlayerRatings(1);
      const state = weightedChoice(states.map((item, idx) => ({ item, weight: stateWeights[idx] }))) ?? 'Unknown';
      classAssignments[team.id].push({
        first,
        last,
        pos,
        stars: 1,
        state,
        rating_fr: ratings.fr,
        rating_so: ratings.so,
        rating_jr: ratings.jr,
        rating_sr: ratings.sr,
        development_trait: ratings.developmentTrait,
      });
      classRemaining[team.id] -= 1;
    }
  });

  return classAssignments;
};

const createPlayerFromRecruit = (league: LeagueState, team: Team, recruit: Recruit, year: 'fr' | 'so' | 'jr' | 'sr') => {
  const ratingMap: Record<string, number> = {
    fr: recruit.rating_fr,
    so: recruit.rating_so,
    jr: recruit.rating_jr,
    sr: recruit.rating_sr,
  };
  const rating = ratingMap[year] ?? recruit.rating_sr;
  return {
    id: nextPlayerId(league),
    teamId: team.id,
    first: recruit.first,
    last: recruit.last,
    year,
    pos: recruit.pos,
    rating,
    rating_fr: recruit.rating_fr,
    rating_so: recruit.rating_so,
    rating_jr: recruit.rating_jr,
    rating_sr: recruit.rating_sr,
    stars: recruit.stars,
    development_trait: recruit.development_trait,
    starter: false,
    active: true,
  };
};

const recruitingCycle = async (
  league: LeagueState,
  teams: Team[],
  players: PlayerRecord[],
  names: { black: { first: string[]; last: string[] }; white: { first: string[]; last: string[] } },
  states: string[],
  stateWeights: number[],
  classTargets?: Record<number, Record<string, number>>
) => {
  const rosterCounts = getRosterCounts(players, teams);
  const teamNeeds = buildTeamNeeds(teams, rosterCounts);
  const needsOverride = classTargets || teamNeeds;
  const recruits = generateRecruitPool(names, states, stateWeights);
  const assignments = assignRecruitsToTeams(teams, recruits, needsOverride, names, states, stateWeights);

  teams.forEach(team => {
    const recruitsForTeam = assignments[team.id] ?? [];
    recruitsForTeam.forEach(recruit => {
      const player = createPlayerFromRecruit(league, team, recruit, 'fr');
      players.push(player);
    });
  });
};

export const applyRosterCuts = (teams: Team[], players: PlayerRecord[]) => {
  const yearOrder: Record<string, number> = { fr: 1, so: 2, jr: 3, sr: 4 };
  const cuts = new Set<number>();

  teams.forEach(team => {
    const teamPlayers = players.filter(player => player.active && player.teamId === team.id);
    Object.entries(ROSTER).forEach(([pos, config]) => {
      const posPlayers = teamPlayers.filter(player => player.pos === pos);
      if (posPlayers.length <= config.total) return;
      posPlayers.sort((a, b) => {
        if (b.rating_sr !== a.rating_sr) return b.rating_sr - a.rating_sr;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return (yearOrder[b.year] ?? 0) - (yearOrder[a.year] ?? 0);
      });
      posPlayers.slice(config.total).forEach(player => cuts.add(player.id));
    });
  });

  players.forEach(player => {
    if (cuts.has(player.id)) {
      player.active = false;
      player.starter = false;
    }
  });
};

export const setStarters = (teams: Team[], players: PlayerRecord[]) => {
  players.forEach(player => {
    if (player.active) player.starter = false;
  });

  teams.forEach(team => {
    Object.entries(ROSTER).forEach(([pos, config]) => {
      const posPlayers = players
        .filter(player => player.active && player.teamId === team.id && player.pos === pos)
        .sort((a, b) => b.rating - a.rating);
      posPlayers.slice(0, config.starters).forEach(player => {
        player.starter = true;
      });
    });
  });
};

const calculateSingleTeamRating = (players: PlayerRecord[]) => {
  const starters = players.filter(player => player.starter);
  const weightedPlayers = starters.map(player => {
    const weight = OFFENSIVE_WEIGHTS[player.pos] ?? DEFENSIVE_WEIGHTS[player.pos] ?? 0;
    return { pos: player.pos, rating: player.rating, weight, weighted_rating: player.rating * weight };
  });

  const offensivePlayers = weightedPlayers.filter(player => player.pos in OFFENSIVE_WEIGHTS);
  const defensivePlayers = weightedPlayers.filter(player => player.pos in DEFENSIVE_WEIGHTS);

  let offense = 0;
  if (offensivePlayers.length) {
    const total = offensivePlayers.reduce((sum, player) => sum + player.weight, 0);
    if (total > 0) {
      offense = offensivePlayers.reduce((sum, player) => sum + player.weighted_rating, 0) / total;
    }
  }

  let defense = 0;
  if (defensivePlayers.length) {
    const total = defensivePlayers.reduce((sum, player) => sum + player.weight, 0);
    if (total > 0) {
      defense = defensivePlayers.reduce((sum, player) => sum + player.weighted_rating, 0) / total;
    }
  }

  offense += gaussian(0, 3);
  defense += gaussian(0, 3);

  const overall = offense * OFFENSE_WEIGHT + defense * DEFENSE_WEIGHT;
  return { offense: Math.round(offense), defense: Math.round(defense), overall: Math.round(overall) };
};

export const recalculateTeamRatings = (teams: Team[], players: PlayerRecord[]) => {
  teams.forEach(team => {
    const teamPlayers = players.filter(player => player.active && player.teamId === team.id);
    const ratings = calculateSingleTeamRating(teamPlayers);
    team.offense = ratings.offense;
    team.defense = ratings.defense;
    team.rating = ratings.overall;
  });

  const sorted = [...teams].sort((a, b) => b.rating - a.rating);
  sorted.forEach((team, index) => {
    team.ranking = index + 1;
    team.last_rank = index + 1;
  });
};

export const applyProgression = (players: PlayerRecord[]) => {
  players.forEach(player => {
    if (!player.active) return;
    if (player.year === 'sr') {
      player.active = false;
      player.starter = false;
      return;
    }

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
};

export const runRecruitingCycle = async (
  league: LeagueState,
  teams: Team[],
  players: PlayerRecord[]
) => {
  const names = await loadNames();
  const statesData = await getStatesData();
  const states = Object.keys(statesData);
  const stateWeights = states.map(state => statesData[state]);
  if (!states.length) {
    states.push('Unknown');
    stateWeights.push(1);
  }

  await recruitingCycle(league, teams, players, names, states, stateWeights);
};

export const previewRosterCuts = (players: PlayerRecord[], teamId: number) => {
  const yearOrder: Record<PlayerRecord['year'], number> = { fr: 1, so: 2, jr: 3, sr: 4 };
  const cuts: PlayerRecord[] = [];
  const activePlayers = players.filter(player => player.active && player.teamId === teamId);

  Object.entries(ROSTER).forEach(([pos, config]) => {
    const posPlayers = activePlayers.filter(player => player.pos === pos);
    if (posPlayers.length <= config.total) return;
    posPlayers.sort((a, b) => {
      if (b.rating_sr !== a.rating_sr) return b.rating_sr - a.rating_sr;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return (yearOrder[b.year] ?? 0) - (yearOrder[a.year] ?? 0);
    });
    cuts.push(...posPlayers.slice(config.total));
  });

  return cuts;
};

export const initializeRosters = async (league: LeagueState) => {
  const teams = league.teams;
  const names = await loadNames();
  const statesData = await getStatesData();
  const states = Object.keys(statesData);
  const stateWeights = states.map(state => statesData[state]);
  if (!states.length) {
    states.push('Unknown');
    stateWeights.push(1);
  }

  const players: PlayerRecord[] = [];
  const classTargets = buildClassTargets(teams);

  await recruitingCycle(league, teams, players, names, states, stateWeights, classTargets);
  for (let cycle = 0; cycle < RECRUIT_CLASS_YEARS - 1; cycle += 1) {
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
    await recruitingCycle(league, teams, players, names, states, stateWeights, classTargets);
  }

  applyRosterCuts(teams, players);
  setStarters(teams, players);

  teams.forEach(team => {
    const teamPlayers = players.filter(player => player.active && player.teamId === team.id);
    const ratings = calculateSingleTeamRating(teamPlayers);
    team.offense = ratings.offense;
    team.defense = ratings.defense;
    team.rating = ratings.overall;
  });

  const sorted = [...teams].sort((a, b) => b.rating - a.rating);
  sorted.forEach((team, index) => {
    team.ranking = index + 1;
    team.last_rank = index + 1;
  });

  await savePlayers(players);
};

export const ensureRosters = async (league: LeagueState) => {
  const sampleTeam = league.teams[0];
  if (!sampleTeam) return;
  const existing = await getPlayersByTeam(sampleTeam.id);
  if (existing.length && existing[0].year) return;
  await clearPlayers();
  await initializeRosters(league);
};
