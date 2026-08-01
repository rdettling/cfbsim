import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLogo } from '../../components/team/TeamLogo';
import { ROUTES } from '../../constants/routes';
import { getStageDefinition, getStageRoute } from '../../constants/stages';
import type { Info, LeagueStage } from '../../types/domain';
import type { HomeData, HomeProgramSummary } from '../../types/league';

type DynastyLauncherProps = {
  data: HomeData;
};

export const getHomeStatusLabel = (
  currentYear: number,
  stage: LeagueStage,
  currentWeek: number,
) => {
  const progress = stage === 'season'
    ? `Week ${currentWeek}`
    : getStageDefinition(stage).label;

  return `${currentYear} Season · ${progress}`;
};

export const formatHomeRank = (ranking: number) =>
  ranking > 0 ? `#${ranking}` : 'Unranked';

const SETUP_POINTS = [
  ['Choose an era', 'Any supported season'],
  ['Lead a program', 'Take over the team you want'],
  ['Configure the league', 'Historical defaults or custom rules'],
] as const;

const LauncherShell = ({
  accent,
  children,
}: {
  accent?: string;
  children: React.ReactNode;
}) => (
  <Paper
    variant="outlined"
    sx={{
      gridArea: 'launcher',
      minHeight: { md: 360 },
      p: { xs: 2, sm: 3 },
      display: 'flex',
      flexDirection: 'column',
      borderLeftWidth: 4,
      borderLeftColor: accent || 'primary.main',
    }}
  >
    {children}
  </Paper>
);

const CreateLauncher = () => (
  <LauncherShell>
    <Typography variant="overline" sx={{ color: 'text.secondary' }}>
      Your dynasty
    </Typography>
    <Typography
      component="h2"
      variant="h4"
      sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' }, mt: 0.5 }}
    >
      Start your dynasty
    </Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
      Choose the season and program you want, then decide how the league and
      postseason should work.
    </Typography>
    <Stack spacing={0.75} sx={{ my: { xs: 1.25, sm: 2.5 } }}>
      {SETUP_POINTS.map(([title, description]) => (
        <Box
          key={title}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(110px, auto) minmax(0, 1fr)',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {description}
          </Typography>
        </Box>
      ))}
    </Stack>
    <Button
      component={RouterLink}
      to={ROUTES.NEW_LEAGUE}
      variant="contained"
      size="large"
      startIcon={<AddIcon />}
      sx={{ mt: 'auto', alignSelf: 'flex-start' }}
    >
      Create your dynasty
    </Button>
  </LauncherShell>
);

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <Box>
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {label}
    </Typography>
    <Typography variant="h6" sx={{ mt: 0.15 }}>
      {value}
    </Typography>
  </Box>
);

const CurrentDynastyLauncher = ({
  info,
  program,
  statusLabel,
  rankLabel,
}: {
  info: Info;
  program: HomeProgramSummary;
  statusLabel: string;
  rankLabel: string;
}) => (
  <LauncherShell accent={program.colorPrimary}>
    <Typography variant="overline" sx={{ color: 'text.secondary' }}>
      Your dynasty
    </Typography>
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.75 }}>
      <Box sx={{ flexShrink: 0 }}>
        <TeamLogo name={program.name} size={48} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h2"
          variant="h4"
          sx={{
            fontSize: { xs: '1.5rem', sm: '2.125rem' },
            wordBreak: 'break-word',
          }}
        >
          {program.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {program.conference}
        </Typography>
      </Box>
    </Stack>
    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
      {statusLabel}
    </Typography>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 2,
        my: { xs: 1.25, sm: 2 },
      }}
    >
      <Metric label="Record" value={program.record} />
      <Metric label="National rank" value={rankLabel} />
      <Metric label="Team rating" value={program.rating} />
    </Box>
    <Button
      component={RouterLink}
      to={getStageRoute(info.stage)}
      variant="contained"
      size="large"
      endIcon={<ArrowForwardIcon />}
      sx={{ alignSelf: 'flex-start' }}
    >
      Continue dynasty
    </Button>
    <Box sx={{ mt: 'auto', pt: { xs: 1.25, sm: 2 } }}>
      <Divider />
      <Box
        sx={{
          pt: { xs: 1, sm: 1.5 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: 'row',
          gap: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Starting over replaces your save.
        </Typography>
        <Button
          component={RouterLink}
          to={ROUTES.NEW_LEAGUE}
          size="small"
          endIcon={<ArrowForwardIcon />}
          sx={{ flexShrink: 0 }}
        >
          Start new
        </Button>
      </Box>
    </Box>
  </LauncherShell>
);

export const DynastyLauncher = ({ data }: DynastyLauncherProps) => {
  if (data.info === null) {
    return <CreateLauncher />;
  }

  return (
    <CurrentDynastyLauncher
      info={data.info}
      program={data.program}
      statusLabel={getHomeStatusLabel(
        data.info.currentYear,
        data.info.stage,
        data.info.currentWeek,
      )}
      rankLabel={formatHomeRank(data.program.ranking)}
    />
  );
};
