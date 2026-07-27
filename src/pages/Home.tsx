import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Container, Tab, Tabs, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { ROUTES } from '../constants/routes';
import { loadHomeData, startNewLeague } from '../domain/league';
import type { PlayoffTeamCount, PreviewData } from '../types/domain';
import type { LaunchProps, StartNewLeagueInput } from '../types/league';
import { HomeLoadPanel } from './home/HomeLoadPanel';
import { HomeSetupPanel } from './home/HomeSetupPanel';
import { HomeTeamBrowser } from './home/HomeTeamBrowser';

type HomeTab = 'new' | 'load';
type MobileStep = 'setup' | 'team';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const Home = () => {
  const navigate = useNavigate();
  const previewRequestId = useRef(0);
  const creationLock = useRef(false);
  const setupHeadingRef = useRef<HTMLHeadingElement>(null);
  const setupErrorRef = useRef<HTMLDivElement>(null);
  const mobileTeamHeadingRef = useRef<HTMLHeadingElement>(null);
  const desktopCreationErrorRef = useRef<HTMLDivElement>(null);
  const mobileCreationErrorRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<HomeTab>('new');
  const [mobileStep, setMobileStep] = useState<MobileStep>('setup');
  const [data, setData] = useState<LaunchProps | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedConference, setSelectedConference] = useState('ALL');
  const [teamSearch, setTeamSearch] = useState('');
  const [playoffTeams, setPlayoffTeams] = useState<PlayoffTeamCount>(12);
  const [playoffAutobids, setPlayoffAutobids] = useState(5);
  const [conferenceChampionsReceiveTopSeeds, setConferenceChampionsReceiveTopSeeds] =
    useState(true);
  const [creatingTeam, setCreatingTeam] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<StartNewLeagueInput | null>(null);

  const applyPreviewDefaults = useCallback((preview: PreviewData) => {
    setPlayoffTeams(preview.playoff.teams);
    setPlayoffAutobids(preview.playoff.conf_champ_autobids);
    setConferenceChampionsReceiveTopSeeds(preview.playoff.conf_champ_top_4);
  }, []);

  const loadInitialData = useCallback(async () => {
    setInitialLoading(true);
    setInitialError(null);
    try {
      const response = await loadHomeData();
      setData(response);
      setSelectedYear(response.selected_year ?? '');
      if (response.preview) {
        applyPreviewDefaults(response.preview);
      }
    } catch (error) {
      setInitialError(getErrorMessage(error, 'Home data could not be loaded.'));
    } finally {
      setInitialLoading(false);
    }
  }, [applyPreviewDefaults]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const loadYearPreview = async (year: string) => {
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;
    setSelectedYear(year);
    setSelectedConference('ALL');
    setTeamSearch('');
    setMobileStep('setup');
    setPreviewLoading(true);
    setPreviewError(null);
    setCreationError(null);
    setData((current) => (current ? { ...current, preview: null, selected_year: year } : current));

    try {
      const response = await loadHomeData(year);
      if (previewRequestId.current !== requestId) return;
      setData(response);
      if (response.preview) {
        applyPreviewDefaults(response.preview);
      }
    } catch (error) {
      if (previewRequestId.current !== requestId) return;
      setPreviewError(getErrorMessage(error, `The ${year} season could not be loaded.`));
      requestAnimationFrame(() => setupErrorRef.current?.focus());
    } finally {
      if (previewRequestId.current === requestId) {
        setPreviewLoading(false);
      }
    }
  };

  const handlePlayoffTeamsChange = (teams: PlayoffTeamCount) => {
    setPlayoffTeams(teams);
    if (teams === 12) {
      setPlayoffAutobids(5);
      setConferenceChampionsReceiveTopSeeds(true);
    } else {
      setPlayoffAutobids(0);
      setConferenceChampionsReceiveTopSeeds(false);
    }
  };

  const handleTopSeedsChange = (enabled: boolean) => {
    setConferenceChampionsReceiveTopSeeds(enabled);
    if (enabled && playoffAutobids < 4) {
      setPlayoffAutobids(4);
    }
  };

  const runCreation = async (input: StartNewLeagueInput) => {
    if (creationLock.current) return;
    creationLock.current = true;
    setLastAttempt(input);
    setCreatingTeam(input.teamName);
    setCreationError(null);
    try {
      await startNewLeague(input);
      navigate(ROUTES.NONCON);
    } catch (error) {
      const message = getErrorMessage(error, 'The league could not be created.');
      setCreationError(data?.info ? `${message} Your existing save is unchanged.` : message);
      setCreatingTeam(null);
      requestAnimationFrame(() => {
        const visibleError = [desktopCreationErrorRef.current, mobileCreationErrorRef.current].find(
          (element) => element && element.offsetParent !== null,
        );
        visibleError?.focus();
      });
    } finally {
      creationLock.current = false;
    }
  };

  const handleStart = (team: PreviewData['teams'][number]) => {
    void runCreation({
      teamName: team.name,
      year: selectedYear,
      playoff: {
        teams: playoffTeams,
        autobids: playoffTeams === 12 ? playoffAutobids : undefined,
        conferenceChampionsReceiveTopSeeds:
          playoffTeams === 12 ? conferenceChampionsReceiveTopSeeds : false,
      },
    });
  };

  if (initialLoading) {
    return (
      <PageLayout loading error={null}>
        {null}
      </PageLayout>
    );
  }

  if (initialError || !data) {
    return (
      <PageLayout loading={false} error={null} containerMaxWidth="sm">
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h4">Home could not be loaded</Typography>
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            {initialError ?? 'Home data is unavailable.'}
          </Alert>
          <Button variant="contained" onClick={loadInitialData} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Box>
      </PageLayout>
    );
  }

  const teamStepActive = activeTab === 'new' && mobileStep === 'team';
  const creationLocked = Boolean(creatingTeam);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        height: {
          xs: teamStepActive ? '100dvh' : 'auto',
          lg: '100vh',
        },
        overflow: {
          xs: teamStepActive ? 'hidden' : 'visible',
          lg: 'hidden',
        },
      }}
    >
      <Box sx={{ pt: { xs: 2, lg: 2.5 }, px: 2, textAlign: 'center' }}>
        <Typography
          component="h1"
          variant="h3"
          sx={{ fontSize: { xs: '2rem', sm: '2.5rem', lg: '3rem' } }}
        >
          CFB Sim
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            display: { xs: teamStepActive ? 'none' : 'block', sm: 'block' },
          }}
        >
          Build a college football dynasty across history.
        </Typography>
      </Box>
      <Tabs
        value={activeTab}
        onChange={(_, value: HomeTab) => {
          if (!creationLocked) setActiveTab(value);
        }}
        centered
        selectionFollowsFocus
        aria-label="Home options"
        sx={{ mt: 1, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab value="new" label="New league" disabled={creationLocked} />
        <Tab value="load" label="Load game" disabled={creationLocked} />
      </Tabs>
      <Container
        maxWidth="xl"
        sx={{
          py: { xs: 2, lg: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          flex: { xs: teamStepActive ? 1 : 'initial', lg: 1 },
          minHeight: { xs: teamStepActive ? 0 : 'auto', lg: 0 },
        }}
      >
        {activeTab === 'load' ? (
          <HomeLoadPanel info={data.info} onStartNew={() => setActiveTab('new')} />
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            {data.info && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                Starting a new league replaces the saved {data.info.currentYear} {data.info.team}{' '}
                league.
              </Alert>
            )}

            <Box
              sx={{
                display: { xs: mobileStep === 'setup' ? 'block' : 'none', lg: 'grid' },
                gridTemplateColumns: { lg: 'minmax(310px, 0.38fr) minmax(0, 1fr)' },
                gap: 1.5,
                flex: { lg: 1 },
                minHeight: { lg: 0 },
              }}
            >
              <HomeSetupPanel
                years={data.years}
                selectedYear={selectedYear}
                playoffTeams={playoffTeams}
                playoffAutobids={playoffAutobids}
                conferenceChampionsReceiveTopSeeds={conferenceChampionsReceiveTopSeeds}
                preview={data.preview}
                loading={previewLoading}
                error={previewError}
                headingRef={setupHeadingRef}
                errorRef={setupErrorRef}
                onYearChange={(year) => void loadYearPreview(year)}
                onPlayoffTeamsChange={handlePlayoffTeamsChange}
                onPlayoffAutobidsChange={setPlayoffAutobids}
                onTopSeedsChange={handleTopSeedsChange}
                onRetry={() => void loadYearPreview(selectedYear)}
                onContinue={() => {
                  setMobileStep('team');
                  requestAnimationFrame(() => mobileTeamHeadingRef.current?.focus());
                }}
              />

              {data.preview && (
                <Box sx={{ display: { xs: 'none', lg: 'flex' }, minHeight: 0 }}>
                  <HomeTeamBrowser
                    preview={data.preview}
                    selectedConference={selectedConference}
                    search={teamSearch}
                    creatingTeam={creatingTeam}
                    creationError={creationError}
                    errorRef={desktopCreationErrorRef}
                    onConferenceChange={setSelectedConference}
                    onSearchChange={setTeamSearch}
                    onStart={handleStart}
                    onRetry={() => {
                      if (lastAttempt) void runCreation(lastAttempt);
                    }}
                    onBack={() => {
                      setMobileStep('setup');
                      requestAnimationFrame(() => setupHeadingRef.current?.focus());
                    }}
                  />
                </Box>
              )}
            </Box>

            {mobileStep === 'team' && data.preview && (
              <Box
                sx={{
                  display: { xs: 'flex', lg: 'none' },
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <HomeTeamBrowser
                  preview={data.preview}
                  selectedConference={selectedConference}
                  search={teamSearch}
                  creatingTeam={creatingTeam}
                  creationError={creationError}
                  headingRef={mobileTeamHeadingRef}
                  errorRef={mobileCreationErrorRef}
                  onConferenceChange={setSelectedConference}
                  onSearchChange={setTeamSearch}
                  onStart={handleStart}
                  onRetry={() => {
                    if (lastAttempt) void runCreation(lastAttempt);
                  }}
                  onBack={() => {
                    setMobileStep('setup');
                    requestAnimationFrame(() => setupHeadingRef.current?.focus());
                  }}
                />
              </Box>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default Home;
