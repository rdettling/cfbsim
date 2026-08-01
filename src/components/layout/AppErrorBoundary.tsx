import { Alert, Box, Button } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  failed: boolean;
};

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application route failed to render.', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 2,
        }}
      >
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          This page could not be loaded.
        </Alert>
      </Box>
    );
  }
}

export default AppErrorBoundary;
