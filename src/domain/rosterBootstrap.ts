import { getHistoryData, getNamesData, getStatesData } from '../db/baseData';
import type { PlayerRecord } from '../types/db';
import type { Team } from '../types/domain';
import type { LeagueState } from '../types/league';
import type { HistoryData, NamesData } from '../types/baseData';
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

const BOOTSTRAP_CLASSES = ['sr', 'jr', 'so', 'fr'] as const;
type BootstrapClass = typeof BOOTSTRAP_CLASSES[number];

const CLASS_ENTRY_YEAR_OFFSETS: Record<BootstrapClass, number> = {
  fr: 0,
  so: -1,
  jr: -2,
  sr: -3,
};

const nextPlayerId = (league: LeagueState) => {
  const id = league.idCounters.player;
  league.idCounters.player += 1;
  return id;
};

export const buildBootstrapClassTargets = () => {
  const targets = Array.from({ length: BOOTSTRAP_CLASSES.length }, () =>
    Object.fromEntries(
      Object.keys(ROSTER).map(position => [position, 0]),
    ) as Record<string, number>,
  );
  let classCursor = 0;
  Object.entries(ROSTER).forEach(([position, config]) => {
    const base = Math.floor(config.total / BOOTSTRAP_CLASSES.length);
    targets.forEach(target => {
      target[position] = base;
    });
    const remainder = config.total % BOOTSTRAP_CLASSES.length;
    for (let index = 0; index < remainder; index += 1) {
      targets[(classCursor + index) % BOOTSTRAP_CLASSES.length][position] += 1;
    }
    classCursor = (classCursor + remainder) % BOOTSTRAP_CLASSES.length;
  });
  return targets;
};

export const buildBootstrapPrestigesByClass = (
  teams: Team[],
  historyData: HistoryData,
  startYear: number,
) => Object.fromEntries(teams.map(team => {
  const history = (historyData.teams[team.name] ?? [])
    .filter(([year]) => year < startYear);
  const resolveUpperclassPrestige = (classYear: BootstrapClass) => {
    const targetYear = startYear + CLASS_ENTRY_YEAR_OFFSETS[classYear];
    const nearest = [...history].sort(
      ([leftYear], [rightYear]) =>
        Math.abs(leftYear - targetYear) - Math.abs(rightYear - targetYear) ||
        leftYear - rightYear,
    )[0];
    return nearest?.[5] ?? team.prestige;
  };
  return [team.id, {
    fr: team.prestige,
    so: resolveUpperclassPrestige('so'),
    jr: resolveUpperclassPrestige('jr'),
    sr: resolveUpperclassPrestige('sr'),
  }];
})) as Record<number, Record<BootstrapClass, number>>;

const buildClassTargets = (teams: Team[], cycle: number) => {
  const targets = buildBootstrapClassTargets();
  return Object.fromEntries(teams.map(team => [
    team.id,
    { ...targets[(cycle + team.id) % targets.length] },
  ]));
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
  historyData: HistoryData;
  names: NamesData;
  states: Record<string, number>;
  random: RandomSource;
  starCounts?: RecruitStarCounts;
}

export interface PrepareProgramEntryRostersFromDataInput
  extends Omit<PrepareInitialRostersFromDataInput, 'historyData'> {
  teams: Team[];
}

const prepareBootstrapRosters = ({
  league,
  teams,
  competitionTeamsByClass,
  names,
  states,
  random,
  starCounts,
}: PrepareProgramEntryRostersFromDataInput & {
  competitionTeamsByClass: Record<BootstrapClass, Team[]>;
}) => {
  const players: PlayerRecord[] = [];
  const stateNames = Object.keys(states);
  const availableStates = stateNames.length ? stateNames : ['Unknown'];
  const stateWeights = stateNames.length
    ? stateNames.map(state => states[state])
    : [1];
  for (let cycle = 0; cycle < BOOTSTRAP_CLASSES.length; cycle += 1) {
    if (cycle > 0) progressBootstrapClass(players);
    const classYear = BOOTSTRAP_CLASSES[cycle];
    const competitionTeams = competitionTeamsByClass[classYear];
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
  historyData,
  names,
  states,
  random,
  starCounts = RECRUIT_STAR_COUNTS,
}: PrepareInitialRostersFromDataInput) => {
  const prestigesByClass = buildBootstrapPrestigesByClass(
    league.teams,
    historyData,
    league.info.startYear,
  );
  const players = prepareBootstrapRosters({
    league,
    teams: league.teams,
    competitionTeamsByClass: Object.fromEntries(
      BOOTSTRAP_CLASSES.map(classYear => [
        classYear,
        league.teams.map(team => ({
          ...team,
          prestige: prestigesByClass[team.id][classYear],
        })),
      ]),
    ) as Record<BootstrapClass, Team[]>,
    names,
    states,
    random,
    starCounts,
  });
  recalculateTeamRatings(league.teams, players);
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
    competitionTeamsByClass: Object.fromEntries(
      BOOTSTRAP_CLASSES.map(classYear => [classYear, league.teams]),
    ) as Record<BootstrapClass, Team[]>,
    names,
    states,
    random,
    starCounts,
  });
  recalculateTeamStrengths(teams, players);
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
  const [source, historyData] = await Promise.all([
    loadSourceData(),
    getHistoryData(),
  ]);
  return prepareInitialRostersFromData({
    league,
    historyData,
    names: source.names,
    states: Object.fromEntries(
      source.states.map((state, index) => [state, source.weights[index]]),
    ),
    random: mathRandomSource(),
  });
};
