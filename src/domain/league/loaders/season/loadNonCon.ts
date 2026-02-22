import { saveLeague } from '../../../../db/leagueRepo';
import { getAllPlayers, saveGames, savePlayers } from '../../../../db/simRepo';
import type { NonConData } from '../../../../types/league';
import { loadLeagueOrThrow } from '../../leagueStore';
import { advanceToPreseason } from '../../stages';
import { getUserSchedule, getUserTeam } from './shared';

export const loadNonCon = async (): Promise<NonConData> => {
  const league = await loadLeagueOrThrow();

  if (league.info.stage === 'roster_cuts') {
    const players = await getAllPlayers();
    const { advanced, gamesToSave } = await advanceToPreseason(league, players);
    if (advanced) {
      if (gamesToSave.length) {
        await saveGames(gamesToSave);
      }
      await savePlayers(players);
      await saveLeague(league);
    }
  }

  const team = getUserTeam(league);
  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  return {
    info: league.info,
    team,
    schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};
