import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import { loadWeekSchedule } from '../domain/league';
import type { WeekSchedulePageData } from '../types/pages';
import { WeekScheduleGameCard } from './week-schedule/WeekScheduleGameCard';

const WeekSchedule = () => {
  const { week } = useParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');

  const parsedWeek = Number(week);
  const selectedWeek =
    Number.isInteger(parsedWeek) && parsedWeek > 0 ? parsedWeek : null;

  const { data, loading, error } = useDomainData<WeekSchedulePageData>({
    fetcher: () => {
      if (selectedWeek === null) {
        throw new Error('Invalid week number');
      }
      return loadWeekSchedule(selectedWeek);
    },
    deps: [week],
  });

  useEffect(() => {
    document.title = selectedWeek
      ? `Week ${selectedWeek} Schedule`
      : 'College Football';
    return () => {
      document.title = 'College Football';
    };
  }, [selectedWeek]);

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const navigateToWeek = (newWeek: number) => {
    navigate(`/schedule/${newWeek}`);
  };

  const atFirstWeek = selectedWeek === 1;
  const atLastWeek = Boolean(
    data && selectedWeek !== null && selectedWeek >= data.info.lastWeek
  );

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
      desktopViewportConstrained
    >
      {data && selectedWeek !== null && (
        <>
          <Box
            component="header"
            sx={{
              display: 'grid',
              gridTemplateColumns: '40px minmax(0, 1fr) 40px',
              gap: 1,
              alignItems: 'center',
              mb: 1.5,
            }}
          >
            <Tooltip title="Previous week">
              <span>
                <IconButton
                  aria-label="Previous week"
                  disabled={atFirstWeek}
                  onClick={() => navigateToWeek(selectedWeek - 1)}
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <ChevronLeftIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Box sx={{ minWidth: 0, textAlign: 'center' }}>
              <Typography
                component="h1"
                variant="h4"
                sx={{ fontSize: { xs: '1.7rem', sm: '2.125rem' } }}
              >
                Week {selectedWeek}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {data.info.currentYear} season · {data.games.length}{' '}
                {data.games.length === 1 ? 'game' : 'games'}
              </Typography>
            </Box>

            <Tooltip title="Next week">
              <span>
                <IconButton
                  aria-label="Next week"
                  disabled={atLastWeek}
                  onClick={() => navigateToWeek(selectedWeek + 1)}
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <ChevronRightIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {data.games.length > 0 ? (
            <Box
              component="section"
              aria-label={`Week ${selectedWeek} games`}
              sx={{
                flex: { lg: 1 },
                minHeight: { lg: 0 },
                overflowX: 'hidden',
                overflowY: { lg: 'auto' },
                pr: { lg: 0.5 },
              }}
            >
              <Grid container spacing={1.5}>
                {data.games.map((game) => (
                  <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={game.id}>
                    <WeekScheduleGameCard
                      game={game}
                      onTeamClick={handleTeamClick}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No games scheduled</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                There are no games scheduled for Week {selectedWeek}.
              </Typography>
            </Paper>
          )}

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

export default WeekSchedule;
