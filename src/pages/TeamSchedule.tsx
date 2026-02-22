import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
  Stack,
  TableContainer,
  Paper,
  Link,
  Chip,
  Typography,
  Button,
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useDomainData } from '../domain/hooks';
import { loadTeamSchedule } from '../domain/league';
import type { TeamSchedulePageData } from '../types/pages';
import { TeamLogo, TeamInfoModal } from '../components/team/TeamComponents';
import TeamHeader from '../components/team/TeamHeader';
import { PageLayout } from '../components/layout/PageLayout';

const TeamSchedule = () => {
  const { teamName, year } = useParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');

  const parsedYear = year ? Number(year) : undefined;
  const selectedYear = parsedYear && !Number.isNaN(parsedYear) ? parsedYear : undefined;
  const { data, loading, error } = useDomainData<TeamSchedulePageData>({
    fetcher: () => loadTeamSchedule(teamName, selectedYear),
    deps: [teamName, year],
  });

  const handleTeamChange = (team: string) => {
    if (selectedYear) {
      navigate(`/${team}/schedule/${selectedYear}`);
    } else {
      navigate(`/${team}/schedule`);
    }
  };

  const handleYearChange = (newYear: number) => {
    const targetTeam = teamName ?? data?.team.name ?? '';
    if (!targetTeam) return;
    navigate(`/${targetTeam}/schedule/${newYear}`);
  };

  const resultStyles = {
    win: 'rgba(46, 125, 50, 0.15)',
    loss: 'rgba(211, 47, 47, 0.15)',
    neutral: 'inherit',
  };

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
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
    >
      {data && (
        <Container maxWidth={false} sx={{ px: { xs: 0, md: 1 } }}>
          <TeamHeader
            team={data.team}
            teams={data.teams}
            onTeamChange={handleTeamChange}
          />

          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography
                variant="h5"
                sx={{
                  pb: 1,
                  borderBottom: '2px solid',
                  borderColor: data.team.colorPrimary || 'primary.main',
                }}
              >
                {data.selected_year ?? data.info.currentYear} Season Schedule
              </Typography>
              {data.years.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 112 }}>
                  <InputLabel id="schedule-year-label">Year</InputLabel>
                  <Select
                    labelId="schedule-year-label"
                    value={data.selected_year ?? data.info.currentYear}
                    label="Year"
                    onChange={event => handleYearChange(Number(event.target.value))}
                  >
                    {data.years.map((yearOption: number) => (
                      <MenuItem key={yearOption} value={yearOption}>
                        {yearOption}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Box>

          <TableContainer component={Paper} elevation={2} sx={{ mb: 3, width: '100%' }}>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: data.team.colorPrimary || 'primary.main',
                    '& th': { color: 'white', fontWeight: 'bold' },
                  }}
                >
                  <TableCell>Week</TableCell>
                  <TableCell align="center">Loc</TableCell>
                  <TableCell>Opponent</TableCell>
                  <TableCell align="center">Rating</TableCell>
                  <TableCell align="center">Record</TableCell>
                  <TableCell align="center">Spread</TableCell>
                  <TableCell align="center">Result</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.schedule.map((game) => (
                  <TableRow
                    key={game.weekPlayed}
                    sx={{
                      backgroundColor:
                        game.result === 'W'
                          ? resultStyles.win
                          : game.result === 'L'
                            ? resultStyles.loss
                            : resultStyles.neutral,
                      '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.07)' },
                    }}
                  >
                    <TableCell>{game.weekPlayed}</TableCell>
                    <TableCell align="center">
                      {game.location ? (
                        <Chip
                          label={
                            game.location === 'Home'
                              ? 'H'
                              : game.location === 'Away'
                                ? 'A'
                                : 'N'
                          }
                          size="small"
                          color={
                            game.location === 'Home'
                              ? 'success'
                              : game.location === 'Away'
                                ? 'warning'
                                : 'default'
                          }
                          sx={{ fontWeight: 'bold' }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {game.opponent ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TeamLogo name={game.opponent.name} size={30} />
                          <Link
                            component="button"
                            onClick={() => {
                              setSelectedTeam(game.opponent!.name);
                              setModalOpen(true);
                            }}
                            sx={{
                              cursor: 'pointer',
                              textDecoration: 'none',
                              fontWeight: game.opponent.ranking <= 25 ? 'bold' : 'normal',
                            }}
                          >
                            {game.opponent.ranking <= 25 && `#${game.opponent.ranking} `}
                            {game.opponent.name}
                          </Link>
                        </Stack>
                      ) : (
                        <Typography color="text.secondary">Bye</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">{game.opponent?.rating ?? '-'}</TableCell>
                    <TableCell align="center">{game.opponent?.record ?? '-'}</TableCell>
                    <TableCell align="center">{game.spread || '-'}</TableCell>
                    <TableCell align="center">
                      {game.id ? (
                        <Button
                          component={RouterLink}
                          to={`/game/${game.id}`}
                          variant={game.result ? 'outlined' : 'contained'}
                          color={
                            game.result
                              ? game.result === 'W'
                                ? 'success'
                                : 'error'
                              : 'primary'
                          }
                          size="small"
                          sx={{ fontWeight: 700, minWidth: 94 }}
                        >
                          {game.result ? `${game.result}: ${game.score}` : 'Preview'}
                        </Button>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {game.label && (
                        <Chip
                          label={game.label}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ maxWidth: 320 }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TeamInfoModal
            teamName={selectedTeam}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        </Container>
      )}
    </PageLayout>
  );
};

export default TeamSchedule;
