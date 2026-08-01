import { getAllGames } from '../../../../db/simRepo';
import { getSeasonMemory } from '../../../../db/seasonMemoryRepo';
import { SeasonMemoryDataIntegrityError } from '../../../../types/memory';
import { loadLeagueOrThrow } from '../../leagueStore';
import { getUserTeam } from './shared';

const formatSelectedYearRecord = (
  games: Awaited<ReturnType<typeof getAllGames>>,
  teamId: number,
) => {
  let wins = 0;
  let losses = 0;

  for (const game of games) {
    if (game.winnerId === null) continue;
    if (game.winnerId === teamId) {
      wins += 1;
    } else {
      losses += 1;
    }
  }

  return `${wins}-${losses}`;
};

export const loadTeamSchedule = async (teamName?: string, yearParam?: number) => {
  const league = await loadLeagueOrThrow();
  const requestedYear = yearParam ?? league.info.currentYear;

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
  const selectedSeasonTeams = new Map(
    (selectedYear === league.info.currentYear
      ? league.teams.map(entry => ({
          teamId: entry.id,
          rating: entry.rating,
          prestige: entry.prestige,
          ranking: entry.ranking,
          record: entry.record,
        }))
      : (await getSeasonMemory(selectedYear))?.teamSnapshots ?? []
    ).map(snapshot => [snapshot.teamId, snapshot]),
  );
  const selectedTeamSnapshot = selectedSeasonTeams.get(team.id);
  if (!selectedTeamSnapshot) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${selectedYear} is missing the team snapshot for ${team.name}.`,
    );
  }
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
    const opponentSnapshot = selectedSeasonTeams.get(opponentId);
    if (!opponentSnapshot) {
      throw new SeasonMemoryDataIntegrityError(
        `Season ${selectedYear} is missing the team snapshot for ${opponent.name}.`,
      );
    }
    return {
      name: opponent.name,
      rating: opponentSnapshot.rating,
      ranking: opponentSnapshot.ranking,
      record: opponentSnapshot.record,
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
        venue: null,
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
        venue: game.venue,
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
      venue: game.venue,
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
    selectedTeamMetrics: {
      record: formatSelectedYearRecord(selectedYearGames, team.id),
      rating: selectedTeamSnapshot.rating,
      prestige: selectedTeamSnapshot.prestige,
    },
  };
};
