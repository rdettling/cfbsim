import type { LeagueState } from '../../types/league';
import type { SimGame, StartersCache } from '../../types/sim';
import type {
  GameDetailRecord,
  GameRecord,
  DriveRecord,
  PlayRecord,
  GameLogRecord,
  PlayerRecord,
} from '../../types/db';
import type { GameData, Drive } from '../../types/game';
import type { Team } from '../../types/domain';
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
  generateHeadlines,
  buildStartersCache,
  loadPlayersMap,
  hydrateGame,
} from './engine';
import { updateTeamRecords, updateRankings, formatRecord } from './rankings';
import { handleSpecialWeeks } from './postseason';
import { buildGameDetail, flattenGameDetail } from '../league/gameDetails';
import { initializeSeasonSchedule } from '../league/seasonInitialization';

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
  await generateHeadlines([simGame], new Map([[simGame.id, logs]]), playersById);

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
    headline: simGame.headline ?? null,
    headline_subtitle: simGame.headline_subtitle ?? null,
    headline_tags: simGame.headline_tags ?? null,
    headline_tone: simGame.headline_tone ?? null,
  };

  await commitSimulationBatch({
    league,
    games: [updatedRecord],
    details: [
      buildGameDetail(record.id, record.year, driveRecords, playRecords, logs),
    ],
  });
  await handleSpecialWeeks(league, await loadOddsContext());

  league.teams.forEach(team => (team.record = formatRecord(team)));
  await saveLeague(league);

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const gameData = buildGameData(updatedRecord, teamsById);
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
    const gameLogsByGame = new Map<number, GameLogRecord[]>();

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
      gameLogsByGame.set(simGameObj.id, logs);

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
      await generateHeadlines(simGames, gameLogsByGame, playersById);
      simGames.forEach(simGameObj => {
        const gameRecord = unplayed.find(game => game.id === simGameObj.id);
        if (gameRecord) {
          gameRecord.headline = simGameObj.headline ?? null;
          gameRecord.headline_subtitle = simGameObj.headline_subtitle ?? null;
          gameRecord.headline_tags = simGameObj.headline_tags ?? null;
          gameRecord.headline_tone = simGameObj.headline_tone ?? null;
        }
      });
      updateRankings(league.info, league.teams, league.settings);

      const futureGames = await getAllGames();
      const updatedById = new Map(unplayed.map(game => [game.id, game]));
      futureGames.forEach(game => {
        const updated = updatedById.get(game.id);
        if (updated) {
          Object.assign(game, updated);
        }
        if (game.winnerId) return;
        const teamA = teamsById.get(game.teamAId);
        const teamB = teamsById.get(game.teamBId);
        if (!teamA || !teamB) return;
        game.rankATOG = teamA.ranking;
        game.rankBTOG = teamB.ranking;
        game.watchability = buildWatchability(game, league.teams.length);
      });

      const weekGameIds = new Set(unplayed.map(game => game.id));
      const weekDetails = detailsToSave.filter(detail =>
        weekGameIds.has(detail.gameId),
      );
      await commitSimulationBatch({
        league,
        games: futureGames,
        details: weekDetails,
      });
      await handleSpecialWeeks(league, oddsContext);
    }

    league.info.currentWeek += 1;
  }

  await saveLeague(league);
};

export { buildDriveResponse };
