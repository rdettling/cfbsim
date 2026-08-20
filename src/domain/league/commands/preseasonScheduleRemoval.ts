import { saveLeague } from '../../../db/leagueRepo';
import {
  deleteGameAndSaveLeague,
  getGameById,
} from '../../../db/simRepo';
import { getRivalriesData } from '../../../db/baseData';
import { rivalryKey } from '../../rivalryScheduling';
import { loadLeagueOrThrow } from '../leagueStore';
import { requireEditablePreseason } from './preseasonScheduling';
import { getUserTeam } from '../loaders/season/shared';

const addDeclinedRivalry = (declined: string[], key: string) =>
  declined.includes(key) ? declined : [...declined, key];

export const removePreseasonGame = async (gameId: number): Promise<void> => {
  if (!Number.isInteger(gameId) || gameId < 1) {
    throw new Error('The scheduled game could not be identified.');
  }

  const league = await loadLeagueOrThrow();
  requireEditablePreseason(league);
  const game = await getGameById(gameId);
  const userTeam = getUserTeam(league);
  if (
    !game ||
    game.year !== league.info.currentYear ||
    (game.teamAId !== userTeam.id && game.teamBId !== userTeam.id)
  ) {
    throw new Error('The scheduled game is not available for removal.');
  }

  const teamA = league.teams.find(team => team.id === game.teamAId);
  const teamB = league.teams.find(team => team.id === game.teamBId);
  if (!teamA || !teamB) {
    throw new Error('The scheduled teams are unavailable.');
  }

  const conferenceGame =
    teamA.conference !== 'Independent' &&
    teamA.conference === teamB.conference;
  if (conferenceGame) {
    teamA.confGames = Math.max(0, teamA.confGames - 1);
    teamB.confGames = Math.max(0, teamB.confGames - 1);
  } else {
    teamA.nonConfGames = Math.max(0, teamA.nonConfGames - 1);
    teamB.nonConfGames = Math.max(0, teamB.nonConfGames - 1);
  }

  const key = rivalryKey(teamA.name, teamB.name);
  const rivalries = await getRivalriesData();
  const isRivalry = rivalries.rivalries.some(
    rivalry => rivalryKey(rivalry.teamA, rivalry.teamB) === key,
  );
  if (isRivalry) {
    league.declinedRivalries = addDeclinedRivalry(
      league.declinedRivalries,
      key,
    );
    league.pending_rivalries = league.pending_rivalries.filter(
      pending => rivalryKey(pending.teamA, pending.teamB) !== key,
    );
  }

  await deleteGameAndSaveLeague(game.id, league);
};

export const dismissPendingRivalry = async (
  teamA: string,
  teamB: string,
): Promise<void> => {
  const league = await loadLeagueOrThrow();
  requireEditablePreseason(league);
  const userTeam = getUserTeam(league);
  const key = rivalryKey(teamA, teamB);
  const pending = league.pending_rivalries.find(
    rivalry => rivalryKey(rivalry.teamA, rivalry.teamB) === key,
  );
  if (
    !pending ||
    (pending.teamA !== userTeam.name && pending.teamB !== userTeam.name)
  ) {
    throw new Error('The pending rivalry is not available for removal.');
  }

  league.pending_rivalries = league.pending_rivalries.filter(
    rivalry => rivalryKey(rivalry.teamA, rivalry.teamB) !== key,
  );
  league.declinedRivalries = addDeclinedRivalry(
    league.declinedRivalries,
    key,
  );
  await saveLeague(league);
};
