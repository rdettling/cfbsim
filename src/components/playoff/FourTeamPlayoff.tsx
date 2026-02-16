import { Box, Typography, Paper, Divider } from '@mui/material';
import { Matchup, Championship } from './BracketElements';

const FourTeamPlayoff = ({
  playoffTeams,
  bracket,
  onTeamClick,
}: {
  playoffTeams: any[];
  bracket?: any;
  onTeamClick: (name: string) => void;
}) => {
  return (
    <Paper
      sx={{
        p: 4,
        borderRadius: 2.5,
        overflow: 'auto',
        background: 'linear-gradient(180deg, #ffffff 0%, #f7f8fb 100%)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: 'text.secondary' }}>
            College Football Playoff
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            4‑Team Bracket
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Winners advance to the title game
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr auto 1fr' },
          gap: 4,
          alignItems: 'center',
          minWidth: 900,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: 'text.secondary' }}>
            Semifinal
          </Typography>
          <Matchup
            matchup={bracket?.semifinals?.[0] || {
              team1: playoffTeams[0]?.name,
              team2: playoffTeams[3]?.name,
              seed1: 1,
              seed2: 4,
            }}
            direction="left"
            onTeamClick={onTeamClick}
          />
        </Box>

        <Championship
          championship={bracket?.championship || { team1: 'TBD', team2: 'TBD' }}
          onTeamClick={onTeamClick}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: 'text.secondary' }}>
            Semifinal
          </Typography>
          <Matchup
            matchup={bracket?.semifinals?.[1] || {
              team1: playoffTeams[1]?.name,
              team2: playoffTeams[2]?.name,
              seed1: 2,
              seed2: 3,
            }}
            direction="right"
            onTeamClick={onTeamClick}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default FourTeamPlayoff;
