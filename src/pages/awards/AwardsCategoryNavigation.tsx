import {
  Box,
  ButtonBase,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import type {
  AwardEntry,
  AwardMode,
  AwardSelectionHandler,
} from './types';

type AwardsCategoryNavigationProps = {
  awards: AwardEntry[];
  selectedSlug: string;
  mode: AwardMode;
  onSelect: AwardSelectionHandler;
};

const getLeaderName = (award: AwardEntry) => {
  const player = award.first_place;
  return player ? `${player.first} ${player.last}` : 'No candidates yet';
};

export const AwardsCategoryNavigation = ({
  awards,
  selectedSlug,
  mode,
  onSelect,
}: AwardsCategoryNavigationProps) => (
  <>
    <Paper
      component="nav"
      aria-label="Award categories"
      variant="outlined"
      sx={{
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="overline" color="text.secondary">
          Award Categories
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {awards.map((award) => {
          const selected = award.category_slug === selectedSlug;
          return (
            <ButtonBase
              key={award.category_slug}
              onClick={() => onSelect(award.category_slug)}
              aria-current={selected ? 'page' : undefined}
              sx={{
                display: 'block',
                width: '100%',
                px: 1.5,
                py: 1.15,
                textAlign: 'left',
                borderLeft: '3px solid',
                borderLeftColor: selected ? 'primary.main' : 'transparent',
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
                bgcolor: selected ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: selected ? 700 : 600 }}>
                {award.category_name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {mode === 'final' ? 'Winner' : 'Leader'}: {getLeaderName(award)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Paper>

    <Paper
      component="nav"
      aria-label="Award categories"
      variant="outlined"
      sx={{ display: { xs: 'block', lg: 'none' }, mb: 1.25 }}
    >
      <Tabs
        value={selectedSlug}
        onChange={(_, value: string) => onSelect(value)}
        variant="scrollable"
        scrollButtons="auto"
        selectionFollowsFocus
        aria-label="Award categories"
      >
        {awards.map((award) => (
          <Tab
            key={award.category_slug}
            value={award.category_slug}
            label={award.category_name}
          />
        ))}
      </Tabs>
    </Paper>
  </>
);
