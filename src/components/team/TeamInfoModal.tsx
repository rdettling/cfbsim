import CloseIcon from '@mui/icons-material/Close';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GroupsIcon from '@mui/icons-material/Groups';
import HistoryIcon from '@mui/icons-material/History';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getTeamInfo } from '../../domain/league/loaders/team/getTeamInfo';
import type { Team } from '../../types/domain';
import { TeamLogo } from './TeamLogo';

type TeamInfoModalProps = {
  teamName: string;
  open: boolean;
  onClose: () => void;
};

const StatItem = ({ label, value }: { label: string; value: string | number }) => (
  <Box>
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontWeight: 600 }}>
      {value}
    </Typography>
  </Box>
);

export const TeamInfoModal = ({ teamName, open, onClose }: TeamInfoModalProps) => {
  const [teamInfo, setTeamInfo] = useState<Team | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !teamName) return;

    let active = true;
    setTeamInfo(null);
    setError(null);
    setLoading(true);
    getTeamInfo(teamName)
      .then(team => {
        if (!active) return;
        if (team) setTeamInfo(team);
        else setError('Team information is unavailable.');
      })
      .catch(() => {
        if (active) setError('Team information could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [teamName, open]);

  const actions = teamInfo
    ? [
        { label: 'Schedule', to: `/${teamInfo.name}/schedule`, icon: <EventNoteIcon /> },
        { label: 'Roster', to: `/${teamInfo.name}/roster`, icon: <GroupsIcon /> },
        { label: 'History', to: `/${teamInfo.name}/history`, icon: <HistoryIcon /> },
      ]
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="team-info-dialog-title"
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          variant: 'outlined',
          sx: {
            borderTop: '4px solid',
            borderTopColor: teamInfo?.colorPrimary || 'primary.main',
          },
        },
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        {teamInfo ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <TeamLogo name={teamInfo.name} size={52} />
            <Box sx={{ minWidth: 0 }}>
              <Typography id="team-info-dialog-title" component="span" variant="h5">
                {teamInfo.name} {teamInfo.mascot}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {teamInfo.confName ?? teamInfo.conference}
              </Typography>
            </Box>
            {teamInfo.ranking > 0 && (
              <Chip label={`#${teamInfo.ranking}`} size="small" variant="outlined" />
            )}
          </Stack>
        ) : (
          <Typography id="team-info-dialog-title" component="span" variant="h6">
            Team Information
          </Typography>
        )}
        <IconButton
          aria-label="Close team information"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack spacing={1.5} sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress size={32} />
            <Typography sx={{ color: 'text.secondary' }}>
              Loading team information…
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : teamInfo ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 2,
            }}
          >
            <StatItem label="Rating" value={teamInfo.rating} />
            <StatItem label="Prestige" value={`${teamInfo.prestige}/7`} />
            <StatItem
              label="Overall Record"
              value={`${teamInfo.totalWins}-${teamInfo.totalLosses}`}
            />
            <StatItem
              label="Conference Record"
              value={`${teamInfo.confWins}-${teamInfo.confLosses}`}
            />
          </Box>
        ) : null}
      </DialogContent>
      {teamInfo && (
        <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
          {actions.map(action => (
            <Button
              key={action.label}
              component={RouterLink}
              to={action.to}
              variant="outlined"
              startIcon={action.icon}
              onClick={onClose}
            >
              {action.label}
            </Button>
          ))}
        </DialogActions>
      )}
    </Dialog>
  );
};
