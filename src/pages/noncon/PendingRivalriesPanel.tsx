import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { RivalryPlanWarning } from '../../types/domain';
import type { PendingRivalry, TeamSelectionHandler } from './types';

type PendingRivalriesPanelProps = {
  userTeam: string;
  rivalries: PendingRivalry[];
  warnings: RivalryPlanWarning[];
  onTeamClick: TeamSelectionHandler;
  onRemove: (rivalry: PendingRivalry) => void;
  removingItemKey: string | null;
};

const rivalrySiteLabel = (rivalry: PendingRivalry, userTeam: string) => {
  if (rivalry.neutralSite) {
    return rivalry.venue ? `Neutral · ${rivalry.venue}` : 'Neutral site';
  }
  if (rivalry.homeTeam === userTeam) return 'Home';
  if (rivalry.awayTeam === userTeam) return 'Away';
  return 'Site to be determined';
};

export const PendingRivalriesPanel = ({
  userTeam,
  rivalries,
  warnings,
  onTeamClick,
  onRemove,
  removingItemKey,
}: PendingRivalriesPanelProps) => (
  <Paper
    component="aside"
    aria-label="Pending Rivalries"
    variant="outlined"
    sx={{ display: 'flex', flexDirection: 'column', height: { lg: '100%' }, minHeight: 0, overflow: 'hidden' }}
  >
    <>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 38,
          px: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography component="h2" variant="subtitle2">Pending rivalries</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{rivalries.length}</Typography>
      </Stack>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', px: 1.25, py: 0.625, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        Automatically placed when the season starts unless declined.
      </Typography>

      <Stack sx={{ flex: 1, minHeight: 0, overflowY: { xs: 'visible', lg: 'auto' } }}>
        {warnings.map(warning => (
          <Alert key={`${warning.teamA}-${warning.teamB}`} severity="warning" variant="outlined" sx={{ m: 1, mb: 0 }}>
            <Typography variant="caption">{warning.message}</Typography>
          </Alert>
        ))}
        {rivalries.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>No pending rivalries</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Fixed-week rivalries already appear in the schedule.
            </Typography>
          </Box>
        ) : rivalries.map(rivalry => {
          const opponent = rivalry.teamA === userTeam ? rivalry.teamB : rivalry.teamA;
          const removing = removingItemKey === `rivalry:${rivalry.id}`;
          return (
            <Box
              component="article"
              key={rivalry.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: '56px minmax(0, 1fr) auto',
                columnGap: 1,
                alignItems: 'center',
                px: 1.5,
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <Box sx={{ width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TeamLogo name={opponent} size={28} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <TeamLink name={opponent} onTeamClick={onTeamClick} />
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {rivalry.name ?? 'Rivalry game'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.125 }}>
                  Week TBD · {rivalrySiteLabel(rivalry, userTeam)}
                </Typography>
              </Box>
              <Button
                variant="text"
                color="error"
                size="small"
                disabled={removingItemKey !== null}
                onClick={() => onRemove(rivalry)}
              >
                {removing ? 'Declining…' : 'Decline'}
              </Button>
            </Box>
          );
        })}
      </Stack>
    </>
  </Paper>
);
