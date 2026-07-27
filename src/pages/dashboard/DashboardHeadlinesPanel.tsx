import { Box, Chip, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { DashboardPanel } from './DashboardPanel';
import type { DashboardHeadline } from './types';

type DashboardHeadlinesPanelProps = {
  headlines: DashboardHeadline[];
};

export const DashboardHeadlinesPanel = ({ headlines }: DashboardHeadlinesPanelProps) => (
  <DashboardPanel title="Headlines" ariaLabel="Top game headlines">
    {headlines.length > 0 ? (
      headlines.map((game, index) => (
        <Box
          key={game.id}
          sx={{
            p: 1.5,
            borderBottom: index === headlines.length - 1 ? 0 : '1px solid',
            borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Typography
            component={RouterLink}
            to={`/game/${game.id}`}
            variant="body2"
            sx={{
              display: 'inline-block',
              color: 'primary.main',
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {game.headline}
          </Typography>
          {game.subtitle && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                mt: 0.35,
              }}
            >
              {game.subtitle}
            </Typography>
          )}
          {game.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
              {game.tags.map((tag) => (
                <Chip key={`${game.id}-${tag}`} label={tag} size="small" variant="outlined" />
              ))}
            </Stack>
          )}
        </Box>
      ))
    ) : (
      <Box sx={{ p: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          No completed-game headlines are available for the previous week.
        </Typography>
      </Box>
    )}
  </DashboardPanel>
);
