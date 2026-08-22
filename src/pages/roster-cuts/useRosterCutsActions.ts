import { useRef, useState } from 'react';
import {
  selectRosterCut,
  undoRosterCut,
} from '../../domain/league/commands/rosterFinalization';
import type { RosterCutsPageData } from '../../types/pages';
import { RosterFinalizationConflictError } from '../../types/roster';

export const useRosterCutsActions = (
  data: RosterCutsPageData | null,
  refetch: () => Promise<void>,
) => {
  const [busyPlayerId, setBusyPlayerId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);
  const actionLock = useRef(false);

  const guard = data?.cursor
    ? {
        expectedStage: 'roster_cuts' as const,
        expectedYear: data.cursor.year,
        expectedRound: 6 as const,
        expectedStatus: 'finalized' as const,
        expectedVersion: data.cursor.version,
      }
    : null;

  const mutateCut = async (playerId: number, operation: 'select' | 'undo') => {
    if (!guard || actionLock.current) return;
    actionLock.current = true;
    setBusyPlayerId(playerId);
    try {
      if (operation === 'select') {
        await selectRosterCut(guard, playerId);
      } else {
        await undoRosterCut(guard, playerId);
      }
      setNotice({
        severity: 'success',
        message:
          operation === 'select'
            ? 'Roster cut selected.'
            : 'Roster cut selection removed.',
      });
      await refetch();
    } catch (commandError) {
      const stale = commandError instanceof RosterFinalizationConflictError;
      setNotice({
        severity: 'error',
        message: stale
          ? 'Roster cuts changed in another view. Authoritative selections were reloaded.'
          : commandError instanceof Error
            ? commandError.message
            : 'The roster-cut action failed.',
      });
      if (stale) await refetch();
    } finally {
      actionLock.current = false;
      setBusyPlayerId(null);
    }
  };

  return {
    busyPlayerId,
    notice,
    setNotice,
    mutateCut,
  };
};
