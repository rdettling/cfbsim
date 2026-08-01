import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { TeamLogo } from '../../../components/team/TeamLogo';
import type { PreviewData } from '../../../types/domain';
import { StepActions } from './StepActions';

const conferenceName = (value: string | null) => value ?? 'Independent';

export const ProgramStep = ({
  preview,
  selectedTeam,
  search,
  onSearchChange,
  onSelect,
  onBack,
  onContinue,
}: {
  preview: PreviewData;
  selectedTeam: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) => {
  const normalized = search.trim().toLocaleLowerCase();
  const teams = preview.teams.filter(team =>
    `${team.name} ${team.mascot}`.toLocaleLowerCase().includes(normalized),
  );
  return (
    <Box>
      <Typography variant="h4">Choose your program</Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>
        Your program will stay highlighted while you organize conferences.
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Search programs"
        value={search}
        onChange={event => onSearchChange(event.target.value)}
        sx={{ mt: 2 }}
      />
      <Box sx={{ maxHeight: 460, overflowY: 'auto', mt: 1.5 }}>
        <Stack spacing={0.75}>
          {teams.map(team => (
            <Button
              key={team.name}
              variant={selectedTeam === team.name ? 'contained' : 'outlined'}
              onClick={() => onSelect(team.name)}
              sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 1.25 }}
            >
              <TeamLogo name={team.name} size={34} />
              <Box sx={{ ml: 1.25 }}>
                <Typography sx={{ fontWeight: 600 }}>{team.name} {team.mascot}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {conferenceName(team.conferenceName)} · Prestige {team.prestige}
                </Typography>
              </Box>
            </Button>
          ))}
        </Stack>
      </Box>
      <StepActions
        back={onBack}
        next={onContinue}
        disabled={!selectedTeam}
      />
    </Box>
  );
};
