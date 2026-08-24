import { getAllGames } from '../../../db/simRepo';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildScheduleGameForTeam } from '../utils/scheduleView';
import {
  buildConferenceStandings,
  resolveConferenceChampion,
} from '../utils/standings';
import { buildOddsFields, loadOddsContext } from '../../odds';

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

  const standings = buildConferenceStandings({
    teams,
    games,
    year: league.info.currentYear,
    finalStandings: conference?.finalStandings ?? null,
  });
  const rankedTeams = standings.map(standing => {
    const team = standing.team;
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
      confWins: standing.conferenceWins,
      confLosses: standing.conferenceLosses,
      tiebreaker: standing.resolvedBy,
      last_game: lastGameRecord && lastGameRecord.winnerId
        ? buildScheduleGameForTeam(team, lastGameRecord, teamsById)
        : null,
      next_game: nextGameRecord
        ? buildScheduleGameForTeam(team, nextGameRecord, teamsById)
        : null,
    };
  });

  let championship = null;
  if (conference) {
    const champion = resolveConferenceChampion({ conference, standings, games });
    const projectedTeamA = standings[0]?.team;
    const projectedTeamB = standings[1]?.team;
    if (!projectedTeamA || !projectedTeamB) {
      throw new Error(`${conference.confName} requires two championship participants.`);
    }
    if (conference.championship === null) {
      const projectedOdds = buildOddsFields(
        projectedTeamA,
        projectedTeamB,
        null,
        true,
        await loadOddsContext(),
      );
      championship = {
        status: 'projected' as const,
        gameId: null,
        teamA: projectedTeamA,
        teamB: projectedTeamB,
        winnerId: null,
        scoreA: null,
        scoreB: null,
        spreadA: projectedOdds.spreadA,
        spreadB: projectedOdds.spreadB,
      };
    } else {
      const game = games.find(candidate => candidate.id === conference.championship);
      if (!game) throw new Error(`${conference.confName} championship game is unavailable.`);
      const teamA = teamsById.get(game.teamAId);
      const teamB = teamsById.get(game.teamBId);
      if (!teamA || !teamB) throw new Error(`${conference.confName} championship participants are invalid.`);
      championship = {
        status: champion?.status === 'actual' ? 'complete' as const : 'scheduled' as const,
        gameId: game.id,
        teamA,
        teamB,
        winnerId: champion?.status === 'actual' ? champion.team.id : null,
        scoreA: game.scoreA,
        scoreB: game.scoreB,
        spreadA: game.spreadA,
        spreadB: game.spreadB,
      };
    }
  }

  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conference: conference?.confName ?? 'Independent',
    teams: rankedTeams,
    championship,
    conferences: league.conferences,
  };
};
