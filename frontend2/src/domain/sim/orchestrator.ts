import type { FullGame } from '../../types/schedule';
import type { LeagueState } from '../../types/league';
import type { SimGame } from '../../types/sim';
import type { GameRecord, DriveRecord, PlayRecord, GameLogRecord } from '../../types/db';
import { fillUserSchedule, buildUserScheduleFromGames } from '../schedule';
import { loadLeague, saveLeague } from '../../db/leagueRepo';
import {
  getGameById,
  getGamesByWeek,
  getAllGames,
  getDrivesByGame,
  getPlaysByGame,
  saveDrives,
  saveGameLogs,
  saveGames,
  savePlays,
  clearNonGameArtifacts,
} from '../../db/simRepo';
import { ensureRosters } from '../roster';
import { buildOddsFields, loadOddsContext } from '../odds';
import { normalizeLeague } from '../league/normalize';
import { buildBaseLabel } from '../utils/gameLabels';
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
import { normalizeCounters } from './ids';

export const initializeSimData = async (league: LeagueState, fullGames: FullGame[]) => {
  const counters = normalizeCounters(league);
  await ensureRosters(league);
  await clearNonGameArtifacts();
  const oddsContext = await loadOddsContext();

  const gameRecords: GameRecord[] = [];
  fullGames.forEach(game => {
    const homeTeam = game.homeTeam;
    const awayTeam = game.awayTeam;
    const oddsFields = buildOddsFields(game.teamA, game.teamB, homeTeam ?? null, false, oddsContext);
    const record: GameRecord = {
      id: counters.game,
      teamAId: game.teamA.id,
      teamBId: game.teamB.id,
      homeTeamId: homeTeam?.id ?? null,
      awayTeamId: awayTeam?.id ?? null,
      neutralSite: false,
      winnerId: null,
      baseLabel: buildBaseLabel(game.teamA, game.teamB, game.name),
      name: game.name ?? null,
      ...oddsFields,
      weekPlayed: game.weekPlayed,
      year: league.info.currentYear,
      rankATOG: game.teamA.ranking,
      rankBTOG: game.teamB.ranking,
      resultA: null,
      resultB: null,
      overtime: 0,
      scoreA: null,
      scoreB: null,
      headline: null,
      watchability: null,
    };
    record.watchability = buildWatchability(record, league.teams.length);
    gameRecords.push(record);
    counters.game += 1;
  });

  await saveGames(gameRecords);

  league.simInitialized = true;
  await saveLeague(league);
};

export const getGamesToLiveSim = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) throw new Error('No league found. Start a new game.');
  const changed = normalizeLeague(league);
  if (changed) {
    await saveLeague(league);
  }
  const games = (await getGamesByWeek(league.info.currentWeek)).filter(
    game => game.year === league.info.currentYear
  );
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const unplayed = games.filter(game => !game.winnerId);
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
      teamA: { name: teamA.name, ranking: game.rankATOG, record: teamA.record },
      teamB: { name: teamB.name, ranking: game.rankBTOG, record: teamB.record },
      label: game.baseLabel,
      watchability: game.watchability ?? 0,
      is_user_game: userTeam ? (game.teamAId === userTeam.id || game.teamBId === userTeam.id) : false,
    };
  });

  return { games: gamesData, week: league.info.currentWeek };
};

export const liveSimGame = async (gameId: number) => {
  const league = await loadLeague<LeagueState>();
  if (!league) throw new Error('No league found. Start a new game.');
  const changed = normalizeLeague(league);
  if (changed) {
    await saveLeague(league);
  }
  const record = await getGameById(gameId);
  if (!record) throw new Error('Game not found.');

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const userTeam = league.teams.find(team => team.name === league.info.team);

  if (record.winnerId) {
    const drives = await getDrivesByGame(gameId);
    const plays = await getPlaysByGame(gameId);
    return {
      drives: buildDriveResponse(drives, plays, teamsById),
      game: buildGameData(record, teamsById),
      is_user_game: userTeam ? (record.teamAId === userTeam.id || record.teamBId === userTeam.id) : false,
    };
  }

  const preRecordA = teamsById.get(record.teamAId)?.record ?? '';
  const preRecordB = teamsById.get(record.teamBId)?.record ?? '';

  const starters = await buildStartersCache(league.teams);
  const playersById = await loadPlayersMap(league.teams);
  const simGameObj = hydrateGame(record, teamsById);
  const simDrives = simGame(league, simGameObj, starters);
  const driveRecords = simDrives.map(drive => drive.record);
  const playRecords = simDrives.flatMap(drive => drive.plays);
  const logs = createGameLogsFromPlays(league, simGameObj, playRecords, starters);

  updateTeamRecords([simGameObj]);
  await generateHeadlines([simGameObj], new Map([[simGameObj.id, logs]]), playersById);

  const updatedRecord: GameRecord = {
    ...record,
    scoreA: simGameObj.scoreA,
    scoreB: simGameObj.scoreB,
    winnerId: simGameObj.winner?.id ?? null,
    resultA: simGameObj.resultA,
    resultB: simGameObj.resultB,
    overtime: simGameObj.overtime,
    headline: simGameObj.headline ?? null,
    headline_subtitle: simGameObj.headline_subtitle ?? null,
    headline_tags: simGameObj.headline_tags ?? null,
    headline_tone: simGameObj.headline_tone ?? null,
  };
  await saveGames([updatedRecord]);
  await saveDrives(driveRecords);
  await savePlays(playRecords);
  await saveGameLogs(logs);
  await handleSpecialWeeks(league, await loadOddsContext());

  league.teams.forEach(team => (team.record = formatRecord(team)));
  await saveLeague(league);

  const gameData = buildGameData(updatedRecord, teamsById);
  gameData.teamA.record = preRecordA;
  gameData.teamB.record = preRecordB;

  return {
    drives: buildDriveResponse(driveRecords, playRecords, teamsById),
    game: gameData,
    is_user_game: userTeam ? (record.teamAId === userTeam.id || record.teamBId === userTeam.id) : false,
  };
};

export const advanceWeeks = async (destWeek: number) => {
  const league = await loadLeague<LeagueState>();
  if (!league) throw new Error('No league found. Start a new game.');
  const changed = normalizeLeague(league);
  if (changed) {
    await saveLeague(league);
  }
  if (!league.scheduleBuilt || !league.simInitialized) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const existingGames = (await getAllGames()).filter(
      game => game.year === league.info.currentYear
    );
    const schedule = buildUserScheduleFromGames(userTeam, league.teams, existingGames);
    const fullGames = fillUserSchedule(schedule, userTeam, league.teams);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, fullGames);
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const starters = await buildStartersCache(league.teams);
  const playersById = await loadPlayersMap(league.teams);

  const drivesToSave: DriveRecord[] = [];
  const playsToSave: PlayRecord[] = [];
  const logsToSave: GameLogRecord[] = [];
  const oddsContext = await loadOddsContext();

  while (league.info.currentWeek < destWeek) {
    const weekGames = (await getGamesByWeek(league.info.currentWeek)).filter(
      game => game.year === league.info.currentYear
    );
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

      drivesToSave.push(...driveRecords);
      playsToSave.push(...playRecords);
      logsToSave.push(...logs);
      gameLogsByGame.set(simGameObj.id, logs);

      gameRecord.scoreA = simGameObj.scoreA;
      gameRecord.scoreB = simGameObj.scoreB;
      gameRecord.winnerId = simGameObj.winner?.id ?? null;
      gameRecord.resultA = simGameObj.resultA;
      gameRecord.resultB = simGameObj.resultB;
      gameRecord.overtime = simGameObj.overtime;
    });

    if (simGames.length) {
      updateTeamRecords(simGames);
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
      updateRankings(league.info, league.teams, simGames, league.settings);

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
      });

      await saveGames(futureGames);
      await handleSpecialWeeks(league, oddsContext);
    }

    league.info.currentWeek += 1;
  }

  await saveDrives(drivesToSave);
  await savePlays(playsToSave);
  await saveGameLogs(logsToSave);
  await saveLeague(league);
};

export { buildDriveResponse };
