import { Stack, Typography } from '@mui/material';
import { storyKicker } from '../../../domain/news/presentation';
import type { GamePageData } from '../../../types/pages';

export const GameRecap = ({ story }: { story: GamePageData['game']['story'] }) => {
  if (!story) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No written recap is available for this game.
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5}>
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
        {storyKicker(story)}
      </Typography>
      <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
        {story.headline}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.45 }}>
        {story.deck}
      </Typography>
    </Stack>
  );
};
