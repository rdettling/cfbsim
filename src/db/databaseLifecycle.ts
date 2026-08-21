import {
  LeagueDataIntegrityError,
  type LeagueState,
} from '../types/league';
import { RecruitingDataIntegrityError } from '../types/recruiting';
import {
  assertCurrentLeagueState,
  assertCurrentRosterState,
} from './leagueStateValidation';
import { assertCurrentRecruitingState } from './recruitingRepo';
import { deleteCurrentDatabase, getDb } from './db';
import { assertSeasonMemoryReferences } from './seasonMemoryRepo';
import { assertHistoricalIntegrity } from './historyRepo';
import { selectRetainedGameIds } from '../domain/league/gameDetails';
import { assertPlayerOriginIntegrity } from './playerOriginRepo';
import { assertNewsIntegrity } from './newsIntegrity';
import { assertLeagueGameRecords } from './gameRecordValidation';
import { assertGameDetailReferences } from './gameDetailValidation';

const RECRUITING_STAGES = new Set<LeagueState['info']['stage']>([
  'recruiting',
  'recruiting_summary',
  'roster_cuts',
]);

const FINALIZED_CURRENT_YEAR_STAGES = new Set<LeagueState['info']['stage']>([
  'summary',
  'realignment',
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
      'newsItems',
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
    newsItems,
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
    tx.objectStore('newsItems').getAll(),
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
      newsItems.length > 0 ||
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
  assertLeagueGameRecords(league, games);
  assertCurrentRosterState(league, players);
  assertHistoricalIntegrity({
    currentPlayers: players,
    historicalPlayers,
    playerSeasons,
  });
  assertGameDetailReferences({
    details,
    games,
    currentPlayers: players,
    historicalPlayers,
    playerSeasons,
  });
  assertPlayerOriginIntegrity({
    league,
    currentPlayers: players,
    historicalPlayers,
    origins: playerOrigins,
  });
  assertNewsIntegrity(
    newsItems,
    games,
    new Set([...players, ...historicalPlayers].map(player => player.id)),
    new Set(league.teams.map(team => team.id)),
  );
  assertSeasonMemoryReferences(
    memories,
    league,
    games,
    players,
    historicalPlayers,
    playerSeasons,
  );
  const currentYearFinalized = FINALIZED_CURRENT_YEAR_STAGES.has(
    league.info.stage,
  );
  const hasCurrentMemory = memories.some(
    memory => memory.year === league.info.currentYear,
  );
  const hasCurrentPlayerSeasons = playerSeasons.some(
    season => season.year === league.info.currentYear,
  );
  if (
    hasCurrentMemory !== currentYearFinalized ||
    hasCurrentPlayerSeasons !== currentYearFinalized
  ) {
    throw new LeagueDataIntegrityError(
      'INVALID_LEAGUE_STATE',
      `Season ${league.info.currentYear} finalization does not match the ${league.info.stage} stage.`,
    );
  }
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
    if (
      game.year === league.info.currentYear &&
      league.info.stage === 'summary'
    ) {
      if (!detailsByGameId.has(game.id)) {
        throw new LeagueDataIntegrityError(
          'INVALID_LEAGUE_STATE',
          `Completed summary game ${game.id} has no detail record.`,
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
