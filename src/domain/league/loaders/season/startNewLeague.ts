import {
  clearBaseDataCache,
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
import { buildInitialRosterOrigins } from '../../../playerOrigins';
import { getLastWeekByPlayoffTeams } from '../../postseason';
import { initializeNonConScheduling } from '../../seasonReset';
import {
  applyResolvedConferenceAlignment,
  resolveConferencePlan,
} from '../../../conferencePlan';
import {
  assertCompleteSchedule,
  buildFullScheduleFromExisting,
  VALIDATION_SCHEDULE_SEED,
} from '../../../schedule/planner';
import {
  buildAcceptedRivalryGames,
} from '../../../rivalryScheduling';
import { buildNonConData } from './nonConData';

const isPlayoffTeamCount = (value: number): value is PlayoffTeamCount =>
  value === 2 || value === 4 || value === 12;

const validateBasicInput = (input: StartNewLeagueInput) => {
  if (!input.year.trim()) {
    throw new NewLeagueConfigurationError('Choose a season.');
  }
  if (!input.teamName.trim()) {
    throw new NewLeagueConfigurationError('Choose a team.');
  }
  if (
    input.conferenceSetup.mode !== 'historical' &&
    input.conferenceSetup.mode !== 'custom'
  ) {
    throw new NewLeagueConfigurationError(
      'Choose era-accurate or custom conference alignment.',
    );
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
  ]);
  const { teams, conferences } = teamsAndConferences;
  if (input.conferenceSetup.mode === 'custom') {
    const resolved = resolveConferencePlan(
      teams,
      conferences,
      input.conferenceSetup.plan,
    );
    if (resolved.issues.length) {
      throw new NewLeagueConfigurationError(resolved.issues[0].message);
    }
    applyResolvedConferenceAlignment(teams, conferences, resolved);
  }
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
    const eligibleConferences = conferences.filter(
      conference =>
        conference.confName !== 'Independent' &&
        conference.teams.length >= 2,
    ).length;
    if (
      input.conferenceSetup.mode === 'custom' &&
      resolvedPlayoffAutobids > eligibleConferences
    ) {
      throw new NewLeagueConfigurationError(
        `Automatic bids cannot exceed the ${eligibleConferences} eligible conferences.`,
      );
    }
    if (
      input.conferenceSetup.mode === 'custom' &&
      resolvedPlayoffTop4 &&
      eligibleConferences < 4
    ) {
      throw new NewLeagueConfigurationError(
        'Top-four conference champion seeding requires at least four eligible conferences.',
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
    declinedRivalries: [],
    rivalryHostSeeds: {},
    scheduleBuilt: false,
    simInitialized: false,
    settings: {
      ...DEFAULT_NEXT_SEASON_CONFIGURATION,
      conferencePolicy:
        input.conferenceSetup.mode === 'custom' ? 'current' : 'historical',
      playoffTeams: resolvedPlayoffTeams,
      playoffAutobids: normalizedPlayoffAutobids ?? 0,
      conferenceChampionsReceiveTopSeeds: normalizedPlayoffTop4,
    },
    playoff: { seeds: [] },
    idCounters: {
      game: 1,
      player: 1,
    },
  };

  const players = await prepareInitialRosters(league);
  const playerOrigins = buildInitialRosterOrigins(players, startYear);

  const { schedule, gamesToSave, rivalryResolution } =
    await initializeNonConScheduling(league);
  if (input.conferenceSetup.mode === 'custom') {
    const validationTeams = structuredClone(league.teams);
    const validationUserTeam = validationTeams.find(team => team.name === userTeam.name);
    if (!validationUserTeam) {
      throw new NewLeagueConfigurationError('The selected program is unavailable.');
    }
    try {
      const { fullGames } = buildFullScheduleFromExisting(
        validationUserTeam,
        validationTeams,
        gamesToSave,
        {
          year: startYear,
          seed: VALIDATION_SCHEDULE_SEED,
          requireComplete: true,
          requiredGames: buildAcceptedRivalryGames(
            rivalryResolution,
            validationTeams,
          ),
        },
      );
      assertCompleteSchedule(validationTeams, fullGames);
    } catch (error) {
      throw new NewLeagueConfigurationError(
        error instanceof Error
          ? error.message
          : 'The custom alignment cannot produce a complete schedule.',
      );
    }
  }
  await commitNewLeague({
    league,
    players,
    games: gamesToSave,
    playerOrigins,
  });

  return buildNonConData(league, schedule, rivalryResolution);
};
