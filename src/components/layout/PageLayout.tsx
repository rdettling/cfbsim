import { Alert, Box, CircularProgress, Container } from '@mui/material';
import type { ContainerProps } from '@mui/material';
import type { ReactNode } from 'react';
import AppShell from './AppShell';
import type { AppNavigationData } from './navigation';

export interface PageLayoutProps {
  loading: boolean;
  error: string | null;
  navbarData?: AppNavigationData;
  containerMaxWidth?: ContainerProps['maxWidth'];
  desktopViewportConstrained?: boolean;
  children: ReactNode;
}

export const PageLayout = ({
  loading,
  error,
  navbarData,
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
