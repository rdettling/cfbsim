import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  Link,
  Typography,
  Box,
  Stack,
  Chip,
  Container,
} from '@mui/material';
import { Schedule } from '@mui/icons-material';
import TeamHeader from '../components/team/TeamHeader';
import { ConfLogo } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import { loadTeamHistory } from '../domain/league';
import { PageLayout } from '../components/layout/PageLayout';

type YearHistory = {
  year: number;
  prestige: number;
  rating: number | null;
  conference: string;
  wins: number;
  losses: number;
  rank: number;
  has_games: boolean;
};

const TeamHistory = () => {
  const { teamName } = useParams();
  const navigate = useNavigate();

  const { data, loading, error } = useDomainData({
    fetcher: () => loadTeamHistory(teamName),
    deps: [teamName],
  });

  useEffect(() => {
    document.title = teamName ? `${teamName} History` : 'Team History';
    return () => {
      document.title = 'College Football';
    };
  }, [teamName]);

  const handleTeamChange = (newTeam: string) => {
    navigate(`/${newTeam}/history`);
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 0) return 'N/A';
    return `#${rank}`;
  };

  const getPrestigeStars = (prestige: number) => Math.min(Math.max(prestige, 1), 7);

  const PrestigeStars = ({ prestige }: { prestige: number }) => {
    const starCount = getPrestigeStars(prestige);
    const starPath = `/logos/star.png`;

    return (
      <Stack direction="row" spacing={0.5}>
        {Array.from({ length: starCount }, (_, i) => (
          <Box key={i} component="img" src={starPath} sx={{ width: 16, height: 16 }} alt="star" />
        ))}
      </Stack>
    );
  };

  const totalWins =
    data?.years.reduce((sum: number, year: YearHistory) => sum + year.wins, 0) || 0;
  const totalLosses =
    data?.years.reduce((sum: number, year: YearHistory) => sum + year.losses, 0) || 0;

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
      containerMaxWidth="xl"
    >
      {data && (
        <Container maxWidth={false} sx={{ px: { xs: 0, md: 1 } }}>
          <TeamHeader team={data.team} teams={data.teams} onTeamChange={handleTeamChange} />

          <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box
              sx={{
                bgcolor: data.team.colorPrimary || 'primary.main',
                color: 'white',
                p: { xs: 1.5, md: 2 },
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule />
                Team History
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                All-Time: {totalWins}-{totalLosses}
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow
                    sx={{
                      '& th': {
                        bgcolor: data.team.colorPrimary || 'primary.main',
                        color: 'white',
                        fontWeight: 'bold',
                        borderBottomColor: 'rgba(255,255,255,0.25)',
                      },
                    }}
                  >
                    <TableCell sx={{ width: 110 }}>Year</TableCell>
                    <TableCell sx={{ width: 220 }}>Prestige</TableCell>
                    <TableCell sx={{ width: 110 }}>Rating</TableCell>
                    <TableCell sx={{ width: 140 }}>Conference</TableCell>
                    <TableCell sx={{ width: 120 }}>Record</TableCell>
                    <TableCell sx={{ width: 100 }}>Rank</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.years.map((year: YearHistory) => (
                    <TableRow
                      key={year.year}
                      sx={{
                        '&:hover': {
                          bgcolor: `${data.team.colorSecondary || 'grey.100'}20`,
                        },
                        '&:nth-of-type(odd)': { bgcolor: 'rgba(0,0,0,0.015)' },
                      }}
                    >
                      <TableCell>
                        {year.has_games ? (
                          <Link
                            component="button"
                            onClick={() =>
                              navigate(`/${teamName || data.team.name}/schedule/${year.year}`)
                            }
                            sx={{
                              cursor: 'pointer',
                              textDecoration: 'none',
                              color: 'primary.main',
                              fontWeight: 'bold',
                              '&:hover': { textDecoration: 'underline' },
                            }}
                          >
                            {year.year}
                          </Link>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {year.year}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <PrestigeStars prestige={year.prestige} />
                      </TableCell>
                      <TableCell>
                        {year.rating != null ? (
                          <Chip size="small" variant="outlined" label={year.rating} sx={{ minWidth: 56 }} />
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {year.conference === 'Independent' ? (
                          <Typography variant="body2" color="text.secondary">Independent</Typography>
                        ) : (
                          <ConfLogo name={year.conference} size={30} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {year.wins}-{year.losses}
                          {year.rank === 1 && ' 🏆'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'inline-block',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            backgroundColor: year.rank <= 25 ? `${data.team.colorPrimary || 'primary.main'}` : 'transparent',
                            border:
                              year.rank <= 25 ? `1px solid ${data.team.colorPrimary || 'primary.main'}` : 'none',
                            color: year.rank <= 25 ? 'white' : 'text.secondary',
                            fontWeight: year.rank <= 25 ? 'bold' : 'normal',
                          }}
                        >
                          {getRankDisplay(year.rank)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Container>
      )}
    </PageLayout>
  );
};

export default TeamHistory;
