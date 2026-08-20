import { saveGamesAndLeague } from '../../../db/simRepo';
import {
  getOpponentEligibility,
  type OpponentEligibilityFailure,
} from '../../schedule/preseasonCandidates';
import {
  buildScheduleLabel,
  buildUserScheduleFromGames,
} from '../../schedule/projection';
import { loadLeagueOrThrow } from '../leagueStore';
import { createNonConGameRecord } from '../seasonReset';
import {
  getCurrentYearGames,
  getUserTeam,
} from '../loaders/season/shared';
import { getRivalriesData } from '../../../db/baseData';
import type { ScheduleConstraint } from '../../../types/scheduleTypes';
import type { ScheduleNonConGameInput } from '../../../types/league';
import {
  resolveRivalries,
  resolveRivalrySite,
  rivalryKey,
  withoutDeclinedRivalries,
} from '../../rivalryScheduling';
import { requireEditablePreseason } from './preseasonScheduling';

const unavailableOpponentMessage = (
  reason: OpponentEligibilityFailure,
  opponentName: string,
  week: number,
) => {
  switch (reason) {
    case 'invalid_week':
      return `Week ${week} is not available for preseason scheduling.`;
    case 'occupied_week':
      return `Week ${week} already has a scheduled game.`;
    case 'same_team':
      return 'A team cannot schedule itself.';
    case 'duplicate_opponent':
      return `${opponentName} is already on the schedule.`;
    case 'opponent_busy':
      return `${opponentName} already has a game in Week ${week}.`;
    case 'same_conference':
      return `${opponentName} is not an eligible non-conference opponent.`;
    case 'user_capacity':
      return 'No non-conference scheduling capacity remains.';
    case 'opponent_capacity':
      return `${opponentName} has no non-conference scheduling capacity remaining.`;
  }
};

export const scheduleNonConGame = async ({
  opponentName,
  week,
  site: requestedSite,
}: ScheduleNonConGameInput): Promise<void> => {
  const league = await loadLeagueOrThrow();
  requireEditablePreseason(league);

  const userTeam = getUserTeam(league);
  const opponent = league.teams.find(team => team.name === opponentName);
  if (!opponent) {
    throw new Error(`${opponentName} is not available for scheduling.`);
  }

  const existingGames = await getCurrentYearGames(league);
  const schedule = buildUserScheduleFromGames(
    userTeam,
    league.teams,
    existingGames,
  );
  const eligibility = getOpponentEligibility(
    schedule,
    userTeam,
    opponent,
    week,
    existingGames,
  );
  if (!eligibility.eligible) {
    throw new Error(
      unavailableOpponentMessage(eligibility.reason, opponent.name, week),
    );
  }
  const rivalries = await getRivalriesData();
  const rivalry = rivalries.rivalries.find(
    rivalry =>
      (rivalry.teamA === userTeam.name && rivalry.teamB === opponent.name) ||
      (rivalry.teamB === userTeam.name && rivalry.teamA === opponent.name),
  );
  let site: ReturnType<typeof resolveRivalrySite>;
  if (rivalry) {
    if (requestedSite.kind !== 'rivalry') {
      throw new Error(
        `${rivalry.name ?? 'This rivalry'} uses a fixed rivalry site and cannot be overridden.`,
      );
    }
    site = resolveRivalrySite(
      league,
      userTeam,
      opponent,
      rivalry.neutralSite,
      rivalry.venue,
    );
  } else {
    if (
      requestedSite.kind !== 'manual' ||
      (requestedSite.location !== 'Home' && requestedSite.location !== 'Away')
    ) {
      throw new Error('Choose Home or Away for this game.');
    }
    site = requestedSite.location === 'Home'
      ? {
          neutralSite: false,
          homeTeam: userTeam,
          awayTeam: opponent,
          venue: null,
        }
      : {
          neutralSite: false,
          homeTeam: opponent,
          awayTeam: userTeam,
          venue: null,
        };
  }
  const prospective = {
    teamAId: userTeam.id,
    teamBId: opponent.id,
    weekPlayed: week,
    homeTeamId: site.homeTeam?.id ?? null,
    awayTeamId: site.awayTeam?.id ?? null,
    name: rivalry?.name ?? null,
  } satisfies ScheduleConstraint;
  const selectedRivalryKey = rivalry
    ? rivalryKey(rivalry.teamA, rivalry.teamB)
    : null;
  const activeRivalries = withoutDeclinedRivalries(
    rivalries,
    league.declinedRivalries.filter(key => key !== selectedRivalryKey),
  );
  const rivalryResolution = resolveRivalries({
    teams: league.teams,
    rivalries: activeRivalries,
    existingGames: [...existingGames, prospective],
    year: league.info.currentYear,
  });
  if (!rivalryResolution.feasible) {
    throw new Error(
      `${opponent.name} would leave the remaining schedule impossible to complete.`,
    );
  }
  const gameName = rivalry
    ? rivalry.name ?? 'Rivalry'
    : buildScheduleLabel(userTeam, opponent);

  userTeam.nonConfGames += 1;
  opponent.nonConfGames += 1;

  const gameRecord = await createNonConGameRecord(
    league,
    userTeam,
    opponent,
    week,
    gameName,
    { ...site, rivalryKey: selectedRivalryKey },
  );
  if (rivalry) {
    league.declinedRivalries = league.declinedRivalries.filter(
      key => key !== selectedRivalryKey,
    );
    league.pending_rivalries = league.pending_rivalries.filter(
      pending =>
        !(
          (pending.teamA === userTeam.name && pending.teamB === opponent.name) ||
          (pending.teamB === userTeam.name && pending.teamA === opponent.name)
        ),
    );
  }

  await saveGamesAndLeague([gameRecord], league);
};
