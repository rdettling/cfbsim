import { Box, Typography, Chip, Paper, List, ListItem, Link as MuiLink } from '@mui/material';
import { TeamLogo, ConfLogo } from '../team/TeamComponents';

export const PlayoffSettings = ({
  settings,
}: {
  settings: { teams: number; autobids: number; conf_champ_top_4: boolean };
}) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      gap: 4,
      mb: 3,
      py: 1.5,
      px: 2,
      borderBottom: '1px solid #e0e0e0',
      flexWrap: 'wrap',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Format:
      </Typography>
      <Chip label={`${settings.teams} Teams`} size="small" sx={{ fontWeight: 500 }} />
    </Box>
    {settings.teams === 12 && (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Auto Bids:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {settings.autobids}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Top 4:
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {settings.conf_champ_top_4 ? 'Conf Champs' : 'Highest Ranked'}
          </Typography>
        </Box>
      </>
    )}
  </Box>
);

export const PlayoffTeamsList = ({
  teams,
  onTeamClick,
}: {
  teams: Array<{
    name: string;
    seed: number;
    ranking: number;
    conference: string;
    record: string;
    is_autobid: boolean;
  }>;
  onTeamClick: (name: string) => void;
}) => (
  <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: 1 }}>
    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 1.5, fontSize: '1.1rem' }}>
      Playoff Teams
    </Typography>
    <List dense sx={{ py: 0 }}>
      {teams.slice(0, 12).map((team, index) => (
        <ListItem
          key={`${team.name}-${index}`}
          sx={{
            py: 0.75,
            px: 0,
            borderBottom: index < 11 ? '1px solid #f0f0f0' : 'none',
            '&:last-child': { borderBottom: 'none' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'bold',
                minWidth: 28,
                color: index < 4 ? 'primary.main' : 'text.primary',
                fontSize: '0.9rem',
              }}
            >
              #{team.seed}
            </Typography>
            <TeamLogo name={team.name} size={22} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <MuiLink
                component="button"
                onClick={() => onTeamClick(team.name)}
                sx={{
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  color: 'text.primary',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {team.name}
              </MuiLink>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.75rem' }}>
                {team.record} • Rank #{team.ranking}
              </Typography>
            </Box>
            {team.is_autobid && (
              <Chip label="Auto" color="primary" size="small" sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 22 }} />
            )}
          </Box>
        </ListItem>
      ))}
    </List>
  </Paper>
);

export const BubbleTeamsList = ({
  teams,
  onTeamClick,
}: {
  teams: Array<{ name: string; ranking: number; conference: string; record: string }>;
  onTeamClick: (name: string) => void;
}) => (
  <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: 1 }}>
    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 1.5, fontSize: '1.1rem' }}>
      Bubble Teams
    </Typography>
    <List dense sx={{ py: 0 }}>
      {teams.map((team, index) => (
        <ListItem
          key={`${team.name}-${index}`}
          sx={{
            py: 0.75,
            px: 0,
            borderBottom: index < teams.length - 1 ? '1px solid #f0f0f0' : 'none',
            '&:last-child': { borderBottom: 'none' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 28, fontWeight: 'bold', fontSize: '0.9rem' }}>
              #{team.ranking}
            </Typography>
            <TeamLogo name={team.name} size={22} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <MuiLink
                component="button"
                onClick={() => onTeamClick(team.name)}
                sx={{
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  color: 'text.primary',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {team.name}
              </MuiLink>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.75rem' }}>
                {team.record} • {team.conference}
              </Typography>
            </Box>
          </Box>
        </ListItem>
      ))}
    </List>
  </Paper>
);

export const ConferenceChampionsList = ({
  champions,
  onTeamClick,
}: {
  champions: Array<{ name: string; ranking: number; conference: string; record: string; seed: number | null }>;
  onTeamClick: (name: string) => void;
}) => (
  <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: 1 }}>
    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 1.5, fontSize: '1.1rem' }}>
      Conference Champions
    </Typography>
    <List dense sx={{ py: 0 }}>
      {champions.map((team, index) => (
        <ListItem
          key={`${team.name}-${index}`}
          sx={{
            py: 0.75,
            px: 0,
            borderBottom: index < champions.length - 1 ? '1px solid #f0f0f0' : 'none',
            '&:last-child': { borderBottom: 'none' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 28, fontWeight: 'bold', fontSize: '0.9rem' }}>
              #{team.ranking}
            </Typography>
            <TeamLogo name={team.name} size={22} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <MuiLink
                component="button"
                onClick={() => onTeamClick(team.name)}
                sx={{
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  color: 'text.primary',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {team.name}
              </MuiLink>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.75rem' }}>
                {team.record}
              </Typography>
            </Box>
            <ConfLogo name={team.conference} size={22} />
            {team.seed && (
              <Chip
                label={team.seed <= 4 ? `Seed #${team.seed}` : 'Playoff'}
                color={team.seed <= 4 ? 'primary' : 'success'}
                size="small"
                sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 22 }}
              />
            )}
          </Box>
        </ListItem>
      ))}
    </List>
  </Paper>
);

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
  const hasResults = matchup.score1 !== undefined && matchup.score1 !== null || matchup.score2 !== undefined && matchup.score2 !== null;
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
  const hasResults = championship?.score1 !== undefined && championship?.score1 !== null || championship?.score2 !== undefined && championship?.score2 !== null;
  const winner = championship?.winner;
  const hasGameId = championship?.game_id !== undefined && championship?.game_id !== null;

  const handleChampionshipClick = () => {
    if (hasGameId) {
      window.location.href = `/game/${championship.game_id}`;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#1976d2',
          fontSize: '1.1rem',
        }}
      >
        Championship
        {hasResults && winner && (
          <Typography
            component="span"
            sx={{
              display: 'block',
              fontSize: '0.8rem',
              color: 'text.secondary',
              fontWeight: 'normal',
              mt: 0.5,
            }}
          >
            Champion: {winner}
          </Typography>
        )}
      </Typography>
      <Box sx={{ position: 'relative' }}>
        <Box
          onClick={handleChampionshipClick}
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
            team={championship?.team1}
            seed={championship?.seed1}
            score={championship?.score1}
            isWinner={hasResults && winner === championship?.team1}
            isTBD={championship?.team1 === 'TBD'}
            onTeamClick={onTeamClick}
          />
          <TeamBox
            team={championship?.team2}
            seed={championship?.seed2}
            score={championship?.score2}
            isWinner={hasResults && winner === championship?.team2}
            isTBD={championship?.team2 === 'TBD'}
            onTeamClick={onTeamClick}
          />
        </Box>

        <Box
          sx={{
            position: 'absolute',
            left: -20,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 20,
            height: 2,
            backgroundColor: '#e0e0e0',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            right: -20,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 20,
            height: 2,
            backgroundColor: '#e0e0e0',
          }}
        />
      </Box>
    </Box>
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
