import { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { useDomainData } from '../domain/hooks';
import { loadRecruitingSummary } from '../domain/league/loaders/loadRecruitingSummary';
import type { RecruitingSummaryPageData } from '../types/pages';
import { RecruitingClassDialog } from './recruiting-summary/RecruitingClassDialog';
import { RecruitingClassPanel } from './recruiting-summary/RecruitingClassPanel';
import { RecruitingPlayerRankings } from './recruiting-summary/RecruitingPlayerRankings';
import { RecruitingTeamRankings } from './recruiting-summary/RecruitingTeamRankings';
import { RecruitingUserSummary } from './recruiting-summary/RecruitingUserSummary';

type RecruitingTab = 'teams' | 'players';

const RecruitingSummary = () => {
  const theme = useTheme();
  const desktopLayout = useMediaQuery(theme.breakpoints.up('lg'));
  const [activeTab, setActiveTab] = useState<RecruitingTab>('teams');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamFilter, setTeamFilter] = useState<number | ''>('');
  const [positionFilter, setPositionFilter] = useState('');
  const [classDialogOpen, setClassDialogOpen] = useState(false);

  const { data, loading, error } =
    useDomainData<RecruitingSummaryPageData>({
      fetcher: loadRecruitingSummary,
    });

  const selectedTeam = data
    ? data.teamRankings.find(team => team.teamId === selectedTeamId) ??
      data.userTeam ??
      data.teamRankings[0] ??
      null
    : null;
  const filteredPlayers = useMemo(
    () =>
      data?.playerRankings.filter(
        player =>
          (!teamFilter || player.teamId === teamFilter) &&
          (!positionFilter || player.position === positionFilter),
      ) ?? [],
    [data, positionFilter, teamFilter],
  );

  const handleTeamSelect = (teamId: number) => {
    setSelectedTeamId(teamId);
    setActiveTab('teams');
    if (!desktopLayout) {
      setClassDialogOpen(true);
    }
  };

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
      {data &&
        (data.info.stage !== 'recruiting_summary' ? (
          <StageUnavailableState
            title="Recruiting summary unavailable"
            description="Final recruiting results are available only during the Recruiting Summary stage."
            currentStage={data.info.stage}
          />
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: { lg: 1 },
                minHeight: { lg: 0 },
              }}
            >
              <Box component="header" sx={{ mb: 1.25 }}>
                <Typography component="h1" variant="h4">
                  Recruiting Summary
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Final recruiting results for {data.info.currentYear}.
                  These recruits are already on their rosters; advancing
                  only opens Roster Cuts.
                </Typography>
              </Box>

              <RecruitingUserSummary
                teamName={data.team.name}
                result={data.userTeam}
              />

              {!data.userTeam && data.summary.totalRecruits > 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.25 }}
                >
                  {data.team.name} has no finalized recruits in this class.
                  National results remain available below.
                </Typography>
              )}

              {data.summary.totalRecruits === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="h6">
                    No recruiting results available
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    No finalized freshmen were returned for this season.
                  </Typography>
                </Paper>
              ) : (
                <>
                  <Paper variant="outlined" sx={{ mb: 1.25 }}>
                    <Tabs
                      value={activeTab}
                      onChange={(_, value: RecruitingTab) =>
                        setActiveTab(value)
                      }
                      aria-label="Recruiting result views"
                    >
                      <Tab
                        value="teams"
                        label={`Team Rankings (${data.teamRankings.length})`}
                      />
                      <Tab
                        value="players"
                        label={`Player Rankings (${data.playerRankings.length})`}
                      />
                    </Tabs>
                  </Paper>

                  {activeTab === 'teams' ? (
                    <Box
                      sx={{
                        display: { xs: 'block', lg: 'grid' },
                        gridTemplateColumns: {
                          lg: 'minmax(480px, 0.95fr) minmax(0, 1.05fr)',
                        },
                        gap: 1.25,
                        flex: { lg: 1 },
                        minHeight: { lg: 0 },
                      }}
                    >
                      <RecruitingTeamRankings
                        rankings={data.teamRankings}
                        selectedTeamId={selectedTeam?.teamId ?? null}
                        onSelect={handleTeamSelect}
                      />
                      <Box sx={{ display: { xs: 'none', lg: 'block' }, minHeight: 0 }}>
                        <RecruitingClassPanel team={selectedTeam} />
                      </Box>
                    </Box>
                  ) : (
                    <RecruitingPlayerRankings
                      players={filteredPlayers}
                      teams={data.teamRankings}
                      positions={data.positions}
                      teamFilter={teamFilter}
                      positionFilter={positionFilter}
                      filtersActive={Boolean(teamFilter || positionFilter)}
                      onTeamFilterChange={setTeamFilter}
                      onPositionFilterChange={setPositionFilter}
                      onTeamSelect={handleTeamSelect}
                    />
                  )}
                </>
              )}
            </Box>

            <RecruitingClassDialog
              open={classDialogOpen}
              team={selectedTeam}
              onClose={() => setClassDialogOpen(false)}
            />
          </>
        ))}
    </PageLayout>
  );
};

export default RecruitingSummary;
