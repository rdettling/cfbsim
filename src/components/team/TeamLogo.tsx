import { Box } from '@mui/material';
import { useState } from 'react';

type LogoProps = {
  name: string;
  size?: number;
};

type LogoKind = 'teams' | 'conferences';

const getBasePath = () => {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const Logo = ({
  type,
  name,
  size = 30,
}: LogoProps & { type: LogoKind }) => {
  const [hasError, setHasError] = useState(false);
  const logoPath = `${getBasePath()}/logos/${type}/${name}.png`;

  return (
    <Box
      component="img"
      src={logoPath}
      onError={() => {
        console.error(`Failed to load ${type} logo for ${name} from ${logoPath}`);
        setHasError(true);
      }}
      sx={{
        width: 'auto',
        height: size,
        maxWidth: size * 2,
        border: hasError ? '1px dashed' : 'none',
        borderColor: hasError ? 'error.main' : 'transparent',
      }}
      alt={`${name} logo`}
    />
  );
};

export const TeamLogo = (props: LogoProps) => <Logo type="teams" {...props} />;

export const ConferenceLogo = (props: LogoProps) => (
  <Logo type="conferences" {...props} />
);
