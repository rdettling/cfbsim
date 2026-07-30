import {
  LeagueDataIntegrityError,
  type LeagueState,
} from '../types/league';
import { RecruitingDataIntegrityError } from '../types/recruiting';
import {
  assertCurrentLeagueState,
  assertCurrentRosterState,
} from './leagueRepo';
import { assertCurrentRecruitingState } from './recruitingRepo';
import { deleteCurrentDatabase, getDb } from './db';
import { assertSeasonMemoryReferences } from './seasonMemoryRepo';
import { assertHistoricalIntegrity } from './historyRepo';
import { selectRetainedGameIds } from '../domain/league/gameDetails';
import { assertPlayerOriginIntegrity } from './playerOriginRepo';

const RECRUITING_STAGES = new Set<LeagueState['info']['stage']>([
  'recruiting',
  'recruiting_summary',
  'roster_cuts',
]);

const assertCurrentDatabase = async () => {
  const db = await getDb();
  const tx = db.transaction(
    [
      'league',
      'recruiting',
      'players',
      'games',
      'gameDetails',
      'seasonMemories',
      'playerSeasons',
      'historicalPlayers',
      'playerOrigins',
    ],
    'readonly',
  );
  const [
    leagueRecord,
    recruitingRecord,
    players,
    games,
    details,
    memories,
    playerSeasons,
    historicalPlayers,
    playerOrigins,
  ] = await Promise.all([
    tx.objectStore('league').get('current'),
    tx.objectStore('recruiting').get('current'),
    tx.objectStore('players').getAll(),
    tx.objectStore('games').getAll(),
    tx.objectStore('gameDetails').getAll(),
    tx.objectStore('seasonMemories').getAll(),
    tx.objectStore('playerSeasons').getAll(),
    tx.objectStore('historicalPlayers').getAll(),
    tx.objectStore('playerOrigins').getAll(),
  ]);
  await tx.done;

  if (!leagueRecord) {
    const hasOrphanedSaveData =
      Boolean(recruitingRecord) ||
      players.length > 0 ||
      games.length > 0 ||
      details.length > 0 ||
      playerSeasons.length > 0 ||
      historicalPlayers.length > 0 ||
      playerOrigins.length > 0;
    const hasOrphanedMemory = memories.length > 0;
    if (hasOrphanedSaveData || hasOrphanedMemory) {
      throw new LeagueDataIntegrityError(
        'INVALID_LEAGUE_STATE',
        'Saved data exists without a current league.',
      );
    }
    return;
  }

  assertCurrentLeagueState(leagueRecord.value);
  const league = leagueRecord.value;
  assertCurrentRosterState(league, players);
  assertHistoricalIntegrity({
    currentPlayers: players,
    historicalPlayers,
    playerSeasons,
    details,
    gameIds: new Set(games.map(game => game.id)),
  });
  assertPlayerOriginIntegrity({
    league,
    currentPlayers: players,
    historicalPlayers,
    origins: playerOrigins,
  });
  assertSeasonMemoryReferences(
    memories,
    league,
    games,
    players,
    historicalPlayers,
    playerSeasons,
  );
  const detailsByGameId = new Map(details.map(detail => [detail.gameId, detail]));
  const userTeam = leagueRecord.value.teams.find(
    team => team.name === league.info.team,
  )!;
  const memoriesByYear = new Map(memories.map(memory => [memory.year, memory]));
  for (const game of games) {
    if (game.winnerId === null) continue;
    const memory = memoriesByYear.get(game.year);
    if (!memory) {
      if (
        game.year === league.info.currentYear &&
        !detailsByGameId.has(game.id)
      ) {
        throw new LeagueDataIntegrityError(
          'INVALID_LEAGUE_STATE',
          `Completed current-season game ${game.id} has no detail record.`,
        );
      }
      continue;
    }
    const yearGames = games.filter(candidate => candidate.year === game.year);
    const retained = selectRetainedGameIds(userTeam.id, yearGames, memory);
    if (retained.has(game.id) !== detailsByGameId.has(game.id)) {
      throw new LeagueDataIntegrityError(
        'INVALID_LEAGUE_STATE',
        `Historical game ${game.id} violates the detail-retention policy.`,
      );
    }
  }

  const requiresRecruiting = RECRUITING_STAGES.has(
    league.info.stage,
  );
  if (requiresRecruiting !== Boolean(recruitingRecord)) {
    throw new RecruitingDataIntegrityError();
  }
  if (recruitingRecord) {
    assertCurrentRecruitingState(recruitingRecord.value);
  }
};

export const initializeDatabase = async () => {
  try {
    await assertCurrentDatabase();
  } catch {
    await deleteCurrentDatabase();
    await getDb();
  }
};
