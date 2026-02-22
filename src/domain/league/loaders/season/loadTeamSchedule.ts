import { getAllGames } from '../../../../db/simRepo';
import { buildFullScheduleFromExisting } from '../../../scheduleBuilder';
import { initializeSimData } from '../../../sim';
import { loadLeagueOrThrow } from '../../leagueStore';
import { getCurrentYearGames, getUserTeam } from './shared';

export const loadTeamSchedule = async (teamName?: string, yearParam?: number) => {
  const league = await loadLeagueOrThrow();
  const requestedYear = yearParam ?? league.info.currentYear;

  if (!league.scheduleBuilt && requestedYear === league.info.currentYear) {
    const userTeam = getUserTeam(league);
    const existingGames = await getCurrentYearGames(league);
    const { newGames } = buildFullScheduleFromExisting(userTeam, league.teams, existingGames);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, newGames);
  }

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    getUserTeam(league);

  const games = await getAllGames();
  const teamGames = games.filter(
    game =>
      (game.teamAId === team.id || game.teamBId === team.id)
  );
  const availableYears = Array.from(new Set(teamGames.map(game => game.year))).sort((a, b) => b - a);
  const selectedYear = availableYears.includes(requestedYear)
    ? requestedYear
    : (availableYears[0] ?? league.info.currentYear);
  const selectedYearGames = teamGames.filter(game => game.year === selectedYear);
  const gamesByWeek = new Map<number, (typeof teamGames)[number]>();
  selectedYearGames.forEach(game => {
    if (game.weekPlayed && game.weekPlayed > 0) {
      gamesByWeek.set(game.weekPlayed, game);
    }
  });

  const totalWeeks = league.info.lastWeek || 14;
  const toOpponentSummary = (opponentId: number) => {
    const opponent = league.teams.find(entry => entry.id === opponentId);
    if (!opponent) return null;
    return {
      name: opponent.name,
      rating: opponent.rating,
      ranking: opponent.ranking,
      record: opponent.record,
    };
  };
  const schedule = Array.from({ length: totalWeeks }, (_, index) => {
    const week = index + 1;
    const game = gamesByWeek.get(week);
    if (!game) {
      return {
        weekPlayed: week,
        opponent: null,
        result: '',
        score: '',
        spread: '',
        moneyline: '',
        id: '',
      };
    }

    const opponentId = game.teamAId === team.id ? game.teamBId : game.teamAId;
    const opponent = toOpponentSummary(opponentId);
    const isHome = game.homeTeamId === team.id;
    const isAway = game.awayTeamId === team.id;
    const location = game.neutralSite
      ? 'Neutral'
      : isHome
        ? 'Home'
        : isAway
          ? 'Away'
          : undefined;

    const isTeamA = game.teamAId === team.id;
    const scoreA = game.scoreA ?? 0;
    const scoreB = game.scoreB ?? 0;
    let result = '';
    if (game.winnerId) {
      const teamScore = isTeamA ? scoreA : scoreB;
      const oppScore = isTeamA ? scoreB : scoreA;
      result = game.winnerId === team.id ? 'W' : 'L';
      return {
        weekPlayed: week,
        opponent,
        result,
        score: `${teamScore}-${oppScore}`,
        spread: isTeamA ? game.spreadA : game.spreadB,
        moneyline: isTeamA ? game.moneylineA : game.moneylineB,
        id: `${game.id}`,
        location,
        label: game.name ?? game.baseLabel ?? '',
      };
    }

    return {
      weekPlayed: week,
      opponent,
      result: '',
      score: '',
      spread: isTeamA ? game.spreadA : game.spreadB,
      moneyline: isTeamA ? game.moneylineA : game.moneylineB,
      id: `${game.id}`,
      location,
      label: game.name ?? game.baseLabel ?? '',
    };
  });

  return {
    info: league.info,
    team,
    schedule,
    teams: league.teams.map(entry => entry.name).sort((a, b) => a.localeCompare(b)),
    conferences: league.conferences,
    years: availableYears,
    selected_year: selectedYear,
  };
};
