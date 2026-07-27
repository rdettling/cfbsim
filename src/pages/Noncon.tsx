import { useCallback, useRef, useState } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { TeamInfoModal } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import {
  listAvailableTeams,
  loadNonCon,
  scheduleNonConGame,
} from '../domain/league';
import type { NonConPageData } from '../types/pages';
import { NonConWorkspace } from './noncon/NonConWorkspace';
import { ScheduleOpponentDialog } from './noncon/ScheduleOpponentDialog';
import {
  type NonConSection,
} from './noncon/types';

export const NonCon = () => {
  const opponentRequestId = useRef(0);

  const [activeSection, setActiveSection] = useState<NonConSection>('schedule');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [opponentsLoading, setOpponentsLoading] = useState(false);
  const [opponentsError, setOpponentsError] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);

  const fetchData = useCallback(
    async (): Promise<NonConPageData> => loadNonCon(),
    [],
  );

  const { data, loading, error, refetch } = useDomainData<NonConPageData>({
    fetcher: fetchData,
  });

  const closeScheduleDialog = () => {
    if (scheduleSaving) return;
    opponentRequestId.current += 1;
    setScheduleDialogOpen(false);
    setSelectedWeek(null);
    setAvailableTeams([]);
    setSelectedOpponent(null);
    setOpponentsLoading(false);
    setOpponentsError(null);
    setScheduleError(null);
  };

  const openScheduleDialog = async (week: number) => {
    const requestId = opponentRequestId.current + 1;
    opponentRequestId.current = requestId;
    setSelectedWeek(week);
    setAvailableTeams([]);
    setSelectedOpponent(null);
    setOpponentsError(null);
    setScheduleError(null);
    setScheduleDialogOpen(true);
    setOpponentsLoading(true);

    try {
      const teams = await listAvailableTeams(week);
      if (opponentRequestId.current === requestId) {
        setAvailableTeams(teams);
      }
    } catch {
      if (opponentRequestId.current === requestId) {
        setOpponentsError('Eligible opponents could not be loaded. Try again.');
      }
    } finally {
      if (opponentRequestId.current === requestId) {
        setOpponentsLoading(false);
      }
    }
  };

  const submitScheduledGame = async () => {
    if (selectedWeek === null || selectedOpponent === null) return;

    setScheduleSaving(true);
    setScheduleError(null);
    try {
      await scheduleNonConGame(selectedOpponent, selectedWeek);
      await refetch();
      setScheduleDialogOpen(false);
      setSelectedWeek(null);
      setAvailableTeams([]);
      setSelectedOpponent(null);
    } catch {
      setScheduleError('The game could not be scheduled. Refresh the candidates and try again.');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setTeamDialogOpen(true);
  };

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={
        data
          ? {
              team: data.team,
              currentStage: data.info.stage,
              info: data.info,
              conferences: data.conferences,
            }
          : undefined
      }
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
              onSectionChange={setActiveSection}
              onSchedule={openScheduleDialog}
              onTeamClick={handleTeamClick}
            />
          )}

          <ScheduleOpponentDialog
            open={scheduleDialogOpen}
            week={selectedWeek}
            options={availableTeams}
            selectedOpponent={selectedOpponent}
            loading={opponentsLoading}
            saving={scheduleSaving}
            loadError={opponentsError}
            saveError={scheduleError}
            onOpponentChange={setSelectedOpponent}
            onClose={closeScheduleDialog}
            onSubmit={submitScheduledGame}
          />
          <TeamInfoModal
            teamName={selectedTeam}
            open={teamDialogOpen}
            onClose={() => setTeamDialogOpen(false)}
          />
        </>
      )}
    </PageLayout>
  );
};
