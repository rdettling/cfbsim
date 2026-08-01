import { Box, Paper, Typography } from '@mui/material';

const CAPABILITIES = [
  {
    title: 'Run the program',
    description: 'Set schedules, play or simulate games, and chase rankings and championships.',
  },
  {
    title: 'Build the roster',
    description: 'Develop players, recruit the next class, and make the final roster decisions.',
  },
  {
    title: 'Shape the sport',
    description: 'Control conference alignment, postseason rules, and a history that carries forward.',
  },
] as const;

export const HomeOverview = () => (
  <Box
    sx={{
      gridArea: 'overview',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      px: { xs: 1, sm: 2, md: 3.5 },
      py: { xs: 1, sm: 2.5, md: 3.5 },
    }}
  >
    <Typography variant="overline" sx={{ color: 'primary.main' }}>
      College football dynasty simulator
    </Typography>
    <Typography
      component="h2"
      variant="h2"
      sx={{
        fontSize: { xs: '1.6rem', sm: '2.6rem', md: '3rem' },
        lineHeight: 1.08,
        maxWidth: 620,
        mt: 0.75,
      }}
    >
      Build a program. Shape the sport. Rewrite history.
    </Typography>
    <Typography
      variant="body2"
      sx={{
        color: 'text.secondary',
        maxWidth: 650,
        mt: { xs: 0.75, sm: 1.5 },
      }}
    >
      Choose an era, take control of a program, and guide it through games,
      postseason races, recruiting, realignment, and the seasons that follow.
    </Typography>
  </Box>
);

export const HomeCapabilities = () => (
  <Paper
    component="section"
    variant="outlined"
    aria-labelledby="home-capabilities-heading"
    sx={{
      p: { xs: 1.5, sm: 2.5 },
      display: 'grid',
      gridTemplateColumns: {
        xs: 'minmax(0, 1fr)',
        sm: 'repeat(3, minmax(0, 1fr))',
      },
      gap: { xs: 0.75, sm: 3 },
    }}
  >
    <Typography
      id="home-capabilities-heading"
      variant="overline"
      sx={{ color: 'text.secondary', gridColumn: '1 / -1', mb: { xs: 0, sm: -1 } }}
    >
      What you control
    </Typography>
    {CAPABILITIES.map(capability => (
      <Box
        key={capability.title}
        sx={{
          borderTop: '2px solid',
          borderColor: 'divider',
          pt: { xs: 0.75, sm: 1.25 },
          display: { xs: 'grid', sm: 'block' },
          gridTemplateColumns: { xs: '110px minmax(0, 1fr)' },
          gap: { xs: 1.25 },
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem' } }}
        >
          {capability.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: { xs: 0, sm: 0.25 },
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            lineHeight: { xs: 1.35, sm: 1.43 },
          }}
        >
          {capability.description}
        </Typography>
      </Box>
    ))}
  </Paper>
);
