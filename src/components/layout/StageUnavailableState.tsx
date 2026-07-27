import { Button, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getStageDefinition } from '../../constants/stages';
import type { LeagueStage } from '../../types/domain';

interface StageUnavailableStateProps {
  title: string;
  description: string;
  currentStage: LeagueStage;
}

const StageUnavailableState = ({
  title,
  description,
  currentStage,
}: StageUnavailableStateProps) => {
  const currentStageInfo = getStageDefinition(currentStage);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, textAlign: 'center' }}>
      <Typography component="h1" variant="h5">
        {title}
      </Typography>
      <Typography
        sx={{
          color: 'text.secondary',
          mt: 0.75,
        }}
      >
        {description}
      </Typography>
      <Button component={RouterLink} to={currentStageInfo.path} variant="contained" sx={{ mt: 2 }}>
        Return to {currentStageInfo.label}
      </Button>
    </Paper>
  );
};

export default StageUnavailableState;
