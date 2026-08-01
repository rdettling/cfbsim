import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamComponents';
import type { PendingRivalry, TeamSelectionHandler } from './types';
import type { RivalryPlanWarning } from '../../types/domain';

type PendingRivalriesPanelProps = {
  rivalries: PendingRivalry[];
  warnings: RivalryPlanWarning[];
  onTeamClick: TeamSelectionHandler;
  onRemove: (rivalry: PendingRivalry) => void;
  removalBusy: boolean;
};

export const PendingRivalriesPanel = ({
  rivalries,
  warnings,
  onTeamClick,
  onRemove,
  removalBusy,
}: PendingRivalriesPanelProps) => (
  <Paper
    component="aside"
    aria-label="Pending Rivalries"
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
    }}
  >
    <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography component="h2" variant="h6">
        Pending Rivalries
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        Guaranteed flexible rivalries receive a week when the full schedule is generated
      </Typography>
    </Box>

    <Stack sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {warnings.map(warning => (
        <Box
          key={`${warning.teamA}-${warning.teamB}`}
          sx={{ p: 1.5, bgcolor: 'warning.main', color: 'warning.contrastText' }}
        >
          <Typography variant="subtitle2">Rivalry not guaranteed</Typography>
          <Typography variant="body2">{warning.message}</Typography>
        </Box>
      ))}
      {rivalries.length === 0 ? (
        <Box sx={{ p: 2.5, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            No pending rivalries
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Accepted fixed-week rivalries are already shown in the schedule. Any omissions appear above.
          </Typography>
        </Box>
      ) : (
        rivalries.map((rivalry) => (
          <Box
            component="article"
            key={rivalry.id}
            sx={{
              p: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
              <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }}>
                {rivalry.name ?? 'Rivalry Game'}
              </Typography>
              <Tooltip title="Remove pending rivalry">
                <span>
                  <IconButton
                    size="small"
                    disabled={removalBusy}
                    aria-label={`Remove ${rivalry.teamA}–${rivalry.teamB} rivalry`}
                    onClick={() => onRemove(rivalry)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <Stack
              direction="row"
              spacing={0.5}
              useFlexGap
              sx={{
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <TeamLink name={rivalry.teamA} onTeamClick={onTeamClick} />
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                vs.
              </Typography>
              <TeamLink name={rivalry.teamB} onTeamClick={onTeamClick} />
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                mt: 0.5,
              }}
            >
              {rivalry.homeTeam && rivalry.awayTeam
                ? `${rivalry.homeTeam} hosts ${rivalry.awayTeam}`
                : rivalry.neutralSite
                  ? rivalry.venue ?? 'Neutral site; week to be determined'
                : 'Week and site to be determined'}
            </Typography>
          </Box>
        ))
      )}
    </Stack>
  </Paper>
);
