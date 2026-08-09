import type { LeagueState } from '../../types/league';
import type { SimGame, StartersCache } from '../../types/sim';
import type {
  GameDetailRecord,
  GameRecord,
  DriveRecord,
  PlayRecord,
  PlayerRecord,
} from '../../types/db';
import type { GameData, Drive } from '../../types/game';
import type { Team } from '../../types/domain';
import type { NewsItem } from '../../types/news';
import {
  loadLeague,
  requireCurrentRoster,
  saveLeague,
} from '../../db/leagueRepo';
import {
  getGameById,
  getGamesByWeek,
  getAllGames,
  getGameDetail,
  commitSimulationBatch,
} from '../../db/simRepo';
import { loadOddsContext } from '../odds';
import { buildWatchability } from './games';
import {
  simGame,
  buildDriveResponse,
  buildGameData,
  createGameLogsFromPlays,
  buildStartersCache,
  loadPlayersMap,
  hydrateGame,
} from './engine';
import { updateTeamRecords, updateRankings, formatRecord } from './rankings';
import { handleSpecialWeeks } from './postseason';
import { buildGameDetail, flattenGameDetail } from '../league/gameDetails';
import { initializeSeasonSchedule } from '../league/seasonInitialization';
import {
  extractGameStoryFacts,
  generateGameNews,
  generateWeeklyRankingNews,
} from '../news';

const refreshFutureGameSnapshots = (
  games: GameRecord[],
  teamsById: Map<number, Team>,
  teamCount: number,
) => {
  games.forEach(game => {
    if (game.winnerId) return;
    const teamA = teamsById.get(game.teamAId);
    const teamB = teamsById.get(game.teamBId);
    if (!teamA || !teamB) return;
    game.rankATOG = teamA.ranking;
    game.rankBTOG = teamB.ranking;
    game.watchability = buildWatchability(game, teamCount);
  });
};

export const completeRankingsForWeek = (
  league: LeagueState,
  games: GameRecord[],
  teamsById: Map<number, Team>,
) => {
  const week = league.info.currentWeek;
  if (league.info.lastRankingsWeek === week) return { completed: false, story: null };
  const weekGames = games.filter(game =>
    game.year === league.info.currentYear && game.weekPlayed === week);
  if (!weekGames.length || weekGames.some(game => game.winnerId === null)) {
    return { completed: false, story: null };
  }
  const updates = updateRankings(league.info, league.teams, league.settings);
  league.info.lastRankingsWeek = week;
  refreshFutureGameSnapshots(games, teamsById, league.teams.length);
  const story = generateWeeklyRankingNews({
    year: league.info.currentYear,
    week,
    updates,
    teamsById,
  })?.item ?? null;
  return { completed: true, story };
};

export const getGamesToLiveSim = async () => {
  const league = await loadLeague();
  if (!league) throw new Error('No league found. Start a new game.');
  const games = (await getGamesByWeek(league.info.currentWeek)).filter(
    game => game.year === league.info.currentYear
  );
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const unplayed = games.filter(game => game.winnerId === null);
  unplayed.sort((a, b) => (b.watchability ?? 0) - (a.watchability ?? 0));

  const userTeam = league.teams.find(team => team.name === league.info.team);
  const userGames: typeof unplayed = [];
  const otherGames: typeof unplayed = [];
  unplayed.forEach(game => {
    if (userTeam && (game.teamAId === userTeam.id || game.teamBId === userTeam.id)) {
      userGames.push(game);
    } else {
      otherGames.push(game);
    }
  });

  const gamesData = [...userGames, ...otherGames].map(game => {
    const teamA = teamsById.get(game.teamAId)!;
    const teamB = teamsById.get(game.teamBId)!;
    return {
      id: game.id,
      teamAId: teamA.id,
      teamBId: teamB.id,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      neutralSite: game.neutralSite,
      venue: game.venue,
      teamA: { name: teamA.name, ranking: game.rankATOG, record: teamA.record },
      teamB: { name: teamB.name, ranking: game.rankBTOG, record: teamB.record },
      label: game.baseLabel,
      watchability: game.watchability ?? 0,
      is_user_game: userTeam ? (game.teamAId === userTeam.id || game.teamBId === userTeam.id) : false,
    };
  });

  return { games: gamesData, week: league.info.currentWeek };
};

export type PreparedInteractiveLiveGameComplete = {
  status: 'complete';
  drives: Drive[];
  game: GameData;
  is_user_game: boolean;
};

export type PreparedInteractiveLiveGameReady = {
  status: 'ready';
  league: LeagueState;
  record: GameRecord;
  teamsById: Map<number, Team>;
  starters: StartersCache;
  playersById: Map<number, PlayerRecord>;
  simGame: SimGame;
  preRecordA: string;
  preRecordB: string;
  is_user_game: boolean;
};

export type PreparedInteractiveLiveGame = PreparedInteractiveLiveGameComplete | PreparedInteractiveLiveGameReady;

export const prepareInteractiveLiveGame = async (gameId: number): Promise<PreparedInteractiveLiveGame> => {
  const league = await loadLeague();
  if (!league) throw new Error('No league found. Start a new game.');
  await requireCurrentRoster(league);
  const record = await getGameById(gameId);
  if (!record) throw new Error('Game not found.');

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const userTeam = league.teams.find(team => team.name === league.info.team);
  const isUserGame = userTeam ? (record.teamAId === userTeam.id || record.teamBId === userTeam.id) : false;

  if (record.winnerId !== null) {
    const detail = await getGameDetail(gameId);
    if (!detail) throw new Error('Completed game detail is unavailable.');
    const { drives, plays } = flattenGameDetail(detail);
    return {
      status: 'complete',
      drives: buildDriveResponse(drives, plays, teamsById),
      game: buildGameData(record, teamsById),
      is_user_game: isUserGame,
    };
  }

  const preRecordA = teamsById.get(record.teamAId)?.record ?? '';
  const preRecordB = teamsById.get(record.teamBId)?.record ?? '';

  const starters = await buildStartersCache(league.teams);
  const playersById = await loadPlayersMap(league.teams);
  const simGameObj = hydrateGame(record, teamsById);

  return {
    status: 'ready',
    league,
    record,
    teamsById,
    starters,
    playersById,
    simGame: simGameObj,
    preRecordA,
    preRecordB,
    is_user_game: isUserGame,
  };
};

export const finalizeGameSimulation = async (params: {
  league: LeagueState;
  record: GameRecord;
  simGame: SimGame;
  driveRecords: DriveRecord[];
  playRecords: PlayRecord[];
  starters: StartersCache;
  playersById: Map<number, PlayerRecord>;
  preRecordA: string;
  preRecordB: string;
}) => {
  const {
    league,
    record,
    simGame,
    driveRecords,
    playRecords,
    starters,
    playersById,
    preRecordA,
    preRecordB,
  } = params;

  const logs = createGameLogsFromPlays(league, simGame, playRecords, starters);

  updateTeamRecords([simGame], league.teams, await loadOddsContext(), league.info);

  const updatedRecord: GameRecord = {
    ...record,
    scoreA: simGame.scoreA,
    scoreB: simGame.scoreB,
    winnerId: simGame.winner?.id ?? null,
    resultA: simGame.resultA,
    resultB: simGame.resultB,
    overtime: simGame.overtime,
    quarter: simGame.quarter,
    clockSecondsLeft: simGame.clockSecondsLeft,
  };
  const detail = buildGameDetail(record.id, record.year, driveRecords, playRecords, logs);
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const allGames = await getAllGames();
  const games = allGames.map(game => game.id === updatedRecord.id ? updatedRecord : game);
  const story = generateGameNews(extractGameStoryFacts({
    game: updatedRecord,
    detail,
    teamsById,
    playersById,
    games,
  })).item;
  const rankings = completeRankingsForWeek(league, games, teamsById);

  await commitSimulationBatch({
    league,
    games: rankings.completed ? games : [updatedRecord],
    details: [detail],
    newsItems: rankings.story ? [story, rankings.story] : [story],
  });
  await handleSpecialWeeks(league, await loadOddsContext());

  league.teams.forEach(team => (team.record = formatRecord(team)));
  await saveLeague(league);

  const gameData = buildGameData(updatedRecord, teamsById, story);
  gameData.teamA.record = preRecordA;
  gameData.teamB.record = preRecordB;

  return {
    drives: buildDriveResponse(driveRecords, playRecords, teamsById),
    game: gameData,
  };
};

export const advanceWeeks = async (destWeek: number) => {
  const league = await loadLeague();
  if (!league) throw new Error('No league found. Start a new game.');
  await requireCurrentRoster(league);
  if (!league.scheduleBuilt || !league.simInitialized) {
    const existingGames = (await getAllGames()).filter(
      game => game.year === league.info.currentYear
    );
    await initializeSeasonSchedule(league, existingGames);
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const starters = await buildStartersCache(league.teams);
  const playersById = await loadPlayersMap(league.teams);

  const detailsToSave: GameDetailRecord[] = [];
  const oddsContext = await loadOddsContext();

  while (league.info.currentWeek < destWeek) {
    const weekGames = (await getGamesByWeek(league.info.currentWeek)).filter(
      game => game.year === league.info.currentYear
    );
    const gamesByTeam = new Map<number, GameRecord[]>();
    weekGames.forEach(game => {
      const listA = gamesByTeam.get(game.teamAId) ?? [];
      listA.push(game);
      gamesByTeam.set(game.teamAId, listA);
      const listB = gamesByTeam.get(game.teamBId) ?? [];
      listB.push(game);
      gamesByTeam.set(game.teamBId, listB);
    });
    gamesByTeam.forEach((games, teamId) => {
      if (games.length > 1) {
        console.warn(
          `[sim debug] team ${teamId} has ${games.length} games in week ${league.info.currentWeek}:`,
          games.map(game => ({ id: game.id, week: game.weekPlayed, teamAId: game.teamAId, teamBId: game.teamBId, name: game.name }))
        );
      }
    });
    const unplayed = weekGames.filter(game => !game.winnerId);
    const simGames: SimGame[] = [];

    unplayed.forEach(gameRecord => {
      const simGameObj = hydrateGame(gameRecord, teamsById);
      const simDrives = simGame(league, simGameObj, starters);
      simGames.push(simGameObj);

      const driveRecords = simDrives.map(drive => drive.record);
      const playRecords = simDrives.flatMap(drive => drive.plays);
      const logs = createGameLogsFromPlays(league, simGameObj, playRecords, starters);

      detailsToSave.push(
        buildGameDetail(
          gameRecord.id,
          gameRecord.year,
          driveRecords,
          playRecords,
          logs,
        ),
      );
      gameRecord.scoreA = simGameObj.scoreA;
      gameRecord.scoreB = simGameObj.scoreB;
      gameRecord.winnerId = simGameObj.winner?.id ?? null;
      gameRecord.resultA = simGameObj.resultA;
      gameRecord.resultB = simGameObj.resultB;
      gameRecord.overtime = simGameObj.overtime;
      gameRecord.quarter = simGameObj.quarter;
      gameRecord.clockSecondsLeft = simGameObj.clockSecondsLeft;
    });

    if (simGames.length) {
      updateTeamRecords(simGames, league.teams, oddsContext, league.info);
    }

    const futureGames = await getAllGames();
    const updatedById = new Map(unplayed.map(game => [game.id, game]));
    futureGames.forEach(game => {
      const updated = updatedById.get(game.id);
      if (updated) Object.assign(game, updated);
    });
    const rankings = completeRankingsForWeek(league, futureGames, teamsById);

    if (simGames.length || rankings.completed) {
      const weekGameIds = new Set(unplayed.map(game => game.id));
      const weekDetails = detailsToSave.filter(detail =>
        weekGameIds.has(detail.gameId),
      );
      const detailsByGameId = new Map(weekDetails.map(detail => [detail.gameId, detail]));
      const newsItems: NewsItem[] = unplayed.map(game => {
        const detail = detailsByGameId.get(game.id);
        if (!detail) throw new Error(`Completed game ${game.id} has no detail record.`);
        return generateGameNews(extractGameStoryFacts({
          game,
          detail,
          teamsById,
          playersById,
          games: futureGames,
        })).item;
      });
      if (rankings.story) newsItems.push(rankings.story);
      await commitSimulationBatch({
        league,
        games: futureGames,
        details: weekDetails,
        newsItems,
      });
    }
    if (weekGames.length && weekGames.every(game =>
      (updatedById.get(game.id) ?? game).winnerId !== null)) {
      await handleSpecialWeeks(league, oddsContext);
    }

    league.info.currentWeek += 1;
  }

  await saveLeague(league);
};

export { buildDriveResponse };
