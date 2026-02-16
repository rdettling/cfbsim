import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Typography,
  Link as MuiLink,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { PageLayout } from '../components/layout/PageLayout';
import { useDomainData } from '../domain/hooks';
import { loadRecruitingSummary } from '../domain/league';
import { ConfLogo, TeamInfoModal, TeamLink, TeamLogo } from '../components/team/TeamComponents';
import type { Team } from '../types/domain';
import type { RecruitingSummaryPageData } from '../types/pages';

interface FreshmanPlayer {
  id: number;
  first: string;
  last: string;
  pos: string;
  rating: number;
  stars: number;
  teamName?: string;
}

interface PlayerRowProps {
  player: FreshmanPlayer;
  index: number;
  showTeam?: boolean;
  onTeamClick?: (teamName: string) => void;
}

const PlayerRow = ({ player, index, showTeam = false, onTeamClick }: PlayerRowProps) => (
  <TableRow sx={{ '&:hover': { backgroundColor: 'grey.50' }, borderBottom: '1px solid', borderColor: 'divider' }}>
    <TableCell sx={styles.cell}>#{index + 1}</TableCell>
    <TableCell sx={styles.cell}>
      <MuiLink
        component={RouterLink}
        to={`/players/${player.id}`}
        underline="hover"
        sx={{ color: 'primary.main', fontWeight: 600 }}
      >
        {player.first} {player.last}
      </MuiLink>
    </TableCell>
    {showTeam && player.teamName && (
      <TableCell sx={styles.cell}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TeamLogo name={player.teamName} size={25} />
          <TeamLink name={player.teamName} onTeamClick={() => onTeamClick?.(player.teamName!)} />
        </Box>
      </TableCell>
    )}
    <TableCell sx={styles.cell}>
      <Chip label={player.pos.toUpperCase()} size="small" color="secondary" variant="outlined" />
    </TableCell>
    <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>{player.rating}</TableCell>
    <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>
      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
        {Array.from({ length: player.stars }).map((_, i) => (
          <Box
            key={i}
            component="img"
            src="/logos/star.png"
            alt="star"
            sx={{ width: 16, height: 16 }}
          />
        ))}
      </Box>
    </TableCell>
  </TableRow>
);

const styles = {
  card: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: 2 },
  header: { p: 3, borderBottom: '1px solid', borderColor: 'divider' },
  cell: { fontWeight: 600, fontSize: '0.875rem', py: 2.5 },
  starCell: (hasStars: boolean) => ({
    fontWeight: 600,
    fontSize: '0.875rem',
    py: 2.5,
    textAlign: 'center' as const,
    color: hasStars ? 'warning.main' : 'text.secondary',
    backgroundColor: hasStars ? 'warning.50' : 'transparent',
    borderRadius: 1,
    mx: 0.5,
  }),
  tabs: {
    '& .MuiTab-root': { fontSize: '1.1rem', fontWeight: 600, textTransform: 'none', minHeight: 56, px: 4 },
    '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
  },
};

const TabPanel = ({ children, value, index }: { children: React.ReactNode; value: number; index: number }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const RecruitingSummary = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);
  const [teamRecruitsModalOpen, setTeamRecruitsModalOpen] = useState(false);
  const [selectedTeamRecruits, setSelectedTeamRecruits] = useState<{ team: Team; players: FreshmanPlayer[] } | null>(null);
  const [showAllTeams, setShowAllTeams] = useState(false);

  const { data, loading, error } = useDomainData<RecruitingSummaryPageData>({
    fetcher: loadRecruitingSummary,
    deps: [],
  });

  const allFreshmen = useMemo(() => {
    if (!data) return [];
    return data.team_rankings
      .flatMap((teamRanking) =>
        teamRanking.players.map(player => ({ ...player, teamName: teamRanking.team_name }))
      )
      .sort((a, b) => b.rating - a.rating);
  }, [data]);

  const displayedTeams = data?.team_rankings.slice(0, showAllTeams ? data.team_rankings.length : 25) || [];

  const handleTeamRecruitsClick = (teamName: string) => {
    const teamRanking = data?.team_rankings.find(ranking => ranking.team_name === teamName);
    if (teamRanking) {
      setSelectedTeamRecruits({ team: teamRanking.team, players: teamRanking.players });
      setTeamRecruitsModalOpen(true);
    }
  };

  return (
    <PageLayout
      loading={loading}
      error={error}
      navbarData={
        data
          ? {
              team: data.team,
              currentStage: data.info.stage,
              info: data.info,
              conferences: data.conferences,
            }
          : undefined
      }
      containerMaxWidth="lg"
    >
      {data && (
        <>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '2rem', md: '2.5rem' } }}
            >
              {data.info.currentYear} Recruiting Rankings
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ opacity: 0.8 }}>
              College Football Team Rankings
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={styles.tabs}>
              <Tab label="Team Rankings" />
              <Tab label="Player Rankings" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Card sx={styles.card}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={styles.header}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Team Rankings
                  </Typography>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.100' }}>
                        <TableCell sx={styles.cell}>Rank</TableCell>
                        <TableCell sx={styles.cell}>Team</TableCell>
                        <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>Total</TableCell>
                        <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>5★</TableCell>
                        <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>4★</TableCell>
                        <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>3★</TableCell>
                        <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>Avg Stars</TableCell>
                        <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>Points</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayedTeams.map((team, index) => (
                        <TableRow
                          key={team.team_name}
                          sx={{ '&:hover': { backgroundColor: 'grey.50' }, borderBottom: '1px solid', borderColor: 'divider' }}
                        >
                          <TableCell sx={styles.cell}>#{index + 1}</TableCell>
                          <TableCell sx={styles.cell}>
                            <Box
                              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                              onClick={() => handleTeamRecruitsClick(team.team_name)}
                            >
                              <TeamLogo name={team.team_name} size={28} />
                              <Typography
                                sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.875rem', '&:hover': { color: 'primary.main' } }}
                              >
                                {team.team_name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>{team.player_count}</TableCell>
                          <TableCell sx={styles.starCell(team.five_stars > 0)}>{team.five_stars}</TableCell>
                          <TableCell sx={styles.starCell(team.four_stars > 0)}>{team.four_stars}</TableCell>
                          <TableCell sx={{ ...styles.cell, textAlign: 'center', color: 'text.secondary' }}>{team.three_stars}</TableCell>
                          <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>{team.avg_stars}</TableCell>
                          <TableCell sx={{ ...styles.cell, textAlign: 'center', color: 'primary.main' }}>{team.weighted_score}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {data.team_rankings.length > 25 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button
                      variant="outlined"
                      onClick={() => setShowAllTeams(!showAllTeams)}
                      sx={{ px: 4, py: 1.5, fontWeight: 600, textTransform: 'none', borderRadius: 2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                      {showAllTeams ? `Show Top 25 (of ${data.team_rankings.length} teams)` : `Show All ${data.team_rankings.length} Teams`}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Card sx={styles.card}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ ...styles.header, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Player Rankings
                  </Typography>
                  <Chip label={`${allFreshmen.length} players`} color="primary" size="small" sx={{ fontWeight: 600 }} />
                </Box>

                {allFreshmen.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'grey.100' }}>
                          <TableCell sx={styles.cell}>Rank</TableCell>
                          <TableCell sx={styles.cell}>Name</TableCell>
                          <TableCell sx={styles.cell}>Team</TableCell>
                          <TableCell sx={styles.cell}>Position</TableCell>
                          <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>Rating</TableCell>
                          <TableCell sx={{ ...styles.cell, textAlign: 'center' }}>Stars</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {allFreshmen.slice(0, 100).map((player, index) => (
                          <PlayerRow
                            key={player.id}
                            player={player}
                            index={index}
                            showTeam
                            onTeamClick={(teamName) => { setSelectedTeam(teamName); setModalOpen(true); }}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No recruits found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      No freshmen match the current filters.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </TabPanel>

          <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />

          <Dialog open={teamRecruitsModalOpen} onClose={() => setTeamRecruitsModalOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {selectedTeamRecruits && (
                  <>
                    <TeamLogo name={selectedTeamRecruits.team.name} size={40} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {selectedTeamRecruits.team.name} Recruiting Class
                    </Typography>
                  </>
                )}
                <IconButton
                  aria-label="close"
                  onClick={() => setTeamRecruitsModalOpen(false)}
                  sx={{ position: 'absolute', right: 8, top: 8, color: 'grey.500' }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              {selectedTeamRecruits && (
                <Box>
                  <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Chip label={`${selectedTeamRecruits.players.length} recruits`} color="primary" size="small" />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ConfLogo name={selectedTeamRecruits.team.conference} size={24} />
                      <Typography variant="body2" color="text.secondary">
                        {selectedTeamRecruits.team.conference}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Prestige: {selectedTeamRecruits.team.prestige}
                    </Typography>
                  </Box>

                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'primary.main' }}>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rank</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Position</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Stars</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...selectedTeamRecruits.players]
                          .sort((a, b) => b.rating - a.rating)
                          .map((player, index) => (
                            <PlayerRow key={player.id} player={player} index={index} showTeam={false} />
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </PageLayout>
  );
};

export default RecruitingSummary;
