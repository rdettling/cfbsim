import { listEligibleNonConferenceOpponents } from '../../../schedule/preseasonCandidates';
import { preservesScheduleCapacityWithOpponent } from '../../../schedule/feasibility';
import { buildUserScheduleFromGames } from '../../../schedule/projection';
import { getRivalriesData } from '../../../../db/baseData';
import {
  buildAcceptedRivalryGames,
  resolveRivalries,
  rivalryKey,
  withoutDeclinedRivalries,
} from '../../../rivalryScheduling';
import { loadLeagueOptional } from '../../leagueStore';
import { getCurrentYearGames, getUserTeam } from './shared';
import type { ScheduleConstraint } from '../../../../types/scheduleTypes';

export const listAvailableTeams = async (week: number): Promise<string[]> => {
  const league = await loadLeagueOptional();
  if (!league) return [];

  const userTeam = getUserTeam(league);
  const games = await getCurrentYearGames(league);
  const schedule = buildUserScheduleFromGames(userTeam, league.teams, games);
  const available = listEligibleNonConferenceOpponents(
    schedule,
    userTeam,
    league.teams,
    week,
    games,
  );
  const rivalries = withoutDeclinedRivalries(
    await getRivalriesData(),
    league.declinedRivalries,
  );
  const baseResolution = resolveRivalries({
    teams: league.teams,
    rivalries,
    existingGames: games,
    year: league.info.currentYear,
  });
  const omittedPairs = new Set(
    baseResolution.omitted.map(warning => rivalryKey(warning.teamA, warning.teamB)),
  );
  const teamsByName = new Map(league.teams.map(team => [team.name, team]));
  return available.filter(name => {
    const opponent = teamsByName.get(name);
    if (!opponent) return false;
    const prospective = {
      teamAId: userTeam.id,
      teamBId: opponent.id,
      weekPlayed: week,
      homeTeamId: userTeam.id,
      awayTeamId: opponent.id,
      name: null,
    } satisfies ScheduleConstraint;
    const pairKey = rivalryKey(userTeam.name, opponent.name);
    const rivalryResolution = omittedPairs.has(pairKey)
      ? resolveRivalries({
          teams: league.teams,
          rivalries,
          existingGames: [...games, prospective],
          year: league.info.currentYear,
        })
      : baseResolution;
    const requiredGames = buildAcceptedRivalryGames(
      rivalryResolution,
      league.teams,
      league,
    );
    return preservesScheduleCapacityWithOpponent({
      teams: league.teams,
      userTeamId: userTeam.id,
      opponentId: opponent.id,
      week,
      existingGames: games,
      year: league.info.currentYear,
      requiredGames,
    });
  });
};
