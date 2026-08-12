import { getNamesData, getStatesData } from '../db/baseData';
import type { PlayerRecord } from '../types/db';
import type { Team } from '../types/domain';
import type { LeagueState } from '../types/league';
import type { NamesData } from '../types/baseData';
import {
  RECRUIT_STAR_COUNTS,
  type RecruitStarCounts,
} from './recruiting/config';
import { ROSTER } from './rosterConfig';
import { assignBootstrapClass } from './rosterBootstrapPool';
import {
  mathRandomSource,
  type RandomSource,
} from './utils/random';
import {
  recalculateTeamRatings,
  recalculateTeamStrengths,
  setStarters,
} from './rosterRatings';

const CLASS_YEARS = 4;

const nextPlayerId = (league: LeagueState) => {
  const id = league.idCounters.player;
  league.idCounters.player += 1;
  return id;
};

export const buildBootstrapClassTargets = () => {
  const targets = Array.from({ length: CLASS_YEARS }, () =>
    Object.fromEntries(
      Object.keys(ROSTER).map(position => [position, 0]),
    ) as Record<string, number>,
  );
  let classCursor = 0;
  Object.entries(ROSTER).forEach(([position, config]) => {
    const base = Math.floor(config.total / CLASS_YEARS);
    targets.forEach(target => {
      target[position] = base;
    });
    const remainder = config.total % CLASS_YEARS;
    for (let index = 0; index < remainder; index += 1) {
      targets[(classCursor + index) % CLASS_YEARS][position] += 1;
    }
    classCursor = (classCursor + remainder) % CLASS_YEARS;
  });
  return targets;
};

const buildClassTargets = (teams: Team[], cycle: number) => {
  const targets = buildBootstrapClassTargets()[cycle];
  return Object.fromEntries(teams.map(team => [team.id, { ...targets }]));
};

const buildTeamNeeds = (teams: Team[], players: PlayerRecord[]) => {
  const counts: Record<number, Record<string, number>> = Object.fromEntries(
    teams.map(team => [
      team.id,
      Object.fromEntries(Object.keys(ROSTER).map(position => [position, 0])),
    ]),
  );
  players.forEach(player => {
    if (counts[player.teamId]?.[player.pos] !== undefined) {
      counts[player.teamId][player.pos] += 1;
    }
  });
  return Object.fromEntries(
    teams.map(team => [
      team.id,
      Object.fromEntries(
        Object.entries(ROSTER).map(([position, config]) => [
          position,
          Math.max(0, config.total - counts[team.id][position]),
        ]),
      ),
    ]),
  );
};

const recruitClass = (
  league: LeagueState,
  competitionTeams: Team[],
  rosterTeams: Team[],
  players: PlayerRecord[],
  names: NamesData,
  states: string[],
  stateWeights: number[],
  random: RandomSource,
  targets?: Record<number, Record<string, number>>,
  starCounts: RecruitStarCounts = RECRUIT_STAR_COUNTS,
) => {
  const assignments = assignBootstrapClass(
    competitionTeams,
    targets ?? buildTeamNeeds(competitionTeams, players),
    names,
    states,
    stateWeights,
    random,
    starCounts,
  );
  rosterTeams.forEach(team => {
    assignments[team.id].forEach(candidate => {
      players.push({
        id: nextPlayerId(league),
        teamId: team.id,
        first: candidate.first,
        last: candidate.last,
        year: 'fr',
        pos: candidate.pos,
        rating: candidate.rating_fr,
        rating_fr: candidate.rating_fr,
        rating_so: candidate.rating_so,
        rating_jr: candidate.rating_jr,
        rating_sr: candidate.rating_sr,
        stars: candidate.stars,
        development_trait: candidate.development_trait,
        starter: false,
      });
    });
  });
};

const loadSourceData = async () => {
  const names = await getNamesData();
  const stateData = await getStatesData();
  const states = Object.keys(stateData);
  if (!states.length) return { names, states: ['Unknown'], weights: [1] };
  return { names, states, weights: states.map(state => stateData[state]) };
};

const progressBootstrapClass = (players: PlayerRecord[]) => {
  players.forEach(player => {
    if (player.year === 'fr') player.year = 'so';
    else if (player.year === 'so') player.year = 'jr';
    else if (player.year === 'jr') player.year = 'sr';
    player.rating =
      player.year === 'so'
        ? player.rating_so
        : player.year === 'jr'
          ? player.rating_jr
          : player.year === 'sr'
            ? player.rating_sr
            : player.rating_fr;
  });
};

export interface PrepareInitialRostersFromDataInput {
  league: LeagueState;
  names: NamesData;
  states: Record<string, number>;
  random: RandomSource;
  starCounts?: RecruitStarCounts;
}

export interface PrepareProgramEntryRostersFromDataInput
  extends PrepareInitialRostersFromDataInput {
  teams: Team[];
}

const prepareBootstrapRosters = ({
  league,
  teams,
  competitionTeams = teams,
  names,
  states,
  random,
  starCounts,
}: PrepareProgramEntryRostersFromDataInput & { competitionTeams?: Team[] }) => {
  const players: PlayerRecord[] = [];
  const stateNames = Object.keys(states);
  const availableStates = stateNames.length ? stateNames : ['Unknown'];
  const stateWeights = stateNames.length
    ? stateNames.map(state => states[state])
    : [1];
  for (let cycle = 0; cycle < CLASS_YEARS; cycle += 1) {
    if (cycle > 0) progressBootstrapClass(players);
    recruitClass(
      league,
      competitionTeams,
      teams,
      players,
      names,
      availableStates,
      stateWeights,
      random.fork(`class:${cycle}`),
      buildClassTargets(competitionTeams, cycle),
      starCounts,
    );
  }
  setStarters(teams, players);
  return players;
};

export const prepareInitialRostersFromData = ({
  league,
  names,
  states,
  random,
  starCounts = RECRUIT_STAR_COUNTS,
}: PrepareInitialRostersFromDataInput) => {
  const players = prepareBootstrapRosters({
    league,
    teams: league.teams,
    names,
    states,
    random,
    starCounts,
  });
  recalculateTeamRatings(
    league.teams,
    players,
    random.fork('team-ratings'),
  );
  return players;
};

export const prepareProgramEntryRostersFromData = ({
  league,
  teams,
  names,
  states,
  random,
  starCounts = RECRUIT_STAR_COUNTS,
}: PrepareProgramEntryRostersFromDataInput) => {
  const players = prepareBootstrapRosters({
    league,
    teams,
    competitionTeams: league.teams,
    names,
    states,
    random,
    starCounts,
  });
  recalculateTeamStrengths(
    teams,
    players,
    random.fork('team-ratings'),
  );
  return players;
};

export const prepareProgramEntryRosters = async (
  league: LeagueState,
  teams: Team[],
) => {
  const source = await loadSourceData();
  return prepareProgramEntryRostersFromData({
    league,
    teams,
    names: source.names,
    states: Object.fromEntries(
      source.states.map((state, index) => [state, source.weights[index]]),
    ),
    random: mathRandomSource(),
  });
};

export const prepareInitialRosters = async (league: LeagueState) => {
  const source = await loadSourceData();
  return prepareInitialRostersFromData({
    league,
    names: source.names,
    states: Object.fromEntries(
      source.states.map((state, index) => [state, source.weights[index]]),
    ),
    random: mathRandomSource(),
  });
};
