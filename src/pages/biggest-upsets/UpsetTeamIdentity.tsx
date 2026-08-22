import { Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { BiggestUpsetTeam } from '../../domain/league/loaders/biggestUpsets';

export const UpsetTeamIdentity = ({
  team,
  onTeamClick,
}: {
  team: BiggestUpsetTeam;
  onTeamClick: (name: string) => void;
}) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
    <TeamLogo name={team.name} size={28} />
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'baseline', minWidth: 0 }}>
      {team.rank > 0 && team.rank <= 25 && (
        <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
          #{team.rank}
        </Typography>
      )}
      <TeamLink name={team.name} onTeamClick={onTeamClick} />
    </Stack>
  </Stack>
);
