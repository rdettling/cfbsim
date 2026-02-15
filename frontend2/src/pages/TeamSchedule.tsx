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
} from '@mui/material';
import { useDomainData } from '../domain/hooks';
import { loadTeamSchedule } from '../domain/league';
import type { Conference, Info, ScheduleGame, Team } from '../types/domain';
import { TeamLogo, TeamInfoModal } from '../components/team/TeamComponents';
import TeamHeader from '../components/team/TeamHeader';
import { PageLayout } from '../components/layout/PageLayout';

interface ScheduleData {
  info: Info;
  team: Team;
  games: ScheduleGame[];
  conferences: Conference[];
  teams: string[];
}

const TeamSchedule = () => {
  const { teamName } = useParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');

  const { data, loading, error } = useDomainData<ScheduleData>({
    fetcher: () => loadTeamSchedule(teamName),
    deps: [teamName],
  });

  const handleTeamChange = (team: string) => {
    navigate(`/${team}/schedule`);
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
        <>
          <TeamHeader
            team={data.team}
            teams={data.teams}
            onTeamChange={handleTeamChange}
          />

          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h5"
              sx={{
                mb: 2,
                pb: 1,
                borderBottom: '2px solid',
                borderColor: data.team.colorPrimary || 'primary.main',
              }}
            >
              Season Schedule
            </Typography>
          </Box>

          <TableContainer component={Paper} elevation={3} sx={{ mb: 4 }}>
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
                {data.games.map((game: ScheduleGame) => (
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
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                          {game.result ? (
                            <Chip
                              label={`${game.result}: ${game.score}`}
                              color={game.result === 'W' ? 'success' : 'error'}
                              variant="outlined"
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          ) : (
                            <Chip label="Preview" size="small" variant="outlined" />
                          )}
                          <Button
                            component={RouterLink}
                            to={`/game/${game.id}`}
                            variant="text"
                            size="small"
                            sx={{ fontWeight: 600 }}
                          >
                            {game.result ? 'Summary' : 'Preview'}
                          </Button>
                        </Stack>
                      ) : (
                        <Button variant="outlined" size="small" disabled>
                          Preview
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {game.label && (
                        <Chip
                          label={game.label}
                          size="small"
                          color="primary"
                          variant="outlined"
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
        </>
      )}
    </PageLayout>
  );
};

export default TeamSchedule;
