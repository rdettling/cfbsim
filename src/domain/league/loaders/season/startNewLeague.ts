import {
  clearBaseDataCache,
  getHistoryData,
  getYearData,
  getYearsIndex,
} from '../../../../db/baseData';
import { commitNewLeague } from '../../../../db/newLeagueRepo';
import type { Info, PlayoffTeamCount } from '../../../../types/domain';
import type {
  LeagueState,
  NonConData,
  StartNewLeagueInput,
} from '../../../../types/league';
import {
  DEFAULT_NEXT_SEASON_CONFIGURATION,
  NewLeagueConfigurationError,
} from '../../../../types/league';
import { buildTeamsAndConferences } from '../../../baseData';
import { prepareInitialRosters } from '../../../roster';
import { getLastWeekByPlayoffTeams } from '../../postseason';
import { initializeNonConScheduling } from '../../seasonReset';

const isPlayoffTeamCount = (value: number): value is PlayoffTeamCount =>
  value === 2 || value === 4 || value === 12;

const validateBasicInput = (input: StartNewLeagueInput) => {
  if (!input.year.trim()) {
    throw new NewLeagueConfigurationError('Choose a season.');
  }
  if (!input.teamName.trim()) {
    throw new NewLeagueConfigurationError('Choose a team.');
  }
  if (!isPlayoffTeamCount(input.playoff.teams)) {
    throw new NewLeagueConfigurationError(
      'The playoff must contain 2, 4, or 12 teams.',
    );
  }
};

export const startNewLeague = async (
  input: StartNewLeagueInput,
): Promise<NonConData> => {
  validateBasicInput(input);
  await clearBaseDataCache();

  const yearsIndex = await getYearsIndex();
  if (!yearsIndex.years.includes(input.year)) {
    throw new NewLeagueConfigurationError(
      `The ${input.year} season is not supported.`,
    );
  }

  const year = input.year;
  const [yearData, teamsAndConferences] = await Promise.all([
    getYearData(year),
    buildTeamsAndConferences(year),
    getHistoryData(),
  ]);
  const { teams, conferences } = teamsAndConferences;
  const userTeam = teams.find(team => team.name === input.teamName);
  if (!userTeam) {
    throw new NewLeagueConfigurationError(
      `${input.teamName} is not available in the ${year} season.`,
    );
  }

  const startYear = Number(year);
  if (!Number.isInteger(startYear)) {
    throw new NewLeagueConfigurationError(`The ${year} season is invalid.`);
  }

  const yearPlayoff = yearData.playoff;
  const resolvedPlayoffTeams = input.playoff.teams;
  const resolvedPlayoffAutobids = resolvedPlayoffTeams === 12
    ? input.playoff.autobids ?? yearPlayoff.conf_champ_autobids
    : undefined;
  const resolvedPlayoffTop4 = resolvedPlayoffTeams === 12
    ? input.playoff.conferenceChampionsReceiveTopSeeds ??
      yearPlayoff.conf_champ_top_4
    : false;

  if (resolvedPlayoffTeams === 12) {
    if (
      resolvedPlayoffAutobids === undefined ||
      !Number.isInteger(resolvedPlayoffAutobids) ||
      resolvedPlayoffAutobids < 0 ||
      resolvedPlayoffAutobids > 10
    ) {
      throw new NewLeagueConfigurationError(
        'A 12-team playoff must use between 0 and 10 automatic bids.',
      );
    }
    if (resolvedPlayoffTop4 && resolvedPlayoffAutobids < 4) {
      throw new NewLeagueConfigurationError(
        'Top-four conference champion seeding requires at least four automatic bids.',
      );
    }
  }

  const normalizedPlayoffAutobids =
    resolvedPlayoffTeams === 12 ? resolvedPlayoffAutobids : undefined;
  const normalizedPlayoffTop4 = resolvedPlayoffTeams === 12 ? resolvedPlayoffTop4 : false;

  const info: Info = {
    currentWeek: 1,
    currentYear: startYear,
    startYear,
    stage: 'preseason',
    team: userTeam.name,
    lastWeek: getLastWeekByPlayoffTeams(resolvedPlayoffTeams),
    colorPrimary: userTeam.colorPrimary,
    colorSecondary: userTeam.colorSecondary,
  };

  const league: LeagueState = {
    info,
    teams,
    conferences,
    pending_rivalries: [],
    rivalryHostSeeds: {},
    scheduleBuilt: false,
    simInitialized: false,
    settings: {
      ...DEFAULT_NEXT_SEASON_CONFIGURATION,
      playoffTeams: resolvedPlayoffTeams,
      playoffAutobids: normalizedPlayoffAutobids ?? 0,
      conferenceChampionsReceiveTopSeeds: normalizedPlayoffTop4,
    },
    playoff: { seeds: [] },
    idCounters: {
      game: 1,
      drive: 1,
      play: 1,
      gameLog: 1,
      player: 1,
    },
  };

  const players = await prepareInitialRosters(league);

  const { schedule, gamesToSave } = await initializeNonConScheduling(league);
  await commitNewLeague({
    league,
    players,
    games: gamesToSave,
  });

  return {
    info: league.info,
    team: userTeam,
    schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};
