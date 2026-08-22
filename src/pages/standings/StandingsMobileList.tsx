import { Box, Paper, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { StandingsViewProps } from './types';

const mobileGridColumns = (isIndependent: boolean) =>
  isIndependent
    ? '28px 32px minmax(0, 1fr) 52px'
    : '28px 32px minmax(0, 1fr) 52px 52px';

export const StandingsMobileList = ({ teams, isIndependent, onTeamClick }: StandingsViewProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label="Conference standings"
    sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
  >
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: mobileGridColumns(isIndependent),
        columnGap: 1,
        alignItems: 'center',
        px: 1.5,
        py: 0.75,
        bgcolor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        Rank
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', gridColumn: '2 / 4' }}
      >
        Team
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        Overall
      </Typography>
      {!isIndependent && (
        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Conf
        </Typography>
      )}
    </Box>

    {teams.map((team, index) => (
      <Box
        key={team.name}
        sx={{
          display: 'grid',
          gridTemplateColumns: mobileGridColumns(isIndependent),
          columnGap: 1,
          alignItems: 'center',
          minHeight: 52,
          px: 1.5,
          py: 1,
          borderBottom: index === teams.length - 1 ? 0 : '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="body1"
          aria-label={`Conference rank ${index + 1}`}
          sx={{ fontWeight: 600, textAlign: 'center' }}
        >
          {index + 1}
        </Typography>
        <TeamLogo name={team.name} size={32} />
        <Box
          sx={{
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            '& button': {
              display: 'block',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          }}
        >
          <TeamLink name={team.name} onTeamClick={onTeamClick} />
        </Box>
        <Typography
          variant="body2"
          aria-label={`Overall record ${team.totalWins}-${team.totalLosses}`}
          sx={{ fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap' }}
        >
          {team.totalWins}-{team.totalLosses}
        </Typography>
        {!isIndependent && (
          <Typography
            variant="body2"
            aria-label={`Conference record ${team.confWins}-${team.confLosses}`}
            sx={{ fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap' }}
          >
            {team.confWins}-{team.confLosses}
          </Typography>
        )}
      </Box>
    ))}
  </Paper>
);
