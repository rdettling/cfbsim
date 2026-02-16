import { Box, Typography, Paper, Link as MuiLink } from '@mui/material';
import { TeamLogo } from '../team/TeamComponents';

export const TeamBox = ({
  team,
  seed,
  score,
  isWinner = false,
  isTBD = false,
  onTeamClick,
}: {
  team?: string;
  seed?: number;
  score?: number | null;
  isWinner?: boolean;
  isTBD?: boolean;
  onTeamClick: (name: string) => void;
}) => {
  const displayTeam = team?.startsWith('Winner of') ? 'TBD' : team;
  const shouldShowTBD = isTBD || team?.startsWith('Winner of');

  const handleTeamClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayTeam) onTeamClick(displayTeam);
  };

  return (
    <Box
      sx={{
        p: 1.5,
        border: '1px solid #e0e0e0',
        borderRadius: 1,
        backgroundColor: isWinner ? '#f5faff' : '#fafafa',
        minHeight: 45,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        fontWeight: 'bold',
        fontSize: '0.9rem',
        color: shouldShowTBD ? '#666' : '#333',
        borderLeft: isWinner ? '3px solid #1976d2' : '1px solid #e0e0e0',
        transition: 'all 0.2s',
      }}
    >
      {seed && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 'bold',
            color: seed <= 4 ? '#1976d2' : '#666',
            minWidth: 25,
          }}
        >
          {seed}
        </Typography>
      )}
      {!shouldShowTBD && displayTeam && <TeamLogo name={displayTeam} size={25} />}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        {shouldShowTBD ? (
          <Typography sx={{ fontWeight: 'bold' }}>{displayTeam || 'TBD'}</Typography>
        ) : (
          <MuiLink
            component="button"
            onClick={handleTeamClick}
            sx={{
              cursor: 'pointer',
              textDecoration: 'none',
              fontWeight: 'bold',
              color: '#333',
              '&:hover': { color: '#1976d2' },
            }}
          >
            {displayTeam || 'TBD'}
          </MuiLink>
        )}
        {score !== null && score !== undefined && (
          <Typography
            sx={{
              fontWeight: isWinner ? 'bold' : 'normal',
              color: isWinner ? '#1976d2' : '#666',
              fontSize: '0.95rem',
            }}
          >
            {score}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export const Matchup = ({
  matchup,
  direction,
  onTeamClick,
}: {
  matchup: any;
  direction: 'left' | 'right';
  onTeamClick: (name: string) => void;
}) => {
  const hasResults =
    (matchup.score1 !== undefined && matchup.score1 !== null) ||
    (matchup.score2 !== undefined && matchup.score2 !== null);
  const winner = matchup.winner;
  const hasGameId = matchup.game_id !== undefined && matchup.game_id !== null;

  const handleMatchupClick = () => {
    if (hasGameId) {
      window.location.href = `/game/${matchup.game_id}`;
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        onClick={handleMatchupClick}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          cursor: hasGameId ? 'pointer' : 'default',
          borderRadius: 1,
          transition: 'all 0.2s',
          '&:hover': hasGameId
            ? {
                transform: 'scale(1.02)',
                '& > *': {
                  borderColor: '#1976d2',
                  boxShadow: 1,
                },
              }
            : {},
        }}
      >
        <TeamBox
          team={matchup.team1}
          seed={matchup.seed1}
          score={matchup.score1}
          isWinner={hasResults && winner === matchup.team1}
          isTBD={matchup.team1 === 'TBD'}
          onTeamClick={onTeamClick}
        />
        <TeamBox
          team={matchup.team2}
          seed={matchup.seed2}
          score={matchup.score2}
          isWinner={hasResults && winner === matchup.team2}
          isTBD={matchup.team2 === 'TBD'}
          onTeamClick={onTeamClick}
        />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          [direction === 'left' ? 'right' : 'left']: -20,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 20,
          height: 2,
          backgroundColor: '#e0e0e0',
          '&::after': {
            content: '""',
            position: 'absolute',
            [direction === 'left' ? 'right' : 'left']: 0,
            top: -8,
            width: 2,
            height: 16,
            backgroundColor: '#e0e0e0',
          },
        }}
      />
    </Box>
  );
};

export const Championship = ({
  championship,
  onTeamClick,
}: {
  championship: any;
  onTeamClick: (name: string) => void;
}) => {
  const hasResults =
    (championship.score1 !== undefined && championship.score1 !== null) ||
    (championship.score2 !== undefined && championship.score2 !== null);
  const winner = championship.winner;
  const hasGameId = championship.game_id !== undefined && championship.game_id !== null;

  const handleChampionshipClick = () => {
    if (hasGameId) {
      window.location.href = `/game/${championship.game_id}`;
    }
  };

  return (
    <Paper
      onClick={handleChampionshipClick}
      sx={{
        p: 3,
        textAlign: 'center',
        borderRadius: 2,
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
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        Championship
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
        <TeamBox
          team={championship.team1}
          seed={championship.seed1}
          score={championship.score1}
          isWinner={hasResults && winner === championship.team1}
          onTeamClick={onTeamClick}
        />
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
          VS
        </Typography>
        <TeamBox
          team={championship.team2}
          seed={championship.seed2}
          score={championship.score2}
          isWinner={hasResults && winner === championship.team2}
          onTeamClick={onTeamClick}
        />
      </Box>
    </Paper>
  );
};

export const BracketRound = ({
  title,
  matchups,
  direction = 'left',
  centerAlign = false,
  onTeamClick,
}: {
  title: string;
  matchups: any[];
  direction?: 'left' | 'right';
  centerAlign?: boolean;
  onTeamClick: (name: string) => void;
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: 200,
      justifyContent: centerAlign ? 'center' : 'flex-start',
      alignItems: centerAlign ? 'center' : 'stretch',
    }}
  >
    <Typography
      variant="h6"
      sx={{
        fontWeight: 'bold',
        textAlign: 'center',
        mb: 2,
        color: '#1976d2',
        fontSize: '1rem',
      }}
    >
      {title}
    </Typography>

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {matchups.map((matchup, idx) => (
        <Matchup key={idx} matchup={matchup} direction={direction} onTeamClick={onTeamClick} />
      ))}
    </Box>
  </Box>
);
