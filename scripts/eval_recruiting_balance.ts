import { readFileSync } from 'node:fs';
import type {
  HistoryData,
  PrestigeConfig,
  TeamsData,
  YearData,
} from '../src/types/baseData';
import type { Conference, Team } from '../src/types/domain';
import {
  DEFAULT_NEXT_SEASON_CONFIGURATION,
  type LeagueState,
} from '../src/types/league';
import type { WeightedNameData } from '../src/types/recruiting';
import { runRecruitingEvaluationSuite } from '../src/domain/recruiting/evaluation';
import { RECRUIT_STAR_COUNTS } from '../src/domain/recruiting/config';
import { createSeededRandom } from '../src/domain/recruiting/random';
import { prepareInitialRostersFromData } from '../src/domain/rosterBootstrap';

const DEFAULT_SEED = 20260727;
const DEFAULT_SEEDS = 1;
const DEFAULT_SEASONS = 1;
const DEFAULT_REPLAY_SEEDS = 0;
const BASE_YEAR = 2025;
const START_YEAR = 2026;

const readJson = <T>(path: string) =>
  JSON.parse(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
  ) as T;

const parseInteger = (
  name: string,
  value: string | undefined,
  maximum = Number.MAX_SAFE_INTEGER,
) => {
  if (
    value === undefined ||
    !/^\d+$/.test(value) ||
    Number(value) < 1 ||
    Number(value) > maximum
  ) {
    throw new Error(`${name} must be an integer from 1 through ${maximum}.`);
  }
  return Number(value);
};

const parseArguments = (arguments_: string[]) => {
  const options = {
    seed: DEFAULT_SEED,
    seeds: DEFAULT_SEEDS,
    seasons: DEFAULT_SEASONS,
    replaySeeds: DEFAULT_REPLAY_SEEDS,
    threeStars: RECRUIT_STAR_COUNTS[3],
    twoStars: RECRUIT_STAR_COUNTS[2],
  };
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === '--seed') {
      if (
        value === undefined ||
        !/^\d+$/.test(value) ||
        Number(value) > 0xffff_ffff
      ) {
        throw new Error('--seed must be an unsigned 32-bit integer.');
      }
      options.seed = Number(value);
    } else if (name === '--seeds') {
      options.seeds = parseInteger('--seeds', value);
    } else if (name === '--seasons') {
      options.seasons = parseInteger('--seasons', value);
    } else if (name === '--replay-seeds') {
      if (
        value === undefined ||
        !/^\d+$/.test(value) ||
        Number(value) > Number.MAX_SAFE_INTEGER
      ) {
        throw new Error('--replay-seeds must be a nonnegative integer.');
      }
      options.replaySeeds = Number(value);
    } else if (name === '--three-stars') {
      options.threeStars = parseInteger('--three-stars', value);
    } else if (name === '--two-stars') {
      options.twoStars = parseInteger('--two-stars', value);
    } else {
      throw new Error(`Unknown evaluation argument: ${name ?? '(missing)'}.`);
    }
  }
  return options;
};

const historyRanking = (
  history: HistoryData,
  teamName: string,
  year: number,
) => {
  const row = history.teams[teamName]?.find(entry => entry[0] === year);
  if (!row || !Number.isInteger(row[2]) || row[2] < 1) {
    throw new Error(
      `History is missing the ${year} ranking for ${teamName}.`,
    );
  }
  return row[2];
};

const buildLeague = (
  yearData: YearData,
  teamsData: TeamsData,
  history: HistoryData,
) => {
  let nextTeamId = 1;
  const conferences: Conference[] = [];
  const teams: Team[] = [];
  const addConference = (
    confName: string,
    confGames: number,
    members: Record<string, number>,
  ) => {
    const conferenceTeams = Object.entries(members).map(
      ([teamName, prestige]) => {
        const metadata = teamsData.teams[teamName];
        if (!metadata) {
          throw new Error(`Team metadata is missing for ${teamName}.`);
        }
        const team: Team = {
          id: nextTeamId++,
          name: teamName,
          abbreviation: metadata.abbreviation,
          confGames: 0,
          confLimit: confGames,
          nonConfGames: 0,
          nonConfLimit: 12 - confGames,
          prestige,
          prestige_change: 0,
          ceiling: metadata.ceiling,
          floor: metadata.floor,
          mascot: metadata.mascot,
          city: metadata.city,
          state: metadata.state,
          stadium: metadata.stadium,
          ranking: historyRanking(history, teamName, BASE_YEAR),
          offense: 0,
          defense: 0,
          colorPrimary: metadata.colorPrimary,
          colorSecondary: metadata.colorSecondary,
          conference: confName,
          confName,
          confWins: 0,
          confLosses: 0,
          nonConfWins: 0,
          nonConfLosses: 0,
          rating: 0,
          totalWins: 0,
          totalLosses: 0,
          gamesPlayed: 0,
          record: '0-0 (0-0)',
          movement: 0,
          poll_score: 0,
          strength_of_record: 0,
          last_game: null,
          next_game: null,
        };
        teams.push(team);
        return team;
      },
    );
    conferences.push({
      id: conferences.length + 1,
      confName,
      confFullName: confName,
      confGames,
      info: '',
      championship: null,
      teams: conferenceTeams,
    });
  };

  Object.entries(yearData.conferences).forEach(([confName, conference]) => {
    addConference(confName, conference.games, conference.teams);
  });
  if (yearData.independents && Object.keys(yearData.independents).length) {
    addConference('Independent', 0, yearData.independents);
  }

  const league: LeagueState = {
    info: {
      currentWeek: 1,
      currentYear: BASE_YEAR,
      startYear: BASE_YEAR,
      stage: 'preseason',
      team: teams[0].name,
      lastWeek: 18,
    },
    teams,
    conferences,
    pending_rivalries: [],
    rivalryHostSeeds: {},
    scheduleBuilt: false,
    simInitialized: false,
    settings: { ...DEFAULT_NEXT_SEASON_CONFIGURATION },
    playoff: { seeds: [] },
    idCounters: {
      game: 1,
      drive: 1,
      play: 1,
      gameLog: 1,
      player: 1,
    },
  };
  return league;
};

const options = parseArguments(process.argv.slice(2));
const startedAt = performance.now();
const names = readJson<WeightedNameData>('../public/data/names.json');
const states = readJson<Record<string, number>>('../public/data/states.json');
const teamsData = readJson<TeamsData>('../public/data/teams.json');
const yearData = readJson<YearData>('../public/data/years/2025.json');
const history = readJson<HistoryData>('../public/data/history.json');
const prestigeConfig = readJson<PrestigeConfig>(
  '../public/data/prestige_config.json',
);
const league = buildLeague(yearData, teamsData, history);
const recruitStarCounts = {
  ...RECRUIT_STAR_COUNTS,
  3: options.threeStars,
  2: options.twoStars,
};
const initialRankings = new Map(
  league.teams.map(team => [team.id, team.ranking]),
);
const players = prepareInitialRostersFromData({
  league,
  names,
  states,
  random: createSeededRandom(options.seed).fork('initial-rosters'),
  starCounts: recruitStarCounts,
});
league.teams.forEach(team => {
  team.ranking = initialRankings.get(team.id)!;
  team.last_rank = team.ranking;
});
league.info.currentYear = START_YEAR;

const report = runRecruitingEvaluationSuite({
  league,
  players,
  names,
  states,
  history,
  teamsData,
  prestigeConfig,
  rootSeed: options.seed,
  seedCount: options.seeds,
  replaySeedCount: options.replaySeeds,
  seasonsPerSeed: options.seasons,
  startYear: START_YEAR,
  recruitStarCounts,
});

console.log(
  JSON.stringify(
    {
      ...report,
      runtimeMs: Math.round(performance.now() - startedAt),
    },
    null,
    2,
  ),
);
if (
  report.structuralViolations.length ||
  report.reproducibilityFailures ||
  report.balanceViolations.length
) {
  process.exitCode = 1;
}
