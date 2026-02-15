import { Box, Typography, Paper, Chip, Divider } from '@mui/material';
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
    <Paper
      onClick={handleGameClick}
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 2.5,
        cursor: hasGameId ? 'pointer' : 'default',
        transition: 'all 0.2s',
        background: 'linear-gradient(180deg, #ffffff 0%, #f6f7fb 100%)',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': hasGameId
          ? {
              boxShadow: 5,
              borderColor: 'primary.main',
            }
          : {},
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: 'text.secondary' }}>
            National Championship
          </Typography>
          {hasResults && winner && (
            <Typography variant="body2" color="text.secondary">
              Champion: {winner}
            </Typography>
          )}
        </Box>
        <Chip label="Title Game" size="small" sx={{ fontWeight: 700 }} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr' },
          gap: { xs: 2, md: 3 },
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TeamLogo name={team1?.name} size={56} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              onClick={e => {
                e.stopPropagation();
                onTeamClick(team1?.name || '');
              }}
              sx={{
                cursor: 'pointer',
                fontWeight: 800,
                color: 'text.primary',
                fontSize: '1.25rem',
                '&:hover': { color: 'primary.main' },
              }}
            >
              #{team1?.seed} {team1?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {team1?.record} • Rank #{team1?.ranking}
            </Typography>
            {team1?.is_autobid && (
              <Chip label="Auto Bid" color="primary" size="small" sx={{ mt: 1, fontWeight: 700 }} />
            )}
          </Box>
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.secondary' }}>
            VS
          </Typography>
          {hasResults && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>
                {championship.score1} - {championship.score2}
              </Typography>
            </>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          <Box sx={{ minWidth: 0, textAlign: { xs: 'left', md: 'right' } }}>
            <Typography
              onClick={e => {
                e.stopPropagation();
                onTeamClick(team2?.name || '');
              }}
              sx={{
                cursor: 'pointer',
                fontWeight: 800,
                color: 'text.primary',
                fontSize: '1.25rem',
                '&:hover': { color: 'primary.main' },
              }}
            >
              #{team2?.seed} {team2?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {team2?.record} • Rank #{team2?.ranking}
            </Typography>
            {team2?.is_autobid && (
              <Chip label="Auto Bid" color="primary" size="small" sx={{ mt: 1, fontWeight: 700 }} />
            )}
          </Box>
          <TeamLogo name={team2?.name} size={56} />
        </Box>
      </Box>
    </Paper>
  );
};

export default ChampionshipPlayoff;
