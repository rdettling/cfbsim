import { Link as RouterLink } from 'react-router-dom';
import { Link, Paper, Stack, Typography } from '@mui/material';
import type { GamePageData } from '../../../types/pages';

type Context = NonNullable<GamePageData['dynastyContext']>;

export const DynastyContextPanel = ({ context }: { context: Context }) => (
  <Paper component="section" variant="outlined" sx={{ p: 1.5 }}>
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
    >
      <div>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Dynasty Context
        </Typography>
        <Typography variant="body2">{context.callback}</Typography>
      </div>
      <Stack sx={{ alignItems: { sm: 'flex-end' } }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Series: {context.wins}-{context.losses}
        </Typography>
        {context.streak && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Streak: {context.streak}
          </Typography>
        )}
        {context.lastMeeting && (
          <Link
            component={RouterLink}
            to={`/game/${context.lastMeeting.id}`}
            variant="caption"
            underline="hover"
          >
            View last meeting
          </Link>
        )}
      </Stack>
    </Stack>
  </Paper>
);
