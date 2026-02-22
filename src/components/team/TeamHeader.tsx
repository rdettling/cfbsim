import { Box, Paper, Stack, Typography, Select, MenuItem, Chip } from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';
import type { TeamHeaderProps } from '../../types/components';
import { TeamLogo, ConfLogo } from './TeamComponents';

const TeamHeader = ({ team, teams, onTeamChange }: TeamHeaderProps) => {
  const conferenceName = team.confName ?? team.conference;
  const maxPrestige = 7;
  const prestige = Math.min(Math.max(team.prestige, 1), maxPrestige);
  const metaPillSx = {
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 20,
    px: 1.25,
    py: 0.5,
    height: 30,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
    backgroundColor: 'background.paper',
  };

  return (
    <Paper
      elevation={1}
      sx={{
        mb: 2,
        px: { xs: 2, md: 2.5 },
        py: { xs: 1.25, md: 1.5 },
        borderRadius: 2,
        borderLeft: '4px solid',
        borderLeftColor: team.colorPrimary || 'primary.main',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1.25, md: 1.75 }} alignItems={{ xs: 'flex-start', md: 'center' }}>
        <TeamLogo name={team.name} size={56} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: '1.75rem', md: '2.2rem' }, lineHeight: 1.08 }}>
            {team.ranking > 0 && `#${team.ranking} `}{team.name} {team.mascot}
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.35 }}>
            <Typography variant="body1" color="text.secondary">
              Record: <strong>{team.record}</strong>
            </Typography>
            {conferenceName ? (
              conferenceName === 'Independent' ? (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 1,
                    height: 24,
                    borderRadius: 12,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'lowercase', lineHeight: 1 }}>
                    independent
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 50,
                    height: 30,
                    flexShrink: 0,
                  }}
                >
                  <ConfLogo name={conferenceName} size={27} />
                </Box>
              )
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8, flexWrap: 'wrap', rowGap: 0.6 }}>
            <Chip label={`Rating ${team.rating}`} size="small" variant="outlined" sx={{ height: 30 }} />
            <Box sx={{ ...metaPillSx, px: 1, gap: 0.1 }}>
              {Array.from({ length: maxPrestige }, (_, index) =>
                index < prestige ? (
                  <Star key={`prestige-full-${index}`} sx={{ fontSize: 16, color: '#f6c343' }} />
                ) : (
                  <StarBorder key={`prestige-empty-${index}`} sx={{ fontSize: 16, color: '#d3d3d3' }} />
                )
              )}
            </Box>
          </Stack>
        </Box>
        <Box sx={{ width: { xs: '100%', md: 208 }, alignSelf: { xs: 'stretch', md: 'center' } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Select Team
          </Typography>
          <Select
            fullWidth
            value={team.name}
            onChange={(event) => onTeamChange(event.target.value as string)}
            size="small"
          >
            {teams.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Stack>
    </Paper>
  );
};

export default TeamHeader;
