import type { ReactNode } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';

type GamePanelProps = {
  title?: string;
  ariaLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
};

export const GamePanel = ({
  title,
  ariaLabel,
  actions,
  children,
  scrollable = false,
}: GamePanelProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label={ariaLabel}
    sx={{
      height: '100%',
      minHeight: 0,
      p: 1.5,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
  >
    {(title || actions) && (
      <Box
        sx={{
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1,
          flexShrink: 0,
        }}
      >
        {title && (
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
        )}
        {actions}
      </Box>
    )}
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        ...(scrollable && {
          overflowY: 'auto',
          overflowX: 'hidden',
          pr: 0.25,
          scrollbarWidth: 'thin',
        }),
      }}
    >
      {children}
    </Box>
  </Paper>
);

export type GameTab<T extends string> = {
  value: T;
  label: string;
};

type GameTabbedPanelProps<T extends string> = {
  tabs: Array<GameTab<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  children: ReactNode;
  scrollable?: boolean;
};

export const GameTabbedPanel = <T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  children,
  scrollable = true,
}: GameTabbedPanelProps<T>) => {
  const idPrefix = ariaLabel.toLowerCase().split(' ').join('-');

  return (
    <Paper
    component="section"
    variant="outlined"
    aria-label={ariaLabel}
    sx={{
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
  >
    <Tabs
      value={value}
      onChange={(_, next: T) => onChange(next)}
      variant="fullWidth"
      selectionFollowsFocus
      aria-label={ariaLabel}
      sx={{
        minHeight: 42,
        flexShrink: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.value}
          id={`${idPrefix}-tab-${tab.value}`}
          aria-controls={`${idPrefix}-panel-${tab.value}`}
          value={tab.value}
          label={tab.label}
          sx={{ minHeight: 42, px: 1 }}
        />
      ))}
    </Tabs>
    <Box
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      sx={{
        flex: 1,
        minHeight: 0,
        p: 1.5,
        ...(scrollable && {
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
        }),
      }}
    >
      {children}
    </Box>
    </Paper>
  );
};
