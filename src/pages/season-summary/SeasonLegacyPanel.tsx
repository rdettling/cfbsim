import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Link, Paper, Stack, Typography } from '@mui/material';
import type { SeasonSummaryPageData } from '../../types/pages';

type Legacy = NonNullable<SeasonSummaryPageData['legacy']>;

export const SeasonLegacyPanel = ({ legacy }: { legacy: Legacy }) => (
  <Paper component="section" variant="outlined" sx={{ p: 1.5, mt: 1.25 }}>
    <Typography variant="overline" sx={{ color: 'text.secondary' }}>
      Legacy of This Season
    </Typography>
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
      {legacy.accomplishments.map(accomplishment => (
        <Chip
          key={`${accomplishment.type}-${accomplishment.label}`}
          label={accomplishment.label}
          size="small"
          variant="outlined"
        />
      ))}
      {!legacy.accomplishments.length && (
        <Chip label="Season complete" size="small" variant="outlined" />
      )}
    </Stack>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 1.5,
        mt: 1,
      }}
    >
      <Stack spacing={0.25}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Milestones
        </Typography>
        {(legacy.milestones.length
          ? legacy.milestones
          : ['Season results added to the dynasty chronicle.']
        ).map(milestone => (
          <Typography key={milestone} variant="body2">
            {milestone}
          </Typography>
        ))}
      </Stack>
      <Stack spacing={0.25}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Signature Games
        </Typography>
        {legacy.signatureGames.map(game => (
          <Link
            key={game.id}
            component={RouterLink}
            to={`/game/${game.id}`}
            variant="body2"
            underline="hover"
          >
            {game.label}
          </Link>
        ))}
      </Stack>
    </Box>
  </Paper>
);
