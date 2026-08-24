import { Alert, Box, Snackbar } from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GameSelectionModal from '../sim/GameSelectionModal';
import GameSimModal from '../sim/GameSimModal';
import type { GameSimCloseOutcome } from '../sim/GameSimModal';
import LoadingDialog from '../sim/LoadingDialog';
import {
  getStageDefinition,
  getStageRoute,
  type OffseasonFlowStage,
  type OffseasonFlowTarget,
} from '../../constants/stages';
import { ROUTES } from '../../constants/routes';
import { advanceOffseasonToStage } from '../../domain/league/commands/offseasonFlow';
import { loadCurrentStageRoute } from '../../domain/league/loaders/currentStageRoute';
import { advanceWeeks } from '../../domain/sim/orchestrator';
import DesktopNavigation from './DesktopNavigation';
import MobileNavigation from './MobileNavigation';
import {
  buildNavigationModel,
  getTeamContextName,
  getUserTeamName,
  normalizePath,
  type AppNavigationData,
  type OffseasonAdvanceContext,
} from './navigation';
import { buildLeagueCalendarModel } from './leagueCalendar';

export interface AppNavigationProps {
  data: AppNavigationData;
  offseasonAdvanceContext?: OffseasonAdvanceContext;
}

const AppNavigation = ({
  data,
  offseasonAdvanceContext,
}: AppNavigationProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [gameSelectionOpen, setGameSelectionOpen] = useState(false);
  const [liveSimOpen, setLiveSimOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [advancingTarget, setAdvancingTarget] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const navigationActionLock = useRef(false);

  const userTeamName = getUserTeamName(data);
  const teamContextName = getTeamContextName(data, location.pathname);
  const model = useMemo(
    () => buildNavigationModel(data, teamContextName),
    [
      data.team,
      data.info.lastWeek,
      data.info.team,
      data.conferences,
      data.playoffTeams,
      teamContextName,
    ],
  );
  const calendar = useMemo(
    () => buildLeagueCalendarModel(data),
    [data.info.currentWeek, data.info.currentYear, data.info.lastWeek, data.info.stage],
  );
  const currentPath = normalizePath(location.pathname);
  const flowStage = calendar.kind === 'offseason'
    ? calendar.currentStage
    : null;
  const teamAccent = data.team.colorPrimary || 'primary.main';
  const navigationBusy = Boolean(advancingTarget) || gameSelectionOpen || liveSimOpen;

  const handleOpenLiveSim = () => {
    if (navigationActionLock.current) return;
    navigationActionLock.current = true;
    setGameSelectionOpen(true);
  };

  const handleGameSelectionClose = () => {
    setGameSelectionOpen(false);
    navigationActionLock.current = false;
  };

  const handleGameSelect = (gameId: number) => {
    setGameSelectionOpen(false);
    setSelectedGameId(gameId);
    setLiveSimOpen(true);
  };

  const handleLiveSimClose = (outcome: GameSimCloseOutcome) => {
    setLiveSimOpen(false);
    setSelectedGameId(null);
    navigationActionLock.current = false;
    if (outcome === 'completed') {
      window.dispatchEvent(new Event('pageDataRefresh'));
    }
  };

  const handleAdvanceOffseasonTo = async (target: OffseasonFlowTarget) => {
    if (data.advanceDisabled || navigationActionLock.current) return;
    navigationActionLock.current = true;
    const targetLabel = target === 'season'
      ? `the ${calendar.year} Season`
      : getStageDefinition(target).flowLabel;
    setAdvancingTarget(targetLabel);
    setAdvanceError(null);
    try {
      const result = await advanceOffseasonToStage(target, {
        recruitingAllocations:
          offseasonAdvanceContext?.recruitingAllocations,
      });
      navigate(result.route);
    } catch (error) {
      try {
        navigate(await loadCurrentStageRoute());
        window.dispatchEvent(new Event('pageDataRefresh'));
      } catch {
        // Preserve the original command failure when recovery cannot reload.
      }
      setAdvanceError(
        error instanceof Error
          ? error.message
          : 'The offseason could not be advanced. Try again.',
      );
    } finally {
      navigationActionLock.current = false;
      setAdvancingTarget(null);
    }
  };

  const handleAdvanceToWeek = async (targetWeek: number) => {
    if (data.advanceDisabled || navigationActionLock.current || calendar.kind !== 'season') {
      return;
    }
    navigationActionLock.current = true;
    const finishingSeason = targetWeek > calendar.lastWeek;
    setAdvancingTarget(finishingSeason ? 'Season Summary' : `Week ${targetWeek}`);
    setAdvanceError(null);
    try {
      await advanceWeeks(targetWeek);
      if (finishingSeason) {
        navigate(ROUTES.SEASON_SUMMARY);
      } else {
        window.dispatchEvent(new Event('pageDataRefresh'));
      }
    } catch (error) {
      window.dispatchEvent(new Event('pageDataRefresh'));
      setAdvanceError(
        error instanceof Error
          ? error.message
          : 'The season could not be advanced. Try again.',
      );
    } finally {
      navigationActionLock.current = false;
      setAdvancingTarget(null);
    }
  };

  const handleSelectFlowStage = (stage: OffseasonFlowStage) => {
    if (stage === flowStage) {
      navigate(getStageRoute(stage));
      return;
    }
    void handleAdvanceOffseasonTo(stage as OffseasonFlowTarget);
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
          teamName={userTeamName}
          model={model}
          currentPath={currentPath}
          calendar={calendar}
          onLiveSim={handleOpenLiveSim}
          advancing={navigationBusy}
          advanceDisabled={data.advanceDisabled ?? false}
          onSelectFlowStage={handleSelectFlowStage}
          onStartSeason={() => void handleAdvanceOffseasonTo('season')}
          onAdvanceToWeek={(targetWeek) => void handleAdvanceToWeek(targetWeek)}
          onOpenSummary={() => navigate(ROUTES.SEASON_SUMMARY)}
        />
        <MobileNavigation
          teamName={userTeamName}
          model={model}
          currentPath={currentPath}
          calendar={calendar}
          onLiveSim={handleOpenLiveSim}
          advancing={navigationBusy}
          advanceDisabled={data.advanceDisabled ?? false}
          onSelectFlowStage={handleSelectFlowStage}
          onStartSeason={() => void handleAdvanceOffseasonTo('season')}
          onAdvanceToWeek={(targetWeek) => void handleAdvanceToWeek(targetWeek)}
          onOpenSummary={() => navigate(ROUTES.SEASON_SUMMARY)}
        />
      </Box>

      <GameSelectionModal
        open={gameSelectionOpen}
        onClose={handleGameSelectionClose}
        onGameSelect={handleGameSelect}
      />
      <GameSimModal
        open={liveSimOpen}
        onClose={handleLiveSimClose}
        gameId={selectedGameId}
      />
      <LoadingDialog
        open={Boolean(advancingTarget)}
        message={`Simulating to ${advancingTarget ?? 'the selected stage'}`}
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
