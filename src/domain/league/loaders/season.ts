import type { Info, Team } from '../../../types/domain';
import type { LaunchProps, LeagueState, NonConData } from '../../../types/league';
import type { YearData } from '../../../types/baseData';
import type { GameRecord } from '../../../types/db';
import {
  clearBaseDataCache,
  getYearsIndex,
  getRatingsData,
  getYearData,
} from '../../../db/baseData';
import { saveLeague } from '../../../db/leagueRepo';
import {
  clearAllSimData,
  getAllGames,
  getAllPlays,
  getAllGameLogs,
  getAllPlayers,
  getGameById,
  getDrivesByGame,
  getPlaysByGame,
  saveGames,
  savePlayers,
} from '../../../db/simRepo';
import { buildPreviewData, buildTeamsAndConferences } from '../../baseData';
import {
  buildFullScheduleFromExisting,
  buildUserScheduleFromGames,
  listAvailableTeams as listTeamsForWeek,
  scheduleNonConGame as scheduleGameForWeek,
} from '../../scheduleBuilder';
import { buildDriveResponse, initializeSimData } from '../../sim';
import { DEFAULT_SETTINGS } from '../../../types/league';
import { getLastWeekByPlayoffTeams } from '../postseason';
import { normalizeLeague } from '../normalize';
import { loadLeagueOptional, loadLeagueOrThrow } from '../leagueStore';
import { initializeNonConScheduling, createNonConGameRecord } from '../seasonReset';
import { advanceToPreseason } from '../stages';
import { ensureRosters } from '../../roster';

const getUserSchedule = async (league: LeagueState, weeks?: number, year?: number) => {
  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const targetYear = year ?? league.info.currentYear;
  const games = (await getAllGames()).filter(game => game.year === targetYear);
  return buildUserScheduleFromGames(userTeam, league.teams, games, weeks);
};

const primeHistoryData = async (startYear: number) => {
  const yearsIndex = await getYearsIndex();
  const years = yearsIndex.years
    .map(entry => Number(entry))
    .filter(year => year < startYear);

  await Promise.all(
    years.map(async year => {
      await Promise.all([getRatingsData(String(year)), getYearData(String(year))]);
    })
  );
};

export const loadHomeData = async (year?: string): Promise<LaunchProps> => {
  const yearsIndex = await getYearsIndex();
  const years = yearsIndex.years;
  const selectedYear = year || years[0] || null;
  const preview = selectedYear ? await buildPreviewData(selectedYear) : null;
  const league = await loadLeagueOptional();

  return {
    info: league?.info ?? null,
    years,
    preview,
    selected_year: selectedYear,
  };
};

type PlayoffInitSettings = {
  teams: number;
  autobids?: number;
  conf_champ_top_4?: boolean;
};

export const startNewLeague = async (
  teamName: string,
  year: string,
  playoffSettings?: PlayoffInitSettings
): Promise<NonConData> => {
  await clearAllSimData();
  await clearBaseDataCache();
  const [yearData, teamsAndConferences] = await Promise.all([
    getYearData(year),
    buildTeamsAndConferences(year),
  ]);
  const { teams, conferences } = teamsAndConferences;
  const userTeam = teams.find(team => team.name === teamName) ?? teams[0];
  const startYear = Number(year);
  const typedYearData = yearData as YearData;
  const yearPlayoff = typedYearData.playoff ?? null;
  const resolvedPlayoffTeams =
    playoffSettings?.teams ?? yearPlayoff?.teams ?? DEFAULT_SETTINGS.playoff_teams;
  const resolvedPlayoffAutobids =
    playoffSettings?.autobids ??
    yearPlayoff?.conf_champ_autobids ??
    (resolvedPlayoffTeams === 12 ? DEFAULT_SETTINGS.playoff_autobids : undefined);
  const resolvedPlayoffTop4 =
    playoffSettings?.conf_champ_top_4 ??
    yearPlayoff?.conf_champ_top_4 ??
    (resolvedPlayoffTeams === 12 ? DEFAULT_SETTINGS.playoff_conf_champ_top_4 : false);
  const normalizedPlayoffAutobids =
    resolvedPlayoffTeams === 12 ? resolvedPlayoffAutobids : undefined;
  const normalizedPlayoffTop4 = resolvedPlayoffTeams === 12 ? resolvedPlayoffTop4 : false;

  const info: Info = {
    currentWeek: 1,
    currentYear: startYear,
    startYear,
    stage: 'preseason',
    team: userTeam?.name ?? '',
    lastWeek: getLastWeekByPlayoffTeams(resolvedPlayoffTeams),
    colorPrimary: userTeam?.colorPrimary,
    colorSecondary: userTeam?.colorSecondary,
  };

  const league: LeagueState = {
    info,
    teams,
    conferences,
    pending_rivalries: [],
    rivalryHostSeeds: {},
    scheduleBuilt: false,
    simInitialized: false,
    settings: {
      ...DEFAULT_SETTINGS,
      playoff_teams: resolvedPlayoffTeams,
      playoff_autobids: normalizedPlayoffAutobids,
      playoff_conf_champ_top_4: normalizedPlayoffTop4,
    },
    playoff: { seeds: [] },
    idCounters: {
      game: 1,
      drive: 1,
      play: 1,
      gameLog: 1,
      player: 1,
    },
  };

  normalizeLeague(league);
  await ensureRosters(league);
  await primeHistoryData(startYear);

  const { schedule, gamesToSave } = await initializeNonConScheduling(league);
  if (gamesToSave.length) {
    await saveGames(gamesToSave);
  }

  await saveLeague(league);

  return {
    info: league.info,
    team: userTeam,
    schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};

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

  const team = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  return {
    info: league.info,
    team,
    schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};

export const loadDashboard = async () => {
  const league = await loadLeagueOrThrow();

  if (!league.scheduleBuilt) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const existingGames = (await getAllGames()).filter(game => game.year === league.info.currentYear);
    const { newGames } = buildFullScheduleFromExisting(userTeam, league.teams, existingGames);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, newGames);
  }

  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const confTeams = league.teams
    .filter(team => team.conference === userTeam.conference)
    .sort((a, b) => a.ranking - b.ranking);

  const top10 = [...league.teams].sort((a, b) => a.ranking - b.ranking).slice(0, 10);

  const schedule = await getUserSchedule(league, league.info.lastWeek || 14, league.info.currentYear);
  const currentWeekIndex = Math.max(league.info.currentWeek - 1, 0);
  const prevGame = currentWeekIndex > 0 ? schedule[currentWeekIndex - 1] : null;
  const currGame = schedule[currentWeekIndex] ?? null;

  const lastWeek = Math.max(league.info.currentWeek - 1, 1);
  const games = await getAllGames();
  const top_games = games
    .filter(
      game =>
        game.year === league.info.currentYear &&
        game.weekPlayed === lastWeek &&
        game.winnerId !== null &&
        game.headline
    )
    .sort((a, b) => (b.watchability ?? 0) - (a.watchability ?? 0))
    .slice(0, 5)
    .map(game => ({
      id: game.id,
      headline: game.headline ?? '',
      subtitle: game.headline_subtitle ?? null,
      tags: game.headline_tags ?? [],
    }));

  return {
    info: league.info,
    prev_game: prevGame,
    curr_game: currGame,
    team: userTeam,
    confTeams,
    top_10: top10,
    top_games,
    conferences: league.conferences,
  };
};

export const loadTeamSchedule = async (teamName?: string, yearParam?: number) => {
  const league = await loadLeagueOrThrow();
  const requestedYear = yearParam ?? league.info.currentYear;

  if (!league.scheduleBuilt && requestedYear === league.info.currentYear) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const existingGames = (await getAllGames()).filter(game => game.year === league.info.currentYear);
    const { newGames } = buildFullScheduleFromExisting(userTeam, league.teams, existingGames);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, newGames);
  }

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

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
    const opponent = league.teams.find(entry => entry.id === opponentId);
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
        opponent: opponent
          ? {
              name: opponent.name,
              rating: opponent.rating,
              ranking: opponent.ranking,
              record: opponent.record,
            }
          : null,
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
      opponent: opponent
        ? {
            name: opponent.name,
            rating: opponent.rating,
            ranking: opponent.ranking,
            record: opponent.record,
          }
        : null,
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

export const loadWeekSchedule = async (week: number) => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const games = await getAllGames();
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const weekGames = games
    .filter(game => game.weekPlayed === week && game.year === league.info.currentYear)
    .map(game => {
      const teamA = teamsById.get(game.teamAId)!;
      const teamB = teamsById.get(game.teamBId)!;
      return {
        id: game.id,
        label: game.baseLabel,
        base_label: game.baseLabel,
        teamA,
        teamB,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        neutralSite: game.neutralSite,
        rankATOG: game.rankATOG,
        rankBTOG: game.rankBTOG,
        scoreA: game.scoreA ?? undefined,
        scoreB: game.scoreB ?? undefined,
        spreadA: game.spreadA,
        spreadB: game.spreadB,
        winner: Boolean(game.winnerId),
        overtime: game.overtime,
        watchability: game.watchability ?? 0,
      };
    })
    .sort((a, b) => b.watchability - a.watchability);

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    games: weekGames,
    conferences: league.conferences,
  };
};

type TeamPreviewMetricKey =
  | 'yards_per_game'
  | 'pass_yards_per_game'
  | 'pass_tds_per_game'
  | 'rush_yards_per_game'
  | 'turnovers_per_game'
  | 'points_per_game';

const average = (total: number, divisor: number) => {
  if (!divisor) return 0;
  return Math.round((total / divisor) * 10) / 10;
};

const buildTeamStatsAndRanks = (
  teams: Team[],
  allGames: Awaited<ReturnType<typeof getAllGames>>,
  allPlays: Awaited<ReturnType<typeof getAllPlays>>,
  targetGame: GameRecord
) => {
  const pregameGames = allGames.filter(
    game =>
      game.year === targetGame.year &&
      game.winnerId !== null &&
      game.weekPlayed < targetGame.weekPlayed
  );
  const pregameGameIds = new Set(pregameGames.map(game => game.id));
  const pregamePlays = allPlays.filter(play => pregameGameIds.has(play.gameId));

  const gamesByTeamId = new Map<number, number>();
  const pointsByTeamId = new Map<number, number>();
  const rawStats = new Map<
    number,
    {
      passYards: number;
      passTds: number;
      rushYards: number;
      turnovers: number;
    }
  >();

  teams.forEach(team => {
    gamesByTeamId.set(team.id, 0);
    pointsByTeamId.set(team.id, 0);
    rawStats.set(team.id, {
      passYards: 0,
      passTds: 0,
      rushYards: 0,
      turnovers: 0,
    });
  });

  pregameGames.forEach(game => {
    gamesByTeamId.set(game.teamAId, (gamesByTeamId.get(game.teamAId) ?? 0) + 1);
    gamesByTeamId.set(game.teamBId, (gamesByTeamId.get(game.teamBId) ?? 0) + 1);
    pointsByTeamId.set(game.teamAId, (pointsByTeamId.get(game.teamAId) ?? 0) + (game.scoreA ?? 0));
    pointsByTeamId.set(game.teamBId, (pointsByTeamId.get(game.teamBId) ?? 0) + (game.scoreB ?? 0));
  });

  pregamePlays.forEach(play => {
    const teamStats = rawStats.get(play.offenseId);
    if (!teamStats) return;

    if (play.playType === 'pass') {
      teamStats.passYards += play.yardsGained;
      if (play.result === 'touchdown') {
        teamStats.passTds += 1;
      }
      if (play.result === 'interception') {
        teamStats.turnovers += 1;
      }
      if (play.result === 'fumble') {
        teamStats.turnovers += 1;
      }
      return;
    }

    if (play.playType === 'run') {
      teamStats.rushYards += play.yardsGained;
      if (play.result === 'fumble') {
        teamStats.turnovers += 1;
      }
      return;
    }

    if (play.result === 'fumble') {
      teamStats.turnovers += 1;
    }
  });

  const teamStatsById = new Map<
    number,
    Record<TeamPreviewMetricKey, number>
  >();

  teams.forEach(team => {
    const games = gamesByTeamId.get(team.id) ?? 0;
    const stats = rawStats.get(team.id)!;
    const teamStats = {
      yards_per_game: average(stats.passYards + stats.rushYards, games),
      pass_yards_per_game: average(stats.passYards, games),
      pass_tds_per_game: average(stats.passTds, games),
      rush_yards_per_game: average(stats.rushYards, games),
      turnovers_per_game: average(stats.turnovers, games),
      points_per_game: average(pointsByTeamId.get(team.id) ?? 0, games),
    };
    teamStatsById.set(team.id, teamStats);
  });

  const rankDirections: Record<TeamPreviewMetricKey, 'asc' | 'desc'> = {
    yards_per_game: 'desc',
    pass_yards_per_game: 'desc',
    pass_tds_per_game: 'desc',
    rush_yards_per_game: 'desc',
    turnovers_per_game: 'asc',
    points_per_game: 'desc',
  };

  const ranksByTeamId = new Map<number, Record<TeamPreviewMetricKey, number>>();
  const keys = Object.keys(rankDirections) as TeamPreviewMetricKey[];
  keys.forEach(key => {
    const sorted = teams
      .map(team => ({ id: team.id, value: teamStatsById.get(team.id)?.[key] ?? 0 }))
      .sort((a, b) => {
        if (rankDirections[key] === 'asc') return a.value - b.value;
        return b.value - a.value;
      });
    sorted.forEach((entry, index) => {
      const current = ranksByTeamId.get(entry.id) ?? ({} as Record<TeamPreviewMetricKey, number>);
      current[key] = index + 1;
      ranksByTeamId.set(entry.id, current);
    });
  });

  return { teamStatsById, ranksByTeamId, pregameGameIds };
};

const buildTopStartersForTeam = (
  teamId: number,
  allPlayers: Awaited<ReturnType<typeof getAllPlayers>>
) =>
  allPlayers
    .filter(player => player.active && player.starter && player.teamId === teamId)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
    .map(player => ({
      id: player.id,
      first: player.first,
      last: player.last,
      pos: player.pos.toUpperCase(),
      rating: player.rating,
    }));

const buildKeyPlayersForTeam = (
  teamId: number,
  pregameGameIds: Set<number>,
  allPlayers: Awaited<ReturnType<typeof getAllPlayers>>,
  allLogs: Awaited<ReturnType<typeof getAllGameLogs>>
) => {
  const playersById = new Map(
    allPlayers
      .filter(player => player.teamId === teamId && player.active)
      .map(player => [player.id, player])
  );
  const impactByPlayerId = new Map<number, number>();

  allLogs.forEach(log => {
    if (!pregameGameIds.has(log.gameId)) return;
    if (!playersById.has(log.playerId)) return;

    const impact =
      log.pass_yards * 0.04 +
      log.pass_touchdowns * 6 +
      log.rush_yards * 0.06 +
      log.rush_touchdowns * 6 +
      log.receiving_yards * 0.06 +
      log.receiving_touchdowns * 6 +
      log.tackles * 1 +
      log.sacks * 4 +
      log.interceptions * 5 +
      log.fumbles_forced * 3;

    impactByPlayerId.set(log.playerId, (impactByPlayerId.get(log.playerId) ?? 0) + impact);
  });

  const ranked = Array.from(impactByPlayerId.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([playerId, impact]) => {
      const player = playersById.get(playerId)!;
      return {
        id: player.id,
        first: player.first,
        last: player.last,
        pos: player.pos.toUpperCase(),
        rating: player.rating,
        impact: Math.round(impact * 10) / 10,
      };
    });

  if (ranked.length) return ranked;

  return allPlayers
    .filter(
      player =>
        player.active &&
        player.teamId === teamId &&
        ['qb', 'rb', 'wr', 'te'].includes(player.pos)
    )
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3)
    .map(player => ({
      id: player.id,
      first: player.first,
      last: player.last,
      pos: player.pos.toUpperCase(),
      rating: player.rating,
      impact: 0,
    }));
};

export const loadGame = async (gameId: number) => {
  const league = await loadLeagueOrThrow();

  const record = await getGameById(gameId);
  if (!record) {
    throw new Error('Game not found.');
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const teamA = teamsById.get(record.teamAId);
  const teamB = teamsById.get(record.teamBId);
  if (!teamA || !teamB) {
    throw new Error('Game teams not found.');
  }

  const game = {
    id: record.id,
    label: record.baseLabel,
    base_label: record.baseLabel,
    name: record.name,
    weekPlayed: record.weekPlayed,
    year: record.year,
    teamA,
    teamB,
    homeTeamId: record.homeTeamId,
    awayTeamId: record.awayTeamId,
    neutralSite: record.neutralSite,
    rankATOG: record.rankATOG,
    rankBTOG: record.rankBTOG,
    spreadA: record.spreadA,
    spreadB: record.spreadB,
    moneylineA: record.moneylineA,
    moneylineB: record.moneylineB,
    winProbA: record.winProbA,
    winProbB: record.winProbB,
    winnerId: record.winnerId,
    scoreA: record.scoreA ?? 0,
    scoreB: record.scoreB ?? 0,
    resultA: record.resultA ?? '',
    resultB: record.resultB ?? '',
    overtime: record.overtime ?? 0,
    headline: record.headline ?? null,
    headline_subtitle: record.headline_subtitle ?? null,
    headline_tags: record.headline_tags ?? null,
  };

  const [allGames, allPlays, allPlayers, allLogs] = await Promise.all([
    getAllGames(),
    getAllPlays(),
    getAllPlayers(),
    getAllGameLogs(),
  ]);
  const { teamStatsById, ranksByTeamId, pregameGameIds } = buildTeamStatsAndRanks(
    league.teams,
    allGames,
    allPlays,
    record
  );

  const preview = {
    teamA: {
      stats: teamStatsById.get(teamA.id)!,
      ranks: ranksByTeamId.get(teamA.id)!,
      topStarters: buildTopStartersForTeam(teamA.id, allPlayers),
      keyPlayers: buildKeyPlayersForTeam(teamA.id, pregameGameIds, allPlayers, allLogs),
    },
    teamB: {
      stats: teamStatsById.get(teamB.id)!,
      ranks: ranksByTeamId.get(teamB.id)!,
      topStarters: buildTopStartersForTeam(teamB.id, allPlayers),
      keyPlayers: buildKeyPlayersForTeam(teamB.id, pregameGameIds, allPlayers, allLogs),
    },
  };

  const drives = record.winnerId
    ? buildDriveResponse(
        await getDrivesByGame(gameId),
        await getPlaysByGame(gameId),
        teamsById
      )
    : [];

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    game,
    preview,
    drives,
  };
};

export const listAvailableTeams = async (week: number): Promise<string[]> => {
  const league = await loadLeagueOptional();
  if (!league) return [];

  const userTeam = league.teams.find(team => team.name === league.info.team);
  if (!userTeam) return [];

  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  const games = (await getAllGames()).filter(game => game.year === league.info.currentYear);
  return listTeamsForWeek(schedule, userTeam, league.teams, week, games);
};

export const scheduleNonConGame = async (opponentName: string, week: number): Promise<void> => {
  const league = await loadLeagueOrThrow();

  const userTeam = league.teams.find(team => team.name === league.info.team);
  const opponent = league.teams.find(team => team.name === opponentName);
  if (!userTeam || !opponent) return;

  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  if (schedule[week - 1]?.opponent) return;
  const existingGames = (await getAllGames()).filter(game => game.year === league.info.currentYear);
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
