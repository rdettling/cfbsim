import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import type { PlayerPageData } from '../../types/pages';
import type { PlayerCareerSeason, PlayerGameLog, PlayerStatCategory } from '../../types/player';
import { PlayerCareerDesktopTable } from './PlayerCareerDesktopTable';
import { PlayerCareerMobileList } from './PlayerCareerMobileList';
import { PlayerGameLogsDesktopTable } from './PlayerGameLogsDesktopTable';
import { PlayerGameLogsMobileList } from './PlayerGameLogsMobileList';

export type PlayerTab = 'career' | 'logs';

type PlayerStatsWorkspaceProps = {
  activeTab: PlayerTab;
  onTabChange: (tab: PlayerTab) => void;
  years: number[];
  selectedYear: number | null;
  onYearChange: (year: number) => void;
  seasons: Array<{ year: number; season: PlayerCareerSeason }>;
  gameLogs: PlayerGameLog[];
  category: PlayerStatCategory;
  gameLogScope: PlayerPageData['gameLogScope'];
  onTeamClick: (teamName: string) => void;
};

const EmptyState = ({ title, detail }: { title: string; detail?: string }) => (
  <Box
    sx={{
      flex: { lg: 1 },
      minHeight: { xs: 180, lg: 0 },
      display: 'grid',
      placeItems: 'center',
      p: 3,
      textAlign: 'center',
    }}
  >
    <Box>
      <Typography variant="h6">{title}</Typography>
      {detail && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {detail}
        </Typography>
      )}
    </Box>
  </Box>
);

export const PlayerStatsWorkspace = ({
  activeTab,
  onTabChange,
  years,
  selectedYear,
  onYearChange,
  seasons,
  gameLogs,
  category,
  gameLogScope,
  onTeamClick,
}: PlayerStatsWorkspaceProps) => {
  const activePanelId = `player-${activeTab}-panel`;

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="Player statistics"
      sx={{
        flex: { lg: 1 },
        minHeight: { lg: 0 },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          minHeight: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, value: PlayerTab) => onTabChange(value)}
          aria-label="Player statistics section"
          sx={{ minHeight: 44 }}
        >
          <Tab
            id="player-career-tab"
            aria-controls="player-career-panel"
            value="career"
            label="Career"
            sx={{ minHeight: 44, py: 0 }}
          />
          <Tab
            id="player-logs-tab"
            aria-controls="player-logs-panel"
            value="logs"
            label="Game Logs"
            sx={{ minHeight: 44, py: 0 }}
          />
        </Tabs>
        {activeTab === 'logs' && years.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 104 }}>
            <InputLabel id="player-log-year-label">Year</InputLabel>
            <Select
              labelId="player-log-year-label"
              value={selectedYear ?? ''}
              label="Year"
              onChange={(event) => onYearChange(Number(event.target.value))}
            >
              {years.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {activeTab === 'logs' && gameLogScope === 'retained_postseason_only' && (
        <Box
          role="note"
          sx={{
            flexShrink: 0,
            px: 1.5,
            py: 0.75,
            bgcolor: 'action.hover',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Career totals are complete. Game-by-game history is limited to retained conference
            championship and playoff games.
          </Typography>
        </Box>
      )}

      <Box
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={`player-${activeTab}-tab`}
        sx={{
          flex: { lg: 1 },
          minHeight: { lg: 0 },
          display: 'flex',
          flexDirection: 'column',
          overflow: { lg: 'hidden' },
        }}
      >
        {activeTab === 'career' ? (
          seasons.length > 0 ? (
            <>
              <PlayerCareerDesktopTable seasons={seasons} category={category} />
              <PlayerCareerMobileList seasons={seasons} category={category} />
            </>
          ) : (
            <EmptyState title="No career statistics available" />
          )
        ) : gameLogs.length > 0 ? (
          <>
            <PlayerGameLogsDesktopTable
              logs={gameLogs}
              category={category}
              onTeamClick={onTeamClick}
            />
            <PlayerGameLogsMobileList
              logs={gameLogs}
              category={category}
              onTeamClick={onTeamClick}
            />
          </>
        ) : (
          <EmptyState
            title="No games played this season"
            detail={
              gameLogScope === 'retained_postseason_only'
                ? 'Career totals are complete; ordinary historical game detail is not retained.'
                : 'Game logs will appear after this player records statistics.'
            }
          />
        )}
      </Box>
    </Paper>
  );
};
