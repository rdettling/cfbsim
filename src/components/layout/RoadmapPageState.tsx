import { Box, Paper, Typography } from '@mui/material';

type RoadmapPageStateProps = {
  title: string;
  seasonLabel: string;
  description: string;
};

const RoadmapPageState = ({ title, seasonLabel, description }: RoadmapPageStateProps) => (
  <>
    <Box component="header" sx={{ mb: 1.5 }}>
      <Typography component="h1" variant="h4">
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {seasonLabel}
      </Typography>
    </Box>
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, textAlign: 'center' }}>
      <Typography component="h2" variant="h6">
        Planned analysis
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 680, mx: 'auto' }}>
        {description}
      </Typography>
    </Paper>
  </>
);

export default RoadmapPageState;
