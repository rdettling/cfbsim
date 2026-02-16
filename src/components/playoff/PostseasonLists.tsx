import { Box, Typography, Chip, Paper, List, ListItem, Link as MuiLink, Stack } from '@mui/material';
import { TeamLogo } from '../team/TeamComponents';

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
    </Stack>
  </Paper>
);


export const RankingResumeList = ({
  teams,
  onTeamClick,
}: {
  teams: Array<{
    name: string;
    ranking: number;
    conference: string;
    record: string;
    rating: number;
    ranked_wins: number;
    losses: number;
    sor_rank: number;
    is_champ: boolean;
  }>;
  onTeamClick: (name: string) => void;
}) => (
  <Paper sx={{ p: 3, borderRadius: 2.5, boxShadow: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Box>
        <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: 'text.secondary' }}>
          Committee Snapshot
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Top 10 Resume Board
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Rankings drive selection
      </Typography>
    </Box>
    <Box
      sx={{
        display: { xs: 'none', lg: 'grid' },
        gridTemplateColumns: '2fr 3fr 1fr',
        gap: 2,
        px: 1.5,
        mb: 1,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
        Team
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
        Resume
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1, textAlign: 'right' }}>
        Status
      </Typography>
    </Box>

    <List dense sx={{ py: 0 }}>
      {teams.map((team, index) => {
        const isIn = team.ranking <= 4;
        return (
          <ListItem
            key={`${team.name}-${index}`}
            sx={{
              py: 1.1,
              px: 1.5,
              borderBottom: index < teams.length - 1 ? '1px solid #f0f0f0' : 'none',
              borderLeft: isIn ? '3px solid #1f5fbf' : '3px solid transparent',
              backgroundColor: isIn ? '#f7faff' : 'transparent',
              '&:hover': { backgroundColor: isIn ? '#f0f5ff' : '#fafafa' },
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '2fr 3fr 1fr' },
                gap: 2,
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    minWidth: 34,
                    fontWeight: 800,
                    color: isIn ? 'primary.main' : 'text.primary',
                  }}
                >
                  #{team.ranking}
                </Typography>
                <TeamLogo name={team.name} size={26} />
                <Box sx={{ minWidth: 0 }}>
                  <MuiLink
                    component="button"
                    onClick={() => onTeamClick(team.name)}
                    sx={{
                      cursor: 'pointer',
                      textDecoration: 'none',
                      fontWeight: 800,
                      color: 'text.primary',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {team.name}
                  </MuiLink>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {team.record} • {team.conference}
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(90px, 1fr))' },
                  gap: 1.5,
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Rating
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {team.rating}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    SOR
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    #{team.sor_rank}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Ranked Wins
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {team.ranked_wins}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Losses
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {team.losses}
                    </Typography>
                  </Box>
                  {team.is_champ && (
                    <Chip label="Conf Champ" color="success" size="small" sx={{ fontWeight: 700, height: 22 }} />
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
                <Chip
                  label={isIn ? 'In' : 'Out'}
                  color={isIn ? 'primary' : 'default'}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              </Box>
            </Box>
          </ListItem>
        );
      })}
    </List>
  </Paper>
);
