import { Box } from '@mui/material';
import type {
  SeasonSummaryChampionship,
  SeasonSummaryLegacy,
  SeasonSummaryTeam,
  TeamSelectionHandler,
} from './types';
import { ChampionshipPanel } from './ChampionshipPanel';
import { YourSeasonPanel } from './YourSeasonPanel';

type SeasonOverviewProps = {
  championship: SeasonSummaryChampionship | null;
  userTeam: SeasonSummaryTeam;
  legacy: SeasonSummaryLegacy | null;
  onTeamClick: TeamSelectionHandler;
};

export const SeasonOverview = ({
  championship,
  userTeam,
  legacy,
  onTeamClick,
}: SeasonOverviewProps) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(320px, 1fr)' },
      gap: 1.25,
      alignItems: 'stretch',
    }}
  >
    <YourSeasonPanel userTeam={userTeam} legacy={legacy} onTeamClick={onTeamClick} />
    <ChampionshipPanel championship={championship} onTeamClick={onTeamClick} />
  </Box>
);
