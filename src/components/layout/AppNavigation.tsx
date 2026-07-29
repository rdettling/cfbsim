import { Alert, Box, Snackbar } from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GameSelectionModal from '../sim/GameSelectionModal';
import GameSimModal from '../sim/GameSimModal';
import type { GameSimCloseOutcome } from '../sim/GameSimModal';
import LoadingDialog from '../sim/LoadingDialog';
import {
  getNextStageDefinition,
  getStageDefinition,
} from '../../constants/stages';
import {
  advanceOffseasonStage,
  initializeSeason,
  isOffseasonAdvanceStage,
  OffseasonConfigurationConflictError,
  OffseasonStageMismatchError,
} from '../../domain/league';
import DesktopNavigation from './DesktopNavigation';
import MobileNavigation from './MobileNavigation';
import {
  buildNavigationModel,
  getNavigationTeamName,
  normalizePath,
  type AppNavigationData,
  type StageAdvanceAction,
} from './navigation';

export interface AppNavigationProps {
  data: AppNavigationData;
  onAdvanceStage?: () => void;
  advanceActions?: StageAdvanceAction[];
  advanceLabel?: string;
}

const AppNavigation = ({
  data,
  onAdvanceStage,
  advanceActions,
  advanceLabel,
}: AppNavigationProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [gameSelectionOpen, setGameSelectionOpen] = useState(false);
  const [liveSimOpen, setLiveSimOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [advancingStage, setAdvancingStage] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const stageAdvanceLock = useRef(false);

  const model = useMemo(
    () => buildNavigationModel(data),
    [data.team, data.currentStage, data.info.lastWeek, data.info.team, data.conferences],
  );
  const navigationTeamName = getNavigationTeamName(data);
  const currentPath = normalizePath(location.pathname);
  const currentStageInfo = getStageDefinition(data.currentStage);
  const nextStageInfo = getNextStageDefinition(data.currentStage);
  const commandManagedStage =
    currentStageInfo?.id === 'recruiting' ||
    currentStageInfo?.id === 'roster_cuts';
  const teamAccent = data.info.colorPrimary || data.team.colorPrimary || 'primary.main';

  const handleGameSelect = (gameId: number) => {
    setSelectedGameId(gameId);
    setLiveSimOpen(true);
  };

  const handleLiveSimClose = (outcome: GameSimCloseOutcome) => {
    setLiveSimOpen(false);
    setSelectedGameId(null);
    if (outcome === 'completed') {
      window.dispatchEvent(new Event('pageDataRefresh'));
    }
  };

  const handleAdvanceStage = async () => {
    if (
      !currentStageInfo ||
      !nextStageInfo ||
      data.advanceDisabled ||
      (commandManagedStage &&
        !onAdvanceStage &&
        !advanceActions?.length) ||
      stageAdvanceLock.current
    ) return;

    if (commandManagedStage) {
      onAdvanceStage?.();
      return;
    }

    if (
      currentStageInfo.id !== 'preseason' &&
      !isOffseasonAdvanceStage(currentStageInfo.id)
    ) {
      navigate(nextStageInfo.path);
      return;
    }

    stageAdvanceLock.current = true;
    setAdvancingStage(true);
    setAdvanceError(null);
    try {
      const result =
        currentStageInfo.id === 'preseason'
          ? await initializeSeason(data.info.currentYear)
          : await advanceOffseasonStage(currentStageInfo.id);
      navigate(result.route);
    } catch (error) {
      if (
        error instanceof OffseasonStageMismatchError ||
        error instanceof OffseasonConfigurationConflictError
      ) {
        window.dispatchEvent(new Event('pageDataRefresh'));
      }
      setAdvanceError(
        error instanceof Error
          ? error.message
          : 'The offseason could not be advanced. Try again.',
      );
    } finally {
      stageAdvanceLock.current = false;
      setAdvancingStage(false);
    }
  };

  return (
    <>
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: theme => theme.zIndex.appBar,
          flexShrink: 0,
          borderTop: '3px solid',
          borderTopColor: teamAccent,
        }}
      >
        <DesktopNavigation
          data={data}
          teamName={navigationTeamName}
          model={model}
          currentPath={currentPath}
          currentStageInfo={currentStageInfo}
          nextStageInfo={nextStageInfo}
          onLiveSim={() => setGameSelectionOpen(true)}
          advancingStage={advancingStage}
          advanceDisabled={
            (data.advanceDisabled ?? false) ||
            (commandManagedStage &&
              !onAdvanceStage &&
              !advanceActions?.length)
          }
          onAdvanceStage={handleAdvanceStage}
          advanceActions={advanceActions}
          advanceLabel={advanceLabel}
        />
        <MobileNavigation
          data={data}
          teamName={navigationTeamName}
          model={model}
          currentPath={currentPath}
          currentStageInfo={currentStageInfo}
          nextStageInfo={nextStageInfo}
          onLiveSim={() => setGameSelectionOpen(true)}
          advancingStage={advancingStage}
          advanceDisabled={
            (data.advanceDisabled ?? false) ||
            (commandManagedStage &&
              !onAdvanceStage &&
              !advanceActions?.length)
          }
          onAdvanceStage={handleAdvanceStage}
          advanceActions={advanceActions}
          advanceLabel={advanceLabel}
        />
      </Box>

      <GameSelectionModal
        open={gameSelectionOpen}
        onClose={() => setGameSelectionOpen(false)}
        onGameSelect={handleGameSelect}
      />
      <GameSimModal
        open={liveSimOpen}
        onClose={handleLiveSimClose}
        gameId={selectedGameId}
      />
      <LoadingDialog
        open={advancingStage}
        message={`Advancing to ${nextStageInfo?.label ?? 'the next stage'}`}
      />
      <Snackbar
        open={Boolean(advanceError)}
        autoHideDuration={8000}
        onClose={() => setAdvanceError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setAdvanceError(null)}
        >
          {advanceError}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AppNavigation;
