import { Box, Typography, Chip, Paper, List, ListItem, Link as MuiLink, Stack } from '@mui/material';
import { TeamLogo, ConfLogo } from '../team/TeamComponents';

export const PlayoffSettings = ({
  settings,
}: {
  settings: { teams: number; autobids: number; conf_champ_top_4: boolean };
}) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 4,
      py: 0.5,
      flexWrap: 'wrap',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Format:
      </Typography>
      <Chip
        label={`${settings.teams} Teams`}
        size="small"
        sx={{ fontWeight: 600, backgroundColor: '#0f2a44', color: 'white' }}
      />
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

export const BowlGamesList = ({
  games,
  onTeamClick,
}: {
  games: Array<{
    id: number;
    name: string;
    week: number;
    teamA: string;
    teamB: string;
    teamA_conf: string;
    teamB_conf: string;
    teamA_is_champ: boolean;
    teamB_is_champ: boolean;
    rankA: number;
    rankB: number;
    recordA: string;
    recordB: string;
    scoreA: number | null;
    scoreB: number | null;
    winner: string | null;
    is_ny6: boolean;
    is_projection: boolean;
  }>;
  onTeamClick: (name: string) => void;
}) => (
  <Paper sx={{ p: 2.5, borderRadius: 2.5, boxShadow: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
        Bowl Slate
      </Typography>
      <Typography variant="caption" color="text.secondary">
        New Year’s Six highlighted
      </Typography>
    </Box>
    <Stack spacing={2}>
      {(() => {
        const ny6 = games.filter(game => game.is_ny6);
        const others = games.filter(game => !game.is_ny6);
        const sections: Array<{ title: string; items: typeof games }> = [];
        if (ny6.length) sections.push({ title: 'New Year’s Six', items: ny6 });
        if (others.length) sections.push({ title: 'Other Bowls', items: others });
        return sections;
      })().map((section, sectionIndex) => (
        <Box key={`${section.title}-${sectionIndex}`}>
          <Typography
            variant="overline"
            sx={{ letterSpacing: 2, fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}
          >
            {section.title}
          </Typography>
          <Stack spacing={1.5}>
            {section.items.map((game, index) => (
              <Box
                key={`${game.name}-${game.id}-${index}`}
                sx={{
                  border: '1px solid',
                  borderColor: game.is_ny6 ? 'primary.light' : 'divider',
                  borderRadius: 2,
                  p: 1.5,
                  backgroundColor: game.is_ny6 ? '#f5f9ff' : 'white',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <MuiLink
                    component="button"
                    onClick={() => {
                      if (game.id > 0) {
                        window.location.href = `/game/${game.id}`;
                      }
                    }}
                    sx={{
                      cursor: game.id > 0 ? 'pointer' : 'default',
                      textDecoration: 'none',
                      fontWeight: 800,
                      color: 'text.primary',
                      fontSize: '0.95rem',
                      '&:hover': { color: 'primary.main' },
                      textAlign: 'left',
                    }}
                  >
                    {game.name}
                  </MuiLink>
                  {game.is_ny6 && <Chip label="NY6" color="primary" size="small" sx={{ fontWeight: 'bold' }} />}
                  {game.is_projection && (
                    <Chip label="Projection" variant="outlined" size="small" sx={{ fontWeight: 'bold' }} />
                  )}
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr auto' },
                    gap: { xs: 1, md: 2 },
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <TeamLogo name={game.teamA} size={26} />
                    <Box sx={{ minWidth: 0 }}>
                      <MuiLink
                        component="button"
                        onClick={() => onTeamClick(game.teamA)}
                        sx={{
                          cursor: 'pointer',
                          textDecoration: 'none',
                          fontWeight: 700,
                          color: 'text.primary',
                          fontSize: '0.95rem',
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        #{game.rankA} {game.teamA}
                      </MuiLink>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {game.recordA}
                      </Typography>
                    </Box>
                    {game.teamA_is_champ && (
                      <Chip
                        label={`${game.teamA_conf} Champ`}
                        color="success"
                        size="small"
                        sx={{ fontWeight: 'bold', height: 22 }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    vs
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <TeamLogo name={game.teamB} size={26} />
                    <Box sx={{ minWidth: 0 }}>
                      <MuiLink
                        component="button"
                        onClick={() => onTeamClick(game.teamB)}
                        sx={{
                          cursor: 'pointer',
                          textDecoration: 'none',
                          fontWeight: 700,
                          color: 'text.primary',
                          fontSize: '0.95rem',
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        #{game.rankB} {game.teamB}
                      </MuiLink>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {game.recordB}
                      </Typography>
                    </Box>
                    {game.teamB_is_champ && (
                      <Chip
                        label={`${game.teamB_conf} Champ`}
                        color="success"
                        size="small"
                        sx={{ fontWeight: 'bold', height: 22 }}
                      />
                    )}
                  </Box>
                  {game.scoreA !== null && game.scoreB !== null && (
                    <Chip
                      label={`${game.scoreA}-${game.scoreB}`}
                      color={game.winner ? 'success' : 'default'}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
        <Box
          key={`${game.name}-${game.id}-${index}`}
          sx={{
            border: '1px solid',
            borderColor: game.is_ny6 ? 'primary.light' : 'divider',
            borderRadius: 2,
            p: 1.5,
            backgroundColor: game.is_ny6 ? '#f5f9ff' : 'white',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <MuiLink
              component="button"
              onClick={() => {
                if (game.id > 0) {
                  window.location.href = `/game/${game.id}`;
                }
              }}
              sx={{
                cursor: game.id > 0 ? 'pointer' : 'default',
                textDecoration: 'none',
                fontWeight: 800,
                color: 'text.primary',
                fontSize: '0.95rem',
                '&:hover': { color: 'primary.main' },
                textAlign: 'left',
              }}
            >
              {game.name}
            </MuiLink>
            {game.is_ny6 && <Chip label="NY6" color="primary" size="small" sx={{ fontWeight: 'bold' }} />}
            {game.is_projection && (
              <Chip label="Projection" variant="outlined" size="small" sx={{ fontWeight: 'bold' }} />
            )}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr auto' },
              gap: { xs: 1, md: 2 },
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <TeamLogo name={game.teamA} size={26} />
              <Box sx={{ minWidth: 0 }}>
                <MuiLink
                  component="button"
                  onClick={() => onTeamClick(game.teamA)}
                  sx={{
                    cursor: 'pointer',
                    textDecoration: 'none',
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  #{game.rankA} {game.teamA}
                </MuiLink>
                <Typography variant="caption" color="text.secondary" display="block">
                  {game.recordA}
                </Typography>
              </Box>
              {game.teamA_is_champ && (
                <Chip
                  label={`${game.teamA_conf} Champ`}
                  color="success"
                  size="small"
                  sx={{ fontWeight: 'bold', height: 22 }}
                />
              )}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              vs
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <TeamLogo name={game.teamB} size={26} />
              <Box sx={{ minWidth: 0 }}>
                <MuiLink
                  component="button"
                  onClick={() => onTeamClick(game.teamB)}
                  sx={{
                    cursor: 'pointer',
                    textDecoration: 'none',
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  #{game.rankB} {game.teamB}
                </MuiLink>
                <Typography variant="caption" color="text.secondary" display="block">
                  {game.recordB}
                </Typography>
              </Box>
              {game.teamB_is_champ && (
                <Chip
                  label={`${game.teamB_conf} Champ`}
                  color="success"
                  size="small"
                  sx={{ fontWeight: 'bold', height: 22 }}
                />
              )}
            </Box>
            {game.scoreA !== null && game.scoreB !== null && (
              <Chip
                label={`${game.scoreA}-${game.scoreB}`}
                color={game.winner ? 'success' : 'default'}
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            )}
          </Box>
        </Box>
      ))}
    </Stack>
  </Paper>
);

export const RankingsList = ({
  teams,
  onTeamClick,
  title = 'Final Rankings',
}: {
  teams: Array<{ name: string; ranking: number; conference: string; record: string }>;
  onTeamClick: (name: string) => void;
  title?: string;
}) => (
  <Paper sx={{ p: 2.5, borderRadius: 2, boxShadow: 1 }}>
    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 1.5, fontSize: '1.1rem' }}>
      {title}
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
