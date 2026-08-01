import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { CustomConferencePlan, PlayoffTeamCount, PreviewData, RivalryPlanWarning } from '../../../types/domain';
import type { LaunchProps } from '../../../types/league';
import type { NewLeagueAlignmentMode } from '../newLeagueDraft';
import { StepActions } from './StepActions';

type AlignmentMode = NewLeagueAlignmentMode;
const conferenceName = (value: string | null) => value ?? 'Independent';

export const ReviewStep = ({
  preview,
  info,
  selectedYear,
  selectedTeam,
  alignmentMode,
  plan,
  resolvedGames,
  rivalryWarnings,
  playoffTeams,
  playoffAutobids,
  topSeeds,
  creating,
  error,
  onBack,
  onCreate,
}: {
  preview: PreviewData;
  info: LaunchProps['info'];
  selectedYear: string;
  selectedTeam: string | null;
  alignmentMode: AlignmentMode;
  plan: CustomConferencePlan;
  resolvedGames: Record<string, number>;
  rivalryWarnings: RivalryPlanWarning[];
  playoffTeams: PlayoffTeamCount;
  playoffAutobids: number;
  topSeeds: boolean;
  creating: boolean;
  error: string | null;
  onBack: () => void;
  onCreate: () => void;
}) => {
  const changes = preview.teams.filter(team =>
    conferenceName(team.conferenceName) !==
    conferenceName(plan.assignments[team.name] ?? null),
  );
  const memberships = preview.conferences
    .map(conference => ({
      name: conference.name,
      teams: preview.teams
        .filter(team => plan.assignments[team.name] === conference.name)
        .map(team => team.name),
      games: resolvedGames[conference.name],
    }))
    .filter(conference => conference.teams.length);
  const independents = preview.teams
    .filter(team => (plan.assignments[team.name] ?? null) === null)
    .map(team => team.name);
  return (
    <Box sx={{ maxWidth: 840, mx: 'auto' }}>
      <Typography variant="h4">Review your league</Typography>
      {info && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Creating this league replaces the saved {info.currentYear} {info.team} league.
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 1.5,
          mt: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="overline">Starting world</Typography>
          <Typography variant="h6">{selectedYear} Season</Typography>
          <Typography>{selectedTeam}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="overline">Postseason</Typography>
          <Typography variant="h6">{playoffTeams}-team playoff</Typography>
          <Typography>
            {playoffTeams === 12
              ? `${playoffAutobids} autobids${topSeeds ? ' · champion top seeds' : ''}`
              : 'At-large selection'}
          </Typography>
        </Paper>
      </Box>
      <Paper variant="outlined" sx={{ p: 2, mt: 1.5 }}>
        <Typography variant="overline">Conference structure</Typography>
        <Typography variant="h6">
          {alignmentMode === 'historical' ? 'Era-accurate alignment' : 'Custom alignment'}
        </Typography>
        {alignmentMode === 'custom' && (
          changes.length ? (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {changes.map(team => (
                <Typography key={team.name} variant="body2">
                  {team.name}: {conferenceName(team.conferenceName)} →{' '}
                  {conferenceName(plan.assignments[team.name] ?? null)}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ mt: 0.5 }}>No team movements.</Typography>
          )
        )}
      </Paper>
      {rivalryWarnings.length > 0 && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {rivalryWarnings.map(warning => (
            <Typography key={`${warning.teamA}-${warning.teamB}`} variant="body2">
              {warning.message}
            </Typography>
          ))}
        </Alert>
      )}
      {alignmentMode === 'custom' && (
        <Accordion variant="outlined" sx={{ mt: 1.5 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Full conference membership</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              {memberships.map(conference => (
                <Box key={conference.name}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {conference.name} · {conference.games} conference games
                  </Typography>
                  <Typography variant="body2">{conference.teams.join(', ')}</Typography>
                </Box>
              ))}
              {independents.length > 0 && (
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>Independent</Typography>
                  <Typography variant="body2">{independents.join(', ')}</Typography>
                </Box>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {creating && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <CircularProgress size={16} sx={{ mr: 1 }} />
          Building rosters and preseason scheduling…
        </Alert>
      )}
      <StepActions
        back={creating ? undefined : onBack}
        next={onCreate}
        nextLabel={creating ? 'Creating…' : 'Create league'}
        disabled={creating || !selectedTeam}
      />
    </Box>
  );
};
