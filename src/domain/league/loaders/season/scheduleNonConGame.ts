import { saveLeague } from '../../../../db/leagueRepo';
import { saveGames } from '../../../../db/simRepo';
import { scheduleNonConGame as scheduleGameForWeek } from '../../../scheduleBuilder';
import { loadLeagueOrThrow } from '../../leagueStore';
import { createNonConGameRecord } from '../../seasonReset';
import { getCurrentYearGames, getUserSchedule, getUserTeam } from './shared';

export const scheduleNonConGame = async (opponentName: string, week: number): Promise<void> => {
  const league = await loadLeagueOrThrow();

  const userTeam = getUserTeam(league);
  const opponent = league.teams.find(team => team.name === opponentName);
  if (!opponent) return;

  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  if (schedule[week - 1]?.opponent) return;
  const existingGames = await getCurrentYearGames(league);
  if (existingGames.some(game => game.weekPlayed === week && (game.teamAId === opponent.id || game.teamBId === opponent.id))) {
    return;
  }
  scheduleGameForWeek(schedule, userTeam, opponent, week);

  const gameRecord = await createNonConGameRecord(
    league,
    userTeam,
    opponent,
    week,
    schedule[week - 1]?.label ?? null,
    { neutralSite: false, homeTeam: userTeam, awayTeam: opponent }
  );

  await saveGames([gameRecord]);
  await saveLeague(league);
};
