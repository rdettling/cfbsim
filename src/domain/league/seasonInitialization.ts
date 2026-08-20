import { getRivalriesData } from '../../db/baseData';
import { requireCurrentRoster } from '../../db/leagueRepo';
import { commitSeasonInitialization } from '../../db/simRepo';
import type { GameRecord } from '../../types/db';
import type { LeagueState } from '../../types/league';
import type { FullGame } from '../../types/scheduleTypes';
import { buildOddsFields, loadOddsContext } from '../odds';
import {
  buildAcceptedRivalryGames,
  resolveRivalries,
  withoutDeclinedRivalries,
} from '../rivalryScheduling';
import { buildFullScheduleFromExisting } from '../schedule/planner';
import { SECONDS_PER_QUARTER } from '../sim/clock';
import { buildWatchability } from '../sim/games';
import { buildBaseLabel } from '../utils/gameLabels';
import { generateRandomSeed } from '../utils/randomSeed';
import { getSeasonMemory } from '../../db/seasonMemoryRepo';
import { getGameById } from '../../db/simRepo';
import { generatePreseasonNews } from '../news/previews';

const getDefendingChampionId = async (year: number) => {
  const memory = await getSeasonMemory(year - 1);
  const championshipGameId = memory?.postseason.playoff.games.championship;
  if (!championshipGameId) return null;
  const game = await getGameById(championshipGameId);
  return game?.winnerId ?? null;
};

const initializeSimulation = async (
  league: LeagueState,
  fullGames: FullGame[],
) => {
  await requireCurrentRoster(league);
  const oddsContext = await loadOddsContext();
  const gameRecords: GameRecord[] = fullGames.map(game => {
    const neutralSite = game.homeTeam === null && game.awayTeam === null;
    const record: GameRecord = {
      id: league.idCounters.game++,
      teamAId: game.teamA.id,
      teamBId: game.teamB.id,
      homeTeamId: game.homeTeam?.id ?? null,
      awayTeamId: game.awayTeam?.id ?? null,
      neutralSite,
      venue: game.venue,
      winnerId: null,
      baseLabel: buildBaseLabel(game.teamA, game.teamB, game.name),
      name: game.name ?? null,
      gameType: 'regular_season',
      rivalryKey: game.rivalryKey,
      ...buildOddsFields(
        game.teamA,
        game.teamB,
        game.homeTeam,
        neutralSite,
        oddsContext,
      ),
      weekPlayed: game.weekPlayed,
      year: league.info.currentYear,
      rankATOG: game.teamA.ranking,
      rankBTOG: game.teamB.ranking,
      resultA: null,
      resultB: null,
      overtime: 0,
      quarter: 1,
      clockSecondsLeft: SECONDS_PER_QUARTER,
      scoreA: null,
      scoreB: null,
      watchability: 0,
    };
    record.watchability = buildWatchability(record, league.teams.length);
    return record;
  });

  const previews = gameRecords.length
    ? generatePreseasonNews({
        year: league.info.currentYear,
        teams: league.teams,
        games: gameRecords,
        defendingChampionId: await getDefendingChampionId(league.info.currentYear),
      }).map(generated => generated.item)
    : [];
  league.simInitialized = true;
  await commitSeasonInitialization({
    year: league.info.currentYear,
    league,
    games: gameRecords,
    newsItems: previews,
  });
};

export const initializeSeasonSchedule = async (
  league: LeagueState,
  existingGames: GameRecord[],
) => {
  const userTeam =
    league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const rivalryResolution = resolveRivalries({
    teams: league.teams,
    rivalries: withoutDeclinedRivalries(
      await getRivalriesData(),
      league.declinedRivalries,
    ),
    existingGames,
    year: league.info.currentYear,
  });
  const { newGames } = buildFullScheduleFromExisting(
    userTeam,
    league.teams,
    existingGames,
    {
      year: league.info.currentYear,
      seed: generateRandomSeed(),
      requireComplete: league.settings.conferencePolicy === 'current',
      requiredGames: buildAcceptedRivalryGames(
        rivalryResolution,
        league.teams,
        league,
      ),
    },
  );

  league.info.stage = 'season';
  league.scheduleBuilt = true;
  await initializeSimulation(league, newGames);
};
