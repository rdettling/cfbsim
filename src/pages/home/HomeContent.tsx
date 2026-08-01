import { Box } from '@mui/material';
import type { HomeData } from '../../types/league';
import { DynastyLauncher } from './DynastyLauncher';
import { HomeCapabilities, HomeOverview } from './HomeOverview';

type HomeContentProps = {
  data: HomeData;
};

export const HomeContent = ({ data }: HomeContentProps) => (
  <Box
    sx={{
      width: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: { xs: 1, sm: 1.5 },
    }}
  >
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)',
        },
        gridTemplateAreas: {
          xs: '"launcher" "overview"',
          md: '"overview launcher"',
        },
        gap: { xs: 1, sm: 1.5 },
        alignItems: 'stretch',
      }}
    >
      <HomeOverview />
      <DynastyLauncher data={data} />
    </Box>
    <HomeCapabilities />
  </Box>
);
