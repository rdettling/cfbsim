import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { NewsItem } from '../../types/news';
import { storyKicker, storyRoute } from '../../domain/news/presentation';

export const NewsStoryCard = ({
  story,
  lead = false,
  showWeek = false,
}: {
  story: NewsItem;
  lead?: boolean;
  showWeek?: boolean;
}) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      variant="overline"
      sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}
    >
      {storyKicker(story)}{showWeek ? ` · Week ${story.week}` : ''}
    </Typography>
    <Typography
      component={RouterLink}
      to={storyRoute(story)}
      variant={lead ? 'h5' : 'body1'}
      sx={{
        color: 'text.primary',
        display: 'block',
        fontWeight: lead ? 750 : 700,
        lineHeight: lead ? 1.15 : 1.25,
        textDecoration: 'none',
        '&:hover': { color: 'primary.main', textDecoration: 'underline' },
      }}
    >
      {story.headline}
    </Typography>
    <Typography
      variant={lead ? 'body2' : 'caption'}
      sx={{ color: 'text.secondary', display: 'block', mt: 0.5, lineHeight: 1.4 }}
    >
      {story.deck}
    </Typography>
  </Box>
);
