import { Box, Link as MuiLink } from '@mui/material';

interface TeamLinkProps {
    name: string;
    onTeamClick: (name: string) => void;
}

interface TeamLogoProps {
    name: string;
    size?: number;
}

export const TeamLink = ({ name, onTeamClick }: TeamLinkProps) => (
    <MuiLink
        component="button"
        onClick={() => onTeamClick(name)}
        sx={{ cursor: 'pointer' }}
    >
        {name}
    </MuiLink>
);

export const TeamLogo = ({ name, size = 30 }: TeamLogoProps) => (
    <Box 
        component="img" 
        src={`/logos/teams/${name}.png`} 
        sx={{ width: size, height: size }} 
    />
);
