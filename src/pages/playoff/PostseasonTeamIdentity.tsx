import { Box, Button, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { TeamAction } from './types';

type PostseasonTeamIdentityProps = {
  name: string;
  secondary?: string;
  logoSize?: number;
  onTeamClick: TeamAction;
};

export const PostseasonTeamIdentity = ({
  name,
  secondary,
  logoSize = 28,
  onTeamClick,
}: PostseasonTeamIdentityProps) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
    <TeamLogo name={name} size={logoSize} />
    <Box sx={{ minWidth: 0 }}>
      <Button
        size="small"
        onClick={() => onTeamClick(name)}
        sx={{
          minWidth: 0,
          p: 0,
          color: 'text.primary',
          fontWeight: 600,
          justifyContent: 'flex-start',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </Button>
      {secondary && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}
        >
          {secondary}
        </Typography>
      )}
    </Box>
  </Stack>
);
