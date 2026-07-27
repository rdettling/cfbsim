import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Ref } from 'react';
import type { PreviewData } from '../../types/domain';
import { ConfLogo, TeamLogo } from '../../components/team/TeamComponents';

type PreviewTeam = PreviewData['teams'][number];

type HomeTeamBrowserProps = {
  preview: PreviewData;
  selectedConference: string;
  search: string;
  creatingTeam: string | null;
  creationError: string | null;
  headingRef?: Ref<HTMLHeadingElement>;
  errorRef?: Ref<HTMLDivElement>;
  onConferenceChange: (conference: string) => void;
  onSearchChange: (search: string) => void;
  onStart: (team: PreviewTeam) => void;
  onRetry: () => void;
  onBack: () => void;
};

const RatingDots = ({ label, value }: { label: string; value: number }) => (
  <Box
    aria-label={`${label} ${value} of 7`}
    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}
  >
    <Typography
      variant="caption"
      sx={{
        color: 'text.secondary',
      }}
    >
      {label}
    </Typography>
    <Box aria-hidden sx={{ display: 'flex', gap: 0.25 }}>
      {Array.from({ length: 7 }, (_, index) => (
        <Box
          key={index}
          sx={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            bgcolor: index < value ? 'primary.main' : 'divider',
          }}
        />
      ))}
    </Box>
  </Box>
);

const TeamRow = ({
  team,
  creating,
  creationLocked,
  onStart,
}: {
  team: PreviewTeam;
  creating: boolean;
  creationLocked: boolean;
  onStart: (team: PreviewTeam) => void;
}) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: '44px minmax(0, 1fr) auto',
      gap: 1.25,
      alignItems: 'center',
      p: 1.25,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      bgcolor: 'background.paper',
    }}
  >
    <TeamLogo name={team.name} size={42} />
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          alignItems: 'center',
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {team.name} {team.mascot}
        </Typography>
        {team.conferenceName && <ConfLogo name={team.conferenceName} size={18} />}
      </Stack>
      <Stack
        direction="row"
        spacing={{ xs: 1, sm: 1.5 }}
        useFlexGap
        sx={{
          flexWrap: 'wrap',
          mt: 0.25,
        }}
      >
        <RatingDots label="Current" value={team.prestige} />
        <RatingDots label="Ceiling" value={team.ceiling} />
        <RatingDots label="Floor" value={team.floor} />
      </Stack>
    </Box>
    <Button
      variant="contained"
      size="small"
      disabled={creationLocked}
      onClick={() => onStart(team)}
      sx={{
        justifySelf: 'end',
      }}
    >
      {creating ? (
        <>
          <CircularProgress size={16} color="inherit" sx={{ mr: 0.75 }} />
          Creating…
        </>
      ) : (
        'Start'
      )}
    </Button>
  </Box>
);

export const HomeTeamBrowser = ({
  preview,
  selectedConference,
  search,
  creatingTeam,
  creationError,
  headingRef,
  errorRef,
  onConferenceChange,
  onSearchChange,
  onStart,
  onRetry,
  onBack,
}: HomeTeamBrowserProps) => {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredTeams = preview.teams.filter((team) => {
    const matchesConference =
      selectedConference === 'ALL' ||
      (selectedConference === 'INDEPENDENTS'
        ? team.conferenceName === null
        : team.conferenceName === selectedConference);
    const matchesSearch =
      !normalizedSearch ||
      `${team.name} ${team.mascot}`.toLocaleLowerCase().includes(normalizedSearch);
    return matchesConference && matchesSearch;
  });

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          disabled={Boolean(creatingTeam)}
          sx={{ display: { xs: 'inline-flex', lg: 'none' }, mb: 0.75 }}
        >
          League setup
        </Button>
        <Typography
          variant="overline"
          sx={{
            color: 'text.secondary',
          }}
        >
          Step 2
        </Typography>
        <Typography ref={headingRef} tabIndex={-1} variant="h5">
          Choose your team
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <TextField
            label="Search teams"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            size="small"
            fullWidth
            disabled={Boolean(creatingTeam)}
          />
          <FormControl size="small" fullWidth disabled={Boolean(creatingTeam)}>
            <InputLabel id="home-conference-filter-label">Conference</InputLabel>
            <Select
              labelId="home-conference-filter-label"
              value={selectedConference}
              label="Conference"
              onChange={(event) => onConferenceChange(event.target.value)}
            >
              <MenuItem value="ALL">All conferences</MenuItem>
              {preview.conferences.map((conference) => (
                <MenuItem key={conference.name} value={conference.name}>
                  {conference.fullName}
                </MenuItem>
              ))}
              <MenuItem value="INDEPENDENTS">Independents</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>
      {creationError && (
        <Alert
          ref={errorRef}
          tabIndex={-1}
          severity="error"
          aria-live="assertive"
          action={
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          }
          sx={{ borderRadius: 0 }}
        >
          {creationError}
        </Alert>
      )}
      {creatingTeam && (
        <Alert severity="info" aria-live="polite" sx={{ borderRadius: 0 }}>
          Building rosters and the preseason schedule for {creatingTeam}…
        </Alert>
      )}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          p: 1,
        }}
      >
        {filteredTeams.length ? (
          <Stack spacing={0.75}>
            {filteredTeams.map((team) => (
              <TeamRow
                key={team.name}
                team={team}
                creating={creatingTeam === team.name}
                creationLocked={Boolean(creatingTeam)}
                onStart={onStart}
              />
            ))}
          </Stack>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6">No teams found</Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              Change the search or conference filter.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};
