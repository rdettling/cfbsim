import { Alert, Snackbar } from '@mui/material';
import { useCallback, useRef, useState } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { listAvailableOpponents } from '../domain/league/loaders/season/listAvailableOpponents';
import { loadNonCon } from '../domain/league/loaders/season/loadNonCon';
import {
  dismissPendingRivalry,
  removePreseasonGame,
} from '../domain/league/commands/preseasonScheduleRemoval';
import { scheduleNonConGame } from '../domain/league/commands/scheduleNonConGame';
import type { EligibleNonConOpponent } from '../types/league';
import type { NonConPageData } from '../types/pages';
import { NonConWorkspace } from './noncon/NonConWorkspace';
import { ScheduleOpponentDialog } from './noncon/ScheduleOpponentDialog';
import type {
  NonConSection,
  OpponentScheduleRequest,
} from './noncon/types';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const NonCon = () => {
  const opponentRequestId = useRef(0);

  const [activeSection, setActiveSection] = useState<NonConSection>('schedule');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [availableOpponents, setAvailableOpponents] = useState<EligibleNonConOpponent[]>([]);
  const [opponentQuery, setOpponentQuery] = useState('');
  const [opponentsLoading, setOpponentsLoading] = useState(false);
  const [opponentsError, setOpponentsError] = useState<string | null>(null);
  const [savingRequest, setSavingRequest] =
    useState<OpponentScheduleRequest | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [removingItemKey, setRemovingItemKey] = useState<string | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);

  const fetchData = useCallback(async (): Promise<NonConPageData> => loadNonCon(), []);
  const { data, loading, error, refresh } = useDomainData<NonConPageData>({
    fetcher: fetchData,
  });

  const clearOpponentSelection = () => {
    setSelectedWeek(null);
    setAvailableOpponents([]);
    setOpponentQuery('');
    setOpponentsLoading(false);
    setOpponentsError(null);
    setScheduleError(null);
  };

  const loadOpponents = async (week: number) => {
    const requestId = opponentRequestId.current + 1;
    opponentRequestId.current = requestId;
    setAvailableOpponents([]);
    setOpponentsError(null);
    setScheduleError(null);
    setOpponentsLoading(true);

    try {
      const opponents = await listAvailableOpponents(week);
      if (opponentRequestId.current === requestId) {
        setAvailableOpponents(opponents);
      }
    } catch (loadError) {
      if (opponentRequestId.current === requestId) {
        setOpponentsError(errorMessage(
          loadError,
          'Eligible opponents could not be loaded. Try again.',
        ));
      }
    } finally {
      if (opponentRequestId.current === requestId) {
        setOpponentsLoading(false);
      }
    }
  };

  const selectScheduleWeek = (week: number) => {
    setSelectedWeek(week);
    setOpponentQuery('');
    setScheduleDialogOpen(true);
    void loadOpponents(week);
  };

  const retryOpponents = () => {
    if (selectedWeek !== null) void loadOpponents(selectedWeek);
  };

  const closeScheduleDialog = () => {
    if (savingRequest) return;
    opponentRequestId.current += 1;
    setScheduleDialogOpen(false);
    clearOpponentSelection();
  };

  const submitScheduledGame = async (request: OpponentScheduleRequest) => {
    if (selectedWeek === null || savingRequest) return;

    setSavingRequest(request);
    setScheduleError(null);
    try {
      await scheduleNonConGame({
        ...request,
        week: selectedWeek,
      });
      await refresh();
      setScheduleDialogOpen(false);
      clearOpponentSelection();
    } catch (saveError) {
      setScheduleError(errorMessage(
        saveError,
        'The game could not be scheduled. Refresh the candidates and try again.',
      ));
    } finally {
      setSavingRequest(null);
    }
  };

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setTeamDialogOpen(true);
  };

  const removeScheduledGame = async (gameId: string) => {
    if (removingItemKey) return;
    const itemKey = `game:${gameId}`;
    setRemovingItemKey(itemKey);
    setRemovalError(null);
    try {
      await removePreseasonGame(Number(gameId));
      await refresh();
    } catch (removeError) {
      setRemovalError(errorMessage(
        removeError,
        'The scheduled game could not be removed. Try again.',
      ));
    } finally {
      setRemovingItemKey(null);
    }
  };

  const removePendingRivalry = async (
    rivalry: NonConPageData['pending_rivalries'][number],
  ) => {
    if (removingItemKey) return;
    const itemKey = `rivalry:${rivalry.id}`;
    setRemovingItemKey(itemKey);
    setRemovalError(null);
    try {
      await dismissPendingRivalry(rivalry.teamA, rivalry.teamB);
      await refresh();
    } catch (removeError) {
      setRemovalError(errorMessage(
        removeError,
        'The pending rivalry could not be declined. Try again.',
      ));
    } finally {
      setRemovingItemKey(null);
    }
  };

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={data ?? undefined}
    >
      {data && (
        <>
          {data.info.stage !== 'preseason' ? (
            <StageUnavailableState
              title="Preseason scheduling unavailable"
              description="Manual non-conference scheduling is available only during Preseason."
              currentStage={data.info.stage}
            />
          ) : (
            <NonConWorkspace
              data={data}
              activeSection={activeSection}
              selectedWeek={selectedWeek}
              removingItemKey={removingItemKey}
              onSectionChange={setActiveSection}
              onScheduleWeek={selectScheduleWeek}
              onTeamClick={handleTeamClick}
              onRemoveGame={removeScheduledGame}
              onRemoveRivalry={removePendingRivalry}
            />
          )}

          <ScheduleOpponentDialog
            open={scheduleDialogOpen}
            week={selectedWeek}
            opponents={availableOpponents}
            query={opponentQuery}
            loading={opponentsLoading}
            savingRequest={savingRequest}
            loadError={opponentsError}
            saveError={scheduleError}
            onQueryChange={setOpponentQuery}
            onRetry={retryOpponents}
            onClose={closeScheduleDialog}
            onSchedule={submitScheduledGame}
          />
          <TeamInfoModal
            teamName={selectedTeam}
            open={teamDialogOpen}
            onClose={() => setTeamDialogOpen(false)}
          />
          <Snackbar
            open={Boolean(removalError)}
            autoHideDuration={8000}
            onClose={() => setRemovalError(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              severity="error"
              variant="filled"
              onClose={() => setRemovalError(null)}
              role="status"
            >
              {removalError}
            </Alert>
          </Snackbar>
        </>
      )}
    </PageLayout>
  );
};

export default NonCon;
