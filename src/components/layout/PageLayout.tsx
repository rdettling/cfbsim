import { Alert, Container } from '@mui/material';
import type { ContainerProps } from '@mui/material';
import type { ReactNode } from 'react';
import AppShell from './AppShell';
import FullPageLoading from './FullPageLoading';
import type {
  AppNavigationData,
  OffseasonAdvanceContext,
} from './navigation';

export interface PageLayoutProps {
  loading: boolean;
  error: string | null;
  navbarData?: AppNavigationData;
  offseasonAdvanceContext?: OffseasonAdvanceContext;
  containerMaxWidth?: ContainerProps['maxWidth'];
  desktopViewportConstrained?: boolean;
  children: ReactNode;
}

export const PageLayout = ({
  loading,
  error,
  navbarData,
  offseasonAdvanceContext,
  containerMaxWidth = 'lg',
  desktopViewportConstrained = false,
  children,
}: PageLayoutProps) => {
  if (loading) {
    return <FullPageLoading />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (navbarData) {
    return (
      <AppShell
        navigationData={navbarData}
        offseasonAdvanceContext={offseasonAdvanceContext}
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
