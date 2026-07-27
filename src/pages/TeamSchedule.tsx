import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import TeamHeader from '../components/team/TeamHeader';
import { TeamInfoModal } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import { loadTeamSchedule } from '../domain/league';
import type { TeamSchedulePageData } from '../types/pages';
import { DesktopScheduleTable } from './team-schedule/DesktopScheduleTable';
import { MobileScheduleList } from './team-schedule/MobileScheduleList';

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

  const handleOpponentClick = (team: string) => {
    setSelectedTeam(team);
    setModalOpen(true);
  };

  const seasonYear = data?.selected_year ?? data?.info.currentYear;

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
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
      {data && seasonYear && (
        <>
          <TeamHeader
            team={data.team}
            teams={data.teams}
            onTeamChange={handleTeamChange}
          />

          <Stack
            component="header"
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography component="h2" variant="h5" sx={{ fontWeight: 600 }}>
                Schedule
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {seasonYear} season
              </Typography>
            </Box>
            {data.years.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 112 }}>
                <InputLabel id="schedule-year-label">Year</InputLabel>
                <Select
                  labelId="schedule-year-label"
                  value={seasonYear}
                  label="Year"
                  onChange={(event) => handleYearChange(Number(event.target.value))}
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

          {data.schedule.length > 0 ? (
            <>
              <DesktopScheduleTable
                games={data.schedule}
                seasonYear={seasonYear}
                onOpponentClick={handleOpponentClick}
              />
              <MobileScheduleList
                games={data.schedule}
                seasonYear={seasonYear}
                onOpponentClick={handleOpponentClick}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No schedule available</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                There are no games for the selected season.
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

export default TeamSchedule;
