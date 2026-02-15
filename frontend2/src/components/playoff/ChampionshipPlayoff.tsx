import { Box, Typography, Paper, Grid, Chip } from '@mui/material';
import { TeamLogo } from '../team/TeamComponents';

const ChampionshipPlayoff = ({
  playoffTeams,
  bracket,
  onTeamClick,
}: {
  playoffTeams: any[];
  bracket?: any;
  onTeamClick: (name: string) => void;
}) => {
  const team1 = playoffTeams[0];
  const team2 = playoffTeams[1];

  const championship = bracket?.championship;
  const hasResults = championship && (championship.score1 !== null || championship.score2 !== null);
  const winner = championship?.winner;
  const hasGameId = championship?.game_id !== undefined && championship?.game_id !== null;

  const handleGameClick = () => {
    if (hasGameId) {
      window.location.href = `/game/${championship.game_id}`;
    }
  };

  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper
          onClick={handleGameClick}
          sx={{
            p: 4,
            textAlign: 'center',
            cursor: hasGameId ? 'pointer' : 'default',
            transition: 'all 0.2s',
            '&:hover': hasGameId
              ? {
                  boxShadow: 4,
                  borderColor: '#1976d2',
                }
              : {},
          }}
        >
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
            National Championship
            {hasResults && winner && (
              <Typography
                component="span"
                sx={{
                  display: 'block',
                  fontSize: '1rem',
                  color: 'text.secondary',
                  fontWeight: 'normal',
                  mt: 1,
                }}
              >
                Champion: {winner}
              </Typography>
            )}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, mb: 4 }}>
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                <TeamLogo name={team1?.name} size={40} />
                <Typography
                  onClick={e => {
                    e.stopPropagation();
                    onTeamClick(team1?.name || '');
                  }}
                  sx={{
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: 'text.primary',
                    fontSize: '1.5rem',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  #{team1?.seed} {team1?.name}
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                {team1?.record}
                {hasResults && championship?.score1 !== null && (
                  <Typography
                    component="span"
                    sx={{
                      display: 'block',
                      fontWeight: winner === team1?.name ? 'bold' : 'normal',
                      color: winner === team1?.name ? 'primary.main' : 'text.secondary',
                      fontSize: '1.2rem',
                      mt: 0.5,
                    }}
                  >
                    {championship.score1}
                  </Typography>
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rank: #{team1?.ranking}
              </Typography>
              {team1?.is_autobid && <Chip label="Automatic Bid" color="primary" size="small" sx={{ mt: 1 }} />}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                VS
              </Typography>
              {hasResults && (
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  {championship.score1} - {championship.score2}
                </Typography>
              )}
            </Box>

            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                <TeamLogo name={team2?.name} size={40} />
                <Typography
                  onClick={e => {
                    e.stopPropagation();
                    onTeamClick(team2?.name || '');
                  }}
                  sx={{
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: 'text.primary',
                    fontSize: '1.5rem',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  #{team2?.seed} {team2?.name}
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                {team2?.record}
                {hasResults && championship?.score2 !== null && (
                  <Typography
                    component="span"
                    sx={{
                      display: 'block',
                      fontWeight: winner === team2?.name ? 'bold' : 'normal',
                      color: winner === team2?.name ? 'primary.main' : 'text.secondary',
                      fontSize: '1.2rem',
                      mt: 0.5,
                    }}
                  >
                    {championship.score2}
                  </Typography>
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rank: #{team2?.ranking}
              </Typography>
              {team2?.is_autobid && <Chip label="Automatic Bid" color="primary" size="small" sx={{ mt: 1 }} />}
            </Box>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default ChampionshipPlayoff;
