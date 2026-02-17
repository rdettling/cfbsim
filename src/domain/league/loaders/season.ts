import type { Info, Team } from '../../../types/domain';
import type { LaunchProps, LeagueState, NonConData } from '../../../types/league';
import type { YearData } from '../../../types/baseData';
import type { GameRecord } from '../../../types/db';
import {
  clearBaseDataCache,
  getHistoryData,
  getYearsIndex,
  getRatingsData,
  getYearData,
} from '../../../db/baseData';
import { saveLeague } from '../../../db/leagueRepo';
import {
  clearAllSimData,
  getAllGames,
  getAllPlayers,
  getGameById,
  getDrivesByGame,
  getPlaysByGame,
  saveGames,
  savePlayers,
} from '../../../db/simRepo';
import { buildPreviewData, buildTeamsAndConferences } from '../../baseData';
import {
  applyRivalriesToSchedule,
  buildSchedule,
  buildUserScheduleFromGames,
  fillUserSchedule,
  listAvailableTeams as listTeamsForWeek,
  scheduleNonConGame as scheduleGameForWeek,
} from '../../schedule';
import { buildDriveResponse, initializeSimData } from '../../sim';
import { DEFAULT_SETTINGS } from '../../../types/league';
import { getLastWeekByPlayoffTeams } from '../postseason';
import { normalizeLeague } from '../normalize';
import { loadLeagueOptional, loadLeagueOrThrow } from '../leagueStore';
import { createNonConGameRecord } from '../seasonReset';
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

  const schedule = buildSchedule();
  league.pending_rivalries = await applyRivalriesToSchedule(
    schedule,
    userTeam,
    teams
  );

  const created = await Promise.all(
    schedule
      .filter(slot => slot.opponent)
      .map(slot => {
        const opponent = teams.find(team => team.name === slot.opponent?.name);
        if (!opponent) return null;
        userTeam.nonConfGames += 1;
        opponent.nonConfGames += 1;
        return createNonConGameRecord(
          league,
          userTeam,
          opponent,
          slot.weekPlayed,
          slot.label ?? null,
          { neutralSite: true }
        );
      })
  );
  const gamesToSave = created.filter(Boolean) as GameRecord[];
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
    const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
    const fullGames = fillUserSchedule(schedule, userTeam, league.teams);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, fullGames);
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
  const selectedYear = yearParam ?? league.info.currentYear;

  if (!league.scheduleBuilt && selectedYear === league.info.currentYear) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
    const fullGames = fillUserSchedule(schedule, userTeam, league.teams);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, fullGames);
  }

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

  const games = await getAllGames();
  const teamGames = games.filter(
    game =>
      game.year === selectedYear &&
      (game.teamAId === team.id || game.teamBId === team.id)
  );
  const gamesByWeek = new Map<number, (typeof teamGames)[number]>();
  teamGames.forEach(game => {
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

  const historyData = await getHistoryData().catch(() => null);
  const historyYears = historyData?.years ?? [];
  const years = Array.from(new Set([league.info.currentYear, ...historyYears]))
    .filter(Boolean)
    .sort((a, b) => b - a);

  return {
    info: league.info,
    team,
    schedule,
    teams: league.teams.map(entry => entry.name).sort((a, b) => a.localeCompare(b)),
    conferences: league.conferences,
    years,
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
    drives,
  };
};

export const listAvailableTeams = async (week: number): Promise<string[]> => {
  const league = await loadLeagueOptional();
  if (!league) return [];

  const userTeam = league.teams.find(team => team.name === league.info.team);
  if (!userTeam) return [];

  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  return listTeamsForWeek(schedule, userTeam, league.teams, week);
};

export const scheduleNonConGame = async (opponentName: string, week: number): Promise<void> => {
  const league = await loadLeagueOrThrow();

  const userTeam = league.teams.find(team => team.name === league.info.team);
  const opponent = league.teams.find(team => team.name === opponentName);
  if (!userTeam || !opponent) return;

  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  if (schedule[week - 1]?.opponent) return;
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
