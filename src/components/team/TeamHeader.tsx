import { useId, type ReactNode } from 'react';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { Team } from '../../types/domain';
import { ConferenceLogo, TeamLogo } from './TeamLogo';

type TeamHeaderProps = {
  team: Team;
  title: string;
  subtitle?: ReactNode;
  metrics?: Pick<Team, 'record' | 'prestige'> & {
    rating: number | null;
    ranking?: number;
    conference?: string;
  };
  teamSelector?: {
    teams: string[];
    onChange: (name: string) => void;
  };
  controls?: ReactNode;
};

export const TeamHeader = ({
  team,
  title,
  subtitle,
  metrics,
  teamSelector,
  controls,
}: TeamHeaderProps) => {
  const teamSelectLabelId = useId();
  const conferenceName = metrics?.conference ?? team.confName ?? team.conference;
  const displayedMetrics = metrics ?? team;
  const ranking = metrics?.ranking ?? team.ranking;
  const prestige = Math.min(Math.max(displayedMetrics.prestige, 0), 7);
  const hasControls = Boolean(teamSelector || controls);

  return (
    <Paper
      component="header"
      elevation={0}
      variant="outlined"
      sx={{
        mb: 1.5,
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        borderLeft: '3px solid',
        borderLeftColor: team.colorPrimary || 'primary.main',
      }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={{ xs: 1.5, lg: 2 }}
        sx={{
          alignItems: { xs: 'stretch', lg: 'center' },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: 'center',
            minWidth: 0,
            flex: 1,
          }}
        >
          <Box sx={{ flexShrink: 0 }}>
            <TeamLogo name={team.name} size={52} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              variant="h4"
              sx={{
                fontSize: { xs: '1.45rem', sm: '1.7rem' },
                fontWeight: 600,
                lineHeight: 1.15,
              }}
            >
              {ranking > 0 && `#${ranking} `}
              {team.name} {team.mascot}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: 'baseline',
                mt: 0.35,
                flexWrap: 'wrap',
                rowGap: 0.25,
              }}
            >
              <Typography
                component="h2"
                variant="body1"
                sx={{ fontWeight: 600, lineHeight: 1.35 }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {subtitle}
                </Typography>
              )}
            </Stack>
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
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Record{' '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                  {displayedMetrics.record}
                </Box>
              </Typography>
              {displayedMetrics.rating !== null && (
                <Chip
                  label={`Rating ${displayedMetrics.rating}`}
                  size="small"
                  variant="outlined"
                />
              )}
              <Chip label={`Prestige ${prestige}/7`} size="small" variant="outlined" />
              {conferenceName && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: 'center',
                    color: 'text.secondary',
                  }}
                >
                  {conferenceName !== 'Independent' && (
                    <ConferenceLogo name={conferenceName} size={22} />
                  )}
                  <Typography variant="body2">{conferenceName}</Typography>
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>

        {hasControls && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              alignItems: { xs: 'stretch', sm: 'center' },
              flexShrink: 0,
              '& > *': {
                width: { xs: '100%', sm: 'auto' },
              },
            }}
          >
            {teamSelector && (
              <FormControl size="small" sx={{ minWidth: { sm: 220 } }}>
                <InputLabel id={teamSelectLabelId}>Team</InputLabel>
                <Select
                  labelId={teamSelectLabelId}
                  value={team.name}
                  onChange={(event) => teamSelector.onChange(event.target.value as string)}
                  label="Team"
                >
                  {teamSelector.teams.map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {controls}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};
