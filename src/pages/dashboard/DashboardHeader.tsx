import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { getStageDefinition } from '../../constants/stages';
import { ConfLogo, TeamLogo } from '../../components/team/TeamComponents';
import type { DashboardPageData } from '../../types/pages';

type DashboardHeaderProps = {
  data: DashboardPageData;
};

export const DashboardHeader = ({ data }: DashboardHeaderProps) => {
  const { info, team } = data;
  const conferenceName = team.confName ?? team.conference;
  const stage = getStageDefinition(info.stage);
  const seasonContext =
    info.stage === 'season'
      ? `${info.currentYear} season · Week ${info.currentWeek}`
      : `${info.currentYear} season · ${stage?.label ?? info.stage}`;

  return (
    <Paper
      component="header"
      variant="outlined"
      sx={{
        mb: 1.5,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        borderLeft: '3px solid',
        borderLeftColor: team.colorPrimary || 'primary.main',
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'center',
        }}
      >
        <TeamLogo name={team.name} size={52} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h1"
            variant="h4"
            sx={{
              fontSize: { xs: '1.4rem', sm: '1.7rem' },
              lineHeight: 1.15,
            }}
          >
            {team.ranking > 0 && `#${team.ranking} `}
            {team.name} {team.mascot}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 0.35,
            }}
          >
            {seasonContext}
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              alignItems: 'center',
              mt: 0.75,
              flexWrap: 'wrap',
              rowGap: 0.75,
            }}
          >
            <Typography variant="body2">
              Record{' '}
              <Box component="span" sx={{ fontWeight: 600 }}>
                {team.record}
              </Box>
            </Typography>
            <Chip label={`Rating ${team.rating}`} size="small" variant="outlined" />
            {conferenceName && (
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: 'center',
                }}
              >
                {conferenceName !== 'Independent' && <ConfLogo name={conferenceName} size={22} />}
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {conferenceName}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};
