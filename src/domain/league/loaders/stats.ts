import { getAllPlayers, getAllGames } from '../../../db/simRepo';
import { saveLeague } from '../../../db/leagueRepo';
import { ensureRosters } from '../../roster';
import { loadLeagueOrThrow } from '../leagueStore';
import type { Team } from '../../../types/domain';
import { buildScheduleGameForTeam } from '../utils/schedule';

const sortStandings = (teams: Team[]) => {
  return teams.slice().sort((a, b) => {
    const aConfGames = a.confWins + a.confLosses;
    const bConfGames = b.confWins + b.confLosses;
    const aConfPct = aConfGames ? a.confWins / aConfGames : 0;
    const bConfPct = bConfGames ? b.confWins / bConfGames : 0;
    if (bConfPct !== aConfPct) return bConfPct - aConfPct;
    if (b.confWins !== a.confWins) return b.confWins - a.confWins;
    if (a.confLosses !== b.confLosses) return a.confLosses - b.confLosses;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    if (a.totalLosses !== b.totalLosses) return a.totalLosses - b.totalLosses;
    return a.ranking - b.ranking;
  });
};

export const loadRatingsStats = async () => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const players = (await getAllPlayers()).filter(player => player.active);
  const teams = league.teams;

  const totalCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatings: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsFr: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsSo: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsJr: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsSr: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  players.forEach(player => {
    const star = Math.min(5, Math.max(1, player.stars || 1));
    totalCounts[star] += 1;
    totalRatings[star] += player.rating;
    totalRatingsFr[star] += player.rating_fr;
    totalRatingsSo[star] += player.rating_so;
    totalRatingsJr[star] += player.rating_jr;
    totalRatingsSr[star] += player.rating_sr;
  });

  const avg = (sum: number, count: number) => (count ? Math.round(sum / count) : 0);

  const total_star_counts = {
    counts: totalCounts,
    avg_ratings: {
      1: avg(totalRatings[1], totalCounts[1]),
      2: avg(totalRatings[2], totalCounts[2]),
      3: avg(totalRatings[3], totalCounts[3]),
      4: avg(totalRatings[4], totalCounts[4]),
      5: avg(totalRatings[5], totalCounts[5]),
    },
    avg_ratings_fr: {
      1: avg(totalRatingsFr[1], totalCounts[1]),
      2: avg(totalRatingsFr[2], totalCounts[2]),
      3: avg(totalRatingsFr[3], totalCounts[3]),
      4: avg(totalRatingsFr[4], totalCounts[4]),
      5: avg(totalRatingsFr[5], totalCounts[5]),
    },
    avg_ratings_so: {
      1: avg(totalRatingsSo[1], totalCounts[1]),
      2: avg(totalRatingsSo[2], totalCounts[2]),
      3: avg(totalRatingsSo[3], totalCounts[3]),
      4: avg(totalRatingsSo[4], totalCounts[4]),
      5: avg(totalRatingsSo[5], totalCounts[5]),
    },
    avg_ratings_jr: {
      1: avg(totalRatingsJr[1], totalCounts[1]),
      2: avg(totalRatingsJr[2], totalCounts[2]),
      3: avg(totalRatingsJr[3], totalCounts[3]),
      4: avg(totalRatingsJr[4], totalCounts[4]),
      5: avg(totalRatingsJr[5], totalCounts[5]),
    },
    avg_ratings_sr: {
      1: avg(totalRatingsSr[1], totalCounts[1]),
      2: avg(totalRatingsSr[2], totalCounts[2]),
      3: avg(totalRatingsSr[3], totalCounts[3]),
      4: avg(totalRatingsSr[4], totalCounts[4]),
      5: avg(totalRatingsSr[5], totalCounts[5]),
    },
  };

  const team_counts_by_prestige = Array.from(new Set(teams.map(team => team.prestige)))
    .sort((a, b) => a - b)
    .map(prestige => ({
      prestige,
      team_count: teams.filter(team => team.prestige === prestige).length,
    }));

  const prestige_stars_table = team_counts_by_prestige.map(entry => {
    const prestigeTeams = teams.filter(team => team.prestige === entry.prestige);
    const teamIds = new Set(prestigeTeams.map(team => team.id));
    const prestigePlayers = players.filter(player => teamIds.has(player.teamId));
    const totalPlayers = prestigePlayers.length || 1;
    const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let starSum = 0;
    const teamRatingSum = prestigeTeams.reduce((sum, team) => sum + team.rating, 0);
    const teamRatingAvg = prestigeTeams.length
      ? Math.round((teamRatingSum / prestigeTeams.length) * 10) / 10
      : 0;

    prestigePlayers.forEach(player => {
      const star = Math.min(5, Math.max(1, player.stars || 1));
      starCounts[star] += 1;
      starSum += star;
    });

    return {
      prestige: entry.prestige,
      team_count: entry.team_count,
      average_stars: totalPlayers ? Math.round((starSum / totalPlayers) * 100) / 100 : 0,
      avg_rating: teamRatingAvg,
      star_percentages: {
        1: Math.round((starCounts[1] / totalPlayers) * 1000) / 10,
        2: Math.round((starCounts[2] / totalPlayers) * 1000) / 10,
        3: Math.round((starCounts[3] / totalPlayers) * 1000) / 10,
        4: Math.round((starCounts[4] / totalPlayers) * 1000) / 10,
        5: Math.round((starCounts[5] / totalPlayers) * 1000) / 10,
      },
    };
  });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    total_star_counts,
    prestige_stars_table,
    conferences: league.conferences,
    teams: league.teams.slice().sort((a, b) => b.rating - a.rating),
  };
};

export const loadStandings = async (conferenceName: string) => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

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

  const rankedTeams = sortStandings(teams).map(team => {
    const lastWeek = league.info.currentWeek - 1;
    const currentWeek = league.info.currentWeek;
    const lastGameRecord = games.find(
      game =>
        game.weekPlayed === lastWeek &&
        (game.teamAId === team.id || game.teamBId === team.id)
    );
    const nextGameRecord = games.find(
      game =>
        game.weekPlayed === currentWeek &&
        (game.teamAId === team.id || game.teamBId === team.id)
    );

    const last_game =
      lastGameRecord && lastGameRecord.winnerId
        ? buildScheduleGameForTeam(team, lastGameRecord, teamsById)
        : null;
    const next_game = nextGameRecord
      ? buildScheduleGameForTeam(team, nextGameRecord, teamsById)
      : null;

    return {
      ...team,
      last_game,
      next_game,
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
