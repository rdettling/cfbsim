import { Box, Link as MuiLink } from '@mui/material';
import { useState } from 'react';

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

export const TeamLogo = ({ name, size = 30 }: TeamLogoProps) => {
    // Check if we're in production (using the same logic as your api.ts)
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    // Use different base paths depending on environment
    const basePath = isProduction ? '/static' : '';
    const logoPath = `${basePath}/logos/teams/${name}.png`;
    
    // For debugging
    const [hasError, setHasError] = useState(false);
    
    return (
        <Box
            component="img"
            src={logoPath}
            onError={(_) => {
                console.error(`Failed to load logo for ${name} from ${logoPath}`);
                setHasError(true);
                // You could set a fallback image here
            }}
            sx={{ 
                width: size, 
                height: size,
                border: hasError ? '1px dashed red' : 'none' // Visual indicator for debugging
            }}
            alt={`${name} logo`}
        />
    );
};
