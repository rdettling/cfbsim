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
  selectedWeek: number | null;
  removingItemKey: string | null;
  onSectionChange: (section: NonConSection) => void;
  onScheduleWeek: (week: number) => void;
  onTeamClick: TeamSelectionHandler;
  onRemoveGame: (gameId: string) => void;
  onRemoveRivalry: (rivalry: PendingRivalry) => void;
};

export const NonConWorkspace = ({
  data,
  activeSection,
  selectedWeek,
  removingItemKey,
  onSectionChange,
  onScheduleWeek,
  onTeamClick,
  onRemoveGame,
  onRemoveRivalry,
}: NonConWorkspaceProps) => {
  const scheduledWeeks = data.schedule.filter(game => game.opponent !== null).length;
  const remainingManualGames = Math.max(data.team.nonConfLimit - data.team.nonConfGames, 0);
  const schedulePanel = (
    <NonConSchedulePanel
      schedule={data.schedule}
      remainingManualGames={remainingManualGames}
      selectedWeek={selectedWeek}
      onSchedule={onScheduleWeek}
      onTeamClick={onTeamClick}
      onRemoveGame={onRemoveGame}
      removingItemKey={removingItemKey}
    />
  );
  const rivalriesPanel = (
    <PendingRivalriesPanel
      userTeam={data.team.name}
      rivalries={data.pending_rivalries}
      warnings={data.rivalryWarnings}
      onTeamClick={onTeamClick}
      onRemove={onRemoveRivalry}
      removingItemKey={removingItemKey}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: { lg: 1 }, minHeight: { lg: 0 } }}>
      <NonConHeader
        team={data.team}
        scheduledWeeks={scheduledWeeks}
        pendingRivalries={data.pending_rivalries.length}
      />

      <Box
        sx={{
          display: { xs: 'none', lg: 'grid' },
          gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 420px)',
          gridTemplateRows: 'minmax(0, 1fr)',
          gap: 1.25,
          flex: 1,
          minHeight: 0,
        }}
      >
        {schedulePanel}
        <PendingRivalriesPanel
          userTeam={data.team.name}
          rivalries={data.pending_rivalries}
          warnings={data.rivalryWarnings}
          onTeamClick={onTeamClick}
          onRemove={onRemoveRivalry}
          removingItemKey={removingItemKey}
        />
      </Box>

      <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
        <Tabs
          value={activeSection}
          onChange={(_, value: NonConSection) => onSectionChange(value)}
          aria-label="Preseason scheduling sections"
          variant="fullWidth"
          selectionFollowsFocus
          sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 1.25 }}
        >
          <Tab value="schedule" label="Schedule" id="noncon-tab-schedule" aria-controls="noncon-panel-schedule" />
          <Tab value="rivalries" label="Rivalries" id="noncon-tab-rivalries" aria-controls="noncon-panel-rivalries" />
        </Tabs>
        <Box
          role="tabpanel"
          id={`noncon-panel-${activeSection}`}
          aria-labelledby={`noncon-tab-${activeSection}`}
        >
          {activeSection === 'schedule' ? schedulePanel : rivalriesPanel}
        </Box>
      </Box>
    </Box>
  );
};
