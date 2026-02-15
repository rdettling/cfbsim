import { Box, Typography, Paper } from '@mui/material';
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
    <Box>
      <Paper sx={{ p: 4, borderRadius: 2, overflow: 'auto' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 4, textAlign: 'center' }}>
          4-Team Playoff Bracket
        </Typography>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            minWidth: 1000,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center', color: '#1976d2', fontSize: '1rem' }}>
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

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center', color: '#1976d2', fontSize: '1rem' }}>
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
    </Box>
  );
};

export default FourTeamPlayoff;
