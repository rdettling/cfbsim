import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import type {
  RatingsStatsPageResult,
  StarRating,
  StarRatingRecord,
} from '../../../types/stats';

export const loadRatingsStats = async (): Promise<RatingsStatsPageResult> => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const teams = league.teams;

  const totalCounts: StarRatingRecord = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatings: StarRatingRecord = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsFr: StarRatingRecord = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsSo: StarRatingRecord = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsJr: StarRatingRecord = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsSr: StarRatingRecord = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  players.forEach(player => {
    const star = Math.min(5, Math.max(1, player.stars || 1)) as StarRating;
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
    const starCounts: StarRatingRecord = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let starSum = 0;
    const teamRatingSum = prestigeTeams.reduce((sum, team) => sum + team.rating, 0);
    const teamRatingAvg = prestigeTeams.length
      ? Math.round((teamRatingSum / prestigeTeams.length) * 10) / 10
      : 0;

    prestigePlayers.forEach(player => {
      const star = Math.min(5, Math.max(1, player.stars || 1)) as StarRating;
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
