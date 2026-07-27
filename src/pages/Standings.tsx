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
import { ConfLogo, TeamInfoModal } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import { loadStandings } from '../domain/league';
import type { StandingsPageData } from '../types/pages';
import { StandingsDesktopTable } from './standings/StandingsDesktopTable';
import { StandingsMobileList } from './standings/StandingsMobileList';

const Standings = () => {
  const { conference_name: conferenceName } = useParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');

  const { data, loading, error } = useDomainData<StandingsPageData>({
    fetcher: () => {
      if (!conferenceName) throw new Error('No conference specified');
      return loadStandings(conferenceName);
    },
    deps: [conferenceName],
  });

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const handleConferenceChange = (name: string) => {
    navigate(`/standings/${encodeURIComponent(name)}`);
  };

  const isIndependent = data?.conference === 'Independent';

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
      {data && (
        <>
          <Stack
            component="header"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              sx={{
                alignItems: 'center',
              }}
            >
              {!isIndependent && <ConfLogo name={data.conference} size={44} />}
              <Box>
                <Typography component="h1" variant="h4">
                  {isIndependent ? 'Independent Standings' : `${data.conference} Standings`}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {data.info.currentYear} season · Week {data.info.currentWeek}
                </Typography>
              </Box>
            </Stack>

            <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}>
              <InputLabel id="standings-conference-label">Conference</InputLabel>
              <Select
                labelId="standings-conference-label"
                value={data.conference}
                label="Conference"
                onChange={(event) => handleConferenceChange(event.target.value)}
              >
                {data.conferences
                  .filter((conference) => conference.confName.toLowerCase() !== 'independent')
                  .map((conference) => (
                    <MenuItem key={conference.confName} value={conference.confName}>
                      {conference.confName}
                    </MenuItem>
                  ))}
                <MenuItem value="Independent">Independent</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {data.teams.length > 0 ? (
            <>
              <StandingsDesktopTable
                teams={data.teams}
                isIndependent={isIndependent}
                onTeamClick={handleTeamClick}
              />
              <StandingsMobileList
                teams={data.teams}
                isIndependent={isIndependent}
                onTeamClick={handleTeamClick}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No standings available</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                There are no teams in the selected conference.
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

export default Standings;
