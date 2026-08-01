import { Link as MuiLink } from '@mui/material';

type TeamLinkProps = {
  name: string;
  onTeamClick: (name: string) => void;
};

export const TeamLink = ({ name, onTeamClick }: TeamLinkProps) => (
  <MuiLink
    component="button"
    type="button"
    onClick={() => onTeamClick(name)}
    sx={{ cursor: 'pointer', textAlign: 'left' }}
  >
    {name}
  </MuiLink>
);
