import { Box, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type DashboardPanelProps = {
  title: string;
  ariaLabel: string;
  children: ReactNode;
};

export const DashboardPanel = ({
  title,
  ariaLabel,
  children,
}: DashboardPanelProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label={ariaLabel}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden',
    }}
  >
    <Box
      component="header"
      sx={{
        px: 1.75,
        py: 1.1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <Typography variant="h6">{title}</Typography>
    </Box>
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        maxHeight: { sm: 420, lg: 'none' },
        overflowY: { xs: 'visible', sm: 'auto' },
      }}
    >
      {children}
    </Box>
  </Paper>
);
