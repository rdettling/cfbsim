import type { EligibleNonConOpponent } from '../../../../types/league';
import type { ScheduleConstraint } from '../../../../types/scheduleTypes';
import {
  buildAcceptedRivalryGames,
  resolveRivalries,
  resolveRivalrySite,
  rivalryKey,
  withoutDeclinedRivalries,
} from '../../../rivalryScheduling';
import { listEligibleNonConferenceOpponents } from '../../../schedule/preseasonCandidates';
import { preservesScheduleCapacityWithOpponent } from '../../../schedule/feasibility';
import { buildUserScheduleFromGames } from '../../../schedule/projection';
import { getRivalriesData } from '../../../../db/baseData';
import { loadLeagueOptional } from '../../leagueStore';
import { getCurrentYearGames, getUserTeam } from './shared';

export const listAvailableOpponents = async (
  week: number,
): Promise<EligibleNonConOpponent[]> => {
  const league = await loadLeagueOptional();
  if (!league) return [];

  const userTeam = getUserTeam(league);
  const games = await getCurrentYearGames(league);
  const schedule = buildUserScheduleFromGames(userTeam, league.teams, games);
  const availableNames = listEligibleNonConferenceOpponents(
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

  return availableNames.flatMap((name): EligibleNonConOpponent[] => {
    const opponent = teamsByName.get(name);
    if (!opponent) return [];

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
    const preservesCapacity = preservesScheduleCapacityWithOpponent({
      teams: league.teams,
      userTeamId: userTeam.id,
      opponentId: opponent.id,
      week,
      existingGames: games,
      year: league.info.currentYear,
      requiredGames,
    });
    if (!preservesCapacity) return [];

    const rivalry = rivalries.rivalries.find(
      candidate => rivalryKey(candidate.teamA, candidate.teamB) === pairKey,
    );
    const summary = {
      name: opponent.name,
      conference: opponent.conference,
      ranking: opponent.ranking,
      record: opponent.record,
      rating: opponent.rating,
    };
    if (!rivalry) {
      return [{
        ...summary,
        rivalry: null,
        site: { kind: 'selectable' },
      } satisfies EligibleNonConOpponent];
    }

    const resolvedSite = resolveRivalrySite(
      league,
      userTeam,
      opponent,
      rivalry.neutralSite,
      rivalry.venue,
    );
    const location = resolvedSite.neutralSite
      ? 'Neutral'
      : resolvedSite.homeTeam?.id === userTeam.id
        ? 'Home'
        : 'Away';

    return [{
      ...summary,
      rivalry: { name: rivalry.name },
      site: {
        kind: 'fixed',
        location,
        venue: resolvedSite.venue,
      },
    } satisfies EligibleNonConOpponent];
  });
};
