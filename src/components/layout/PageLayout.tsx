import { Alert, Box, CircularProgress, Container } from '@mui/material';
import type { ContainerProps } from '@mui/material';
import type { ReactNode } from 'react';
import AppShell from './AppShell';
import type {
  AppNavigationData,
  StageAdvanceAction,
} from './navigation';

export interface PageLayoutProps {
  loading: boolean;
  error: string | null;
  navbarData?: AppNavigationData;
  onAdvanceStage?: () => void;
  advanceActions?: StageAdvanceAction[];
  advanceLabel?: string;
  containerMaxWidth?: ContainerProps['maxWidth'];
  desktopViewportConstrained?: boolean;
  children: ReactNode;
}

export const PageLayout = ({
  loading,
  error,
  navbarData,
  onAdvanceStage,
  advanceActions,
  advanceLabel,
  containerMaxWidth = 'lg',
  desktopViewportConstrained = false,
  children,
}: PageLayoutProps) => {
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (navbarData) {
    return (
      <AppShell
        navigationData={navbarData}
        onAdvanceStage={onAdvanceStage}
        advanceActions={advanceActions}
        advanceLabel={advanceLabel}
        containerMaxWidth={containerMaxWidth}
        desktopViewportConstrained={desktopViewportConstrained}
      >
        {children}
      </AppShell>
    );
  }

  if (containerMaxWidth !== false) {
    return (
      <Container maxWidth={containerMaxWidth} sx={{ py: 4 }}>
        {children}
      </Container>
    );
  }

  return children;
};

export default PageLayout;
