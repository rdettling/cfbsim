import { getAllGames } from '../../../db/simRepo';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildScheduleGameForTeam } from '../utils/scheduleView';
import { sortStandingsTeams } from '../utils/standings';

export const loadStandings = async (conferenceName: string) => {
  const league = await loadLeagueOrThrow();
  const normalized = conferenceName.toLowerCase();
  const isIndependent = normalized === 'independent';
  const conference = isIndependent
    ? null
    : league.conferences.find(conf => conf.confName.toLowerCase() === normalized) ?? null;
  const teams = isIndependent
    ? league.teams.filter(team => team.conference === 'Independent')
    : league.teams.filter(team => team.conference === conference?.confName);
  const games = (await getAllGames()).filter(game => game.year === league.info.currentYear);
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const rankedTeams = sortStandingsTeams(teams).map(team => {
    const lastGameRecord = games.find(
      game => game.weekPlayed === league.info.currentWeek - 1 &&
        (game.teamAId === team.id || game.teamBId === team.id),
    );
    const nextGameRecord = games.find(
      game => game.weekPlayed === league.info.currentWeek &&
        (game.teamAId === team.id || game.teamBId === team.id),
    );

    return {
      ...team,
      last_game: lastGameRecord && lastGameRecord.winnerId
        ? buildScheduleGameForTeam(team, lastGameRecord, teamsById)
        : null,
      next_game: nextGameRecord
        ? buildScheduleGameForTeam(team, nextGameRecord, teamsById)
        : null,
    };
  });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conference: conference?.confName ?? 'Independent',
    teams: rankedTeams,
    conferences: league.conferences,
  };
};
