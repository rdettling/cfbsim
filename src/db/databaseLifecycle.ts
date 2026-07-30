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

const RECRUITING_STAGES = new Set<LeagueState['info']['stage']>([
  'recruiting',
  'recruiting_summary',
  'roster_cuts',
]);

const assertCurrentDatabase = async () => {
  const db = await getDb();
  const tx = db.transaction(
    ['league', 'recruiting', 'players', 'games', 'drives', 'plays', 'gameLogs'],
    'readonly',
  );
  const [
    leagueRecord,
    recruitingRecord,
    players,
    gameCount,
    driveCount,
    playCount,
    gameLogCount,
  ] = await Promise.all([
    tx.objectStore('league').get('current'),
    tx.objectStore('recruiting').get('current'),
    tx.objectStore('players').getAll(),
    tx.objectStore('games').count(),
    tx.objectStore('drives').count(),
    tx.objectStore('plays').count(),
    tx.objectStore('gameLogs').count(),
  ]);
  await tx.done;

  if (!leagueRecord) {
    const hasOrphanedSaveData =
      Boolean(recruitingRecord) ||
      players.length > 0 ||
      gameCount > 0 ||
      driveCount > 0 ||
      playCount > 0 ||
      gameLogCount > 0;
    if (hasOrphanedSaveData) {
      throw new LeagueDataIntegrityError(
        'INVALID_LEAGUE_STATE',
        'Saved data exists without a current league.',
      );
    }
    return;
  }

  assertCurrentLeagueState(leagueRecord.value);
  assertCurrentRosterState(leagueRecord.value, players);

  const requiresRecruiting = RECRUITING_STAGES.has(
    leagueRecord.value.info.stage,
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
