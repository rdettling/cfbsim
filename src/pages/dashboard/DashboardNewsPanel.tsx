import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { NewsStoryCard } from '../../components/news/NewsStoryCard';
import { ROUTES } from '../../constants/routes';
import type { NewsItem } from '../../types/news';
import { DashboardPanel } from './DashboardPanel';

export const DashboardNewsPanel = ({ stories }: { stories: NewsItem[] }) => (
  <DashboardPanel title="League News" ariaLabel="National league news">
    {stories.length ? (
      <Stack divider={<Divider flexItem />}>
        {stories.map(story => (
          <Box key={story.id} sx={{ p: 1.5, '&:hover': { bgcolor: 'action.hover' } }}>
            <NewsStoryCard story={story} />
          </Box>
        ))}
        <Box sx={{ p: 1.25 }}>
          <Button component={RouterLink} to={ROUTES.NEWS} size="small" fullWidth>
            View all league news
          </Button>
        </Box>
      </Stack>
    ) : (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          The national desk will publish stories as games and league events unfold.
        </Typography>
      </Box>
    )}
  </DashboardPanel>
);
