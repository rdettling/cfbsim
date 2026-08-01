import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { Info, PlayoffTeamCount } from '../../types/domain';
import type { AlignmentMode, CreationProgress } from './types';
import { getCreateActionLabel } from './types';

export const NewLeagueSummary = ({
  selectedYear,
  selectedTeam,
  alignmentMode,
  playoffTeams,
  playoffAutobids,
  topSeeds,
  ready,
  progress,
  creationError,
  savedLeagueInfo,
  showCreate = true,
  onCreate,
}: {
  selectedYear: string;
  selectedTeam: string | null;
  alignmentMode: AlignmentMode;
  playoffTeams: PlayoffTeamCount;
  playoffAutobids: number;
  topSeeds: boolean;
  ready: boolean;
  progress: CreationProgress;
  creationError: string | null;
  savedLeagueInfo: Info | null;
  showCreate?: boolean;
  onCreate: () => void;
}) => {
  const busy = progress !== 'idle';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ minHeight: 0, overflowY: 'auto' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Dynasty summary
        </Typography>
        <Typography variant="h5">{selectedYear || '—'} Season</Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Program
        </Typography>
        {selectedTeam ? (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mt: 0.75 }}>
            <TeamLogo name={selectedTeam} size={42} />
            <Typography sx={{ fontWeight: 600 }}>{selectedTeam}</Typography>
          </Stack>
        ) : (
          <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Not selected</Typography>
        )}
        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Alignment
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>
          {alignmentMode === 'historical' ? 'Era-accurate' : 'Custom'}
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Postseason
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>{playoffTeams}-team playoff</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {playoffTeams === 12
            ? `${playoffAutobids} autobids${topSeeds ? ' · champion top seeds' : ''}`
            : 'At-large selection'}
        </Typography>
        {creationError && (
          <Alert severity="error" sx={{ mt: 2 }}>{creationError}</Alert>
        )}
      </Box>
      {showCreate && (
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={!ready || busy}
            onClick={onCreate}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {getCreateActionLabel(progress)}
          </Button>
          {savedLeagueInfo && (
            <Typography
              variant="caption"
              sx={{ display: 'block', color: 'text.secondary', mt: 0.75, textAlign: 'center' }}
            >
              Replaces the saved {savedLeagueInfo.currentYear} {savedLeagueInfo.team} dynasty.
            </Typography>
          )}
          {!ready && !savedLeagueInfo && (
            <Typography
              variant="caption"
              sx={{ display: 'block', color: 'text.secondary', mt: 0.75, textAlign: 'center' }}
            >
              Choose a program and resolve alignment issues to create.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
