import { Box, Container } from '@mui/material';
import type { ContainerProps } from '@mui/material';
import type { ReactNode } from 'react';
import AppNavigation from './AppNavigation';
import type {
  AppNavigationData,
  StageAdvanceAction,
} from './navigation';

export interface AppShellProps {
  navigationData: AppNavigationData;
  onAdvanceStage?: () => void;
  advanceActions?: StageAdvanceAction[];
  advanceLabel?: string;
  containerMaxWidth?: ContainerProps['maxWidth'];
  desktopViewportConstrained?: boolean;
  children: ReactNode;
}

const AppShell = ({
  navigationData,
  onAdvanceStage,
  advanceActions,
  advanceLabel,
  containerMaxWidth = 'lg',
  desktopViewportConstrained = false,
  children,
}: AppShellProps) => (
  <Box
    sx={{
      minHeight: '100vh',
      ...(desktopViewportConstrained && {
        '@media (min-width: 1200px)': {
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }),
    }}
  >
    <AppNavigation
      data={navigationData}
      onAdvanceStage={onAdvanceStage}
      advanceActions={advanceActions}
      advanceLabel={advanceLabel}
    />
    {containerMaxWidth !== false ? (
      <Container
        component="main"
        maxWidth={containerMaxWidth}
        sx={{
          py: { xs: 2, md: 3 },
          ...(desktopViewportConstrained && {
            flex: { lg: 1 },
            display: { lg: 'flex' },
            flexDirection: { lg: 'column' },
            minHeight: { lg: 0 },
            overflow: { lg: 'hidden' },
          }),
        }}
      >
        {children}
      </Container>
    ) : (
      <Box
        component="main"
        sx={{
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
          ...(desktopViewportConstrained && {
            flex: { lg: 1 },
            display: { lg: 'flex' },
            flexDirection: { lg: 'column' },
            minHeight: { lg: 0 },
            overflow: { lg: 'hidden' },
          }),
        }}
      >
        {children}
      </Box>
    )}
  </Box>
);

export default AppShell;
