import { loadLeaguePlayersSnapshot } from '../../db/leagueRepo';
import {
  commitSeasonCompletion,
  getGameDetailsByYear,
  getGamesByYear,
} from '../../db/simRepo';
import type { LeagueState } from '../../types/league';
import { buildCompletedSeasonArtifacts } from '../league/memory';
import { finalizePostseasonRankings } from './rankings';

export const finalizeCompletedSeasonIfReady = async (league: LeagueState) => {
  if (league.info.stage === 'summary') return false;
  if (league.info.stage !== 'season' || !league.playoff.natty) return false;

  const year = league.info.currentYear;
  const games = await getGamesByYear(year);
  const championship = games.find(game => game.id === league.playoff.natty);
  if (!championship?.winnerId || games.some(game => game.winnerId === null)) {
    return false;
  }
  const [details, snapshot] = await Promise.all([
    getGameDetailsByYear(year),
    loadLeaguePlayersSnapshot(),
  ]);
  const completedLeague = structuredClone(league);
  completedLeague.info.stage = 'summary';
  finalizePostseasonRankings(completedLeague.teams, championship);
  const artifacts = buildCompletedSeasonArtifacts(
    completedLeague,
    games,
    details,
    snapshot.players,
  );
  await commitSeasonCompletion({ league: completedLeague, ...artifacts });
  Object.assign(league, completedLeague);
  return true;
};
