import { Box, Tab, Tabs } from '@mui/material';
import type { NonConPageData } from '../../types/pages';
import { NonConHeader } from './NonConHeader';
import { NonConSchedulePanel } from './NonConSchedulePanel';
import { PendingRivalriesPanel } from './PendingRivalriesPanel';
import type {
  NonConSection,
  PendingRivalry,
  TeamSelectionHandler,
} from './types';

type NonConWorkspaceProps = {
  data: NonConPageData;
  activeSection: NonConSection;
  onSectionChange: (section: NonConSection) => void;
  onSchedule: (week: number) => void;
  onTeamClick: TeamSelectionHandler;
  onRemoveGame: (gameId: string) => void;
  onRemoveRivalry: (rivalry: PendingRivalry) => void;
  removingItemKey: string | null;
};
export const NonConWorkspace = ({
  data,
  activeSection,
  onSectionChange,
  onSchedule,
  onTeamClick,
  onRemoveGame,
  onRemoveRivalry,
  removingItemKey,
}: NonConWorkspaceProps) => {
  const scheduledWeeks = data.schedule.filter(
    (game) => game.opponent !== null
  ).length;
  const openWeeks = data.schedule.length - scheduledWeeks;
  const remainingManualGames = Math.max(
    data.team.nonConfLimit - data.team.nonConfGames,
    0
  );
  const schedulePanel = (
    <NonConSchedulePanel
      schedule={data.schedule}
      remainingManualGames={remainingManualGames}
      onSchedule={onSchedule}
      onTeamClick={onTeamClick}
      onRemoveGame={onRemoveGame}
      removalBusy={removingItemKey !== null}
    />
  );
  const rivalriesPanel = (
    <PendingRivalriesPanel
      rivalries={data.pending_rivalries}
      warnings={data.rivalryWarnings}
      onTeamClick={onTeamClick}
      onRemove={onRemoveRivalry}
      removalBusy={removingItemKey !== null}
    />
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: { lg: 1 },
        minHeight: { lg: 0 },
      }}
    >
      <NonConHeader
        team={data.team}
        year={data.info.currentYear}
        scheduledWeeks={scheduledWeeks}
        openWeeks={openWeeks}
        remainingManualGames={remainingManualGames}
        onTeamClick={onTeamClick}
      />

      <Box
        sx={{
          display: { xs: 'none', lg: 'grid' },
          gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 0.34fr)',
          gridTemplateRows: 'minmax(0, 1fr)',
          gap: 1.25,
          flex: 1,
          minHeight: 0,
        }}
      >
        {schedulePanel}
        {rivalriesPanel}
      </Box>

      <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
        <Tabs
          value={activeSection}
          onChange={(_, value: NonConSection) => onSectionChange(value)}
          aria-label="Preseason scheduling sections"
          variant="fullWidth"
          selectionFollowsFocus
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab
            value="schedule"
            label="Schedule"
            id="noncon-tab-schedule"
            aria-controls="noncon-panel-schedule"
          />
          <Tab
            value="rivalries"
            label="Rivalries"
            id="noncon-tab-rivalries"
            aria-controls="noncon-panel-rivalries"
          />
        </Tabs>
        <Box
          role="tabpanel"
          id={`noncon-panel-${activeSection}`}
          aria-labelledby={`noncon-tab-${activeSection}`}
          sx={{
            height: { xs: 'min(58vh, 570px)', md: 'min(66vh, 690px)' },
            pt: 1.25,
          }}
        >
          {activeSection === 'schedule' ? schedulePanel : rivalriesPanel}
        </Box>
      </Box>
    </Box>
  );
};
