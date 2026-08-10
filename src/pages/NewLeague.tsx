import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  Paper,
  Step,
  StepButton,
  Stepper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { ROUTES } from '../constants/routes';
import {
  buildPreviewConferencePlan,
  resolvePreviewConferencePlan,
  validateNewLeagueConferencePlan,
} from '../domain/conferencePlan';
import { loadHomeData } from '../domain/league/loaders/season/loadHomeData';
import { loadNewLeagueData } from '../domain/league/loaders/season/loadNewLeagueData';
import { startNewLeague } from '../domain/league/loaders/season/startNewLeague';
import type {
  CustomConferencePlan,
  Info,
  PlayoffTeamCount,
} from '../types/domain';
import type { NewLeagueData, StartNewLeagueInput } from '../types/league';
import { AlignmentSection } from './new-league/AlignmentSection';
import { NewLeagueSummary } from './new-league/NewLeagueSummary';
import { PostseasonSection } from './new-league/PostseasonSection';
import { ProgramSection } from './new-league/ProgramSection';
import {
  CREATION_SECTIONS,
  canAccessCreationSection,
  getCreateActionLabel,
  type AlignmentMode,
  type CreationProgress,
  type CreationSection,
  type RulesTab,
} from './new-league/types';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const buildInput = (
  year: string,
  teamName: string,
  alignmentMode: AlignmentMode,
  plan: CustomConferencePlan,
  playoffTeams: PlayoffTeamCount,
  playoffAutobids: number,
  conferenceChampionsReceiveTopSeeds: boolean,
): StartNewLeagueInput => ({
  year,
  teamName,
  conferenceSetup:
    alignmentMode === 'custom'
      ? { mode: 'custom', plan }
      : { mode: 'historical' },
  playoff: {
    teams: playoffTeams,
    autobids: playoffTeams === 12 ? playoffAutobids : undefined,
    conferenceChampionsReceiveTopSeeds:
      playoffTeams === 12 ? conferenceChampionsReceiveTopSeeds : false,
  },
});

const NewLeague = () => {
  const navigate = useNavigate();
  const previewRequestId = useRef(0);
  const [data, setData] = useState<NewLeagueData | null>(null);
  const [savedLeagueInfo, setSavedLeagueInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [section, setSection] = useState<CreationSection>('program');
  const [rulesTab, setRulesTab] = useState<RulesTab>('alignment');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>('historical');
  const [conferencePlan, setConferencePlan] = useState<CustomConferencePlan>({
    assignments: {},
    conferenceGames: {},
  });
  const [planHistory, setPlanHistory] = useState<CustomConferencePlan[]>([]);
  const [advancedGames, setAdvancedGames] = useState(false);
  const [conferenceScheduleIssues, setConferenceScheduleIssues] = useState<string[]>([]);
  const [playoffTeams, setPlayoffTeams] = useState<PlayoffTeamCount>(12);
  const [playoffAutobids, setPlayoffAutobids] = useState(5);
  const [conferenceChampionsReceiveTopSeeds, setTopSeeds] = useState(true);
  const [progress, setProgress] = useState<CreationProgress>('idle');
  const [creationError, setCreationError] = useState<string | null>(null);

  const initializeFromPreview = useCallback((response: NewLeagueData) => {
    const preview = response.preview;
    if (!preview || !response.selectedYear) return;
    setSelectedYear(response.selectedYear);
    setSelectedTeam(null);
    setTeamSearch('');
    setAlignmentMode('historical');
    setConferencePlan(buildPreviewConferencePlan(preview));
    setPlanHistory([]);
    setAdvancedGames(false);
    setConferenceScheduleIssues([]);
    setPlayoffTeams(preview.playoff.teams);
    setPlayoffAutobids(preview.playoff.conf_champ_autobids);
    setTopSeeds(preview.playoff.conf_champ_top_4);
    setCreationError(null);
    setProgress('idle');
    setRulesTab('alignment');
    setSection('program');
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [response, home] = await Promise.all([
        loadNewLeagueData(),
        loadHomeData(),
      ]);
      setData(response);
      setSavedLeagueInfo(home.info);
      initializeFromPreview(response);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'New dynasty data could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [initializeFromPreview]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (loading) return;
    const headingId = section === 'program'
      ? 'new-league-program-heading'
      : rulesTab === 'alignment'
        ? 'new-league-alignment-heading'
        : 'new-league-postseason-heading';
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(headingId)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, rulesTab, section]);

  const preview = data?.preview ?? null;
  const resolvedPlan = useMemo(
    () => preview ? resolvePreviewConferencePlan(preview, conferencePlan) : null,
    [conferencePlan, preview],
  );
  const eligibleConferences = alignmentMode === 'custom'
    ? resolvedPlan?.activeConferences.length ?? 0
    : preview?.conferences.length ?? 0;

  useEffect(() => {
    if (playoffTeams !== 12) return;
    const maximum = Math.min(10, eligibleConferences);
    if (playoffAutobids > maximum) setPlayoffAutobids(maximum);
    if (conferenceChampionsReceiveTopSeeds && maximum < 4) setTopSeeds(false);
  }, [
    conferenceChampionsReceiveTopSeeds,
    eligibleConferences,
    playoffAutobids,
    playoffTeams,
  ]);

  const changeYear = async (year: string) => {
    const requestId = ++previewRequestId.current;
    setPreviewLoading(true);
    setCreationError(null);
    try {
      const response = await loadNewLeagueData(year);
      if (requestId !== previewRequestId.current) return;
      setData(response);
      initializeFromPreview(response);
    } catch (error) {
      if (requestId !== previewRequestId.current) return;
      setLoadError(getErrorMessage(error, `The ${year} season could not be loaded.`));
    } finally {
      if (requestId === previewRequestId.current) setPreviewLoading(false);
    }
  };

  const invalidateAlignment = () => {
    setConferenceScheduleIssues([]);
    setCreationError(null);
  };

  const updatePlan = (next: CustomConferencePlan) => {
    setPlanHistory(history => [...history, structuredClone(conferencePlan)].slice(-30));
    setConferencePlan(next);
    invalidateAlignment();
  };

  const undoPlan = () => {
    setPlanHistory(history => {
      const previous = history[history.length - 1];
      if (previous) setConferencePlan(previous);
      return history.slice(0, -1);
    });
    invalidateAlignment();
  };

  const resetPlan = () => {
    if (preview) updatePlan(buildPreviewConferencePlan(preview));
  };

  const structuralIssues = alignmentMode === 'custom'
    ? resolvedPlan?.issues.map(entry => entry.message) ?? []
    : [];
  const canValidateAlignment =
    alignmentMode === 'historical' || structuralIssues.length === 0;
  const busy = progress !== 'idle';
  const createReady =
    section === 'rules' && Boolean(selectedTeam) && canValidateAlignment;

  const goToSection = (next: CreationSection) => {
    if (busy) return;
    if (canAccessCreationSection(next, Boolean(selectedTeam))) {
      setSection(next);
    }
  };

  const handleBack = () => {
    if (section === 'rules') setSection('program');
  };

  const createLeague = async () => {
    if (!selectedTeam || !preview || !createReady || busy) return;
    setProgress('checking');
    setCreationError(null);
    setConferenceScheduleIssues([]);
    try {
      const validation = await validateNewLeagueConferencePlan(
        selectedYear,
        alignmentMode === 'historical'
          ? buildPreviewConferencePlan(preview)
          : conferencePlan,
      );
      if (validation.issues.length) {
        setConferenceScheduleIssues(
          validation.issues.map(entry => entry.message),
        );
        setRulesTab('alignment');
        window.requestAnimationFrame(() => {
          document.getElementById('new-league-alignment-errors')?.focus();
        });
        return;
      }

      setProgress('creating');
      await startNewLeague(buildInput(
        selectedYear,
        selectedTeam,
        alignmentMode,
        conferencePlan,
        playoffTeams,
        playoffAutobids,
        conferenceChampionsReceiveTopSeeds,
      ));
      navigate(ROUTES.NONCON);
    } catch (error) {
      setCreationError(getErrorMessage(error, 'The dynasty could not be created.'));
      window.requestAnimationFrame(() => {
        document.getElementById('new-league-creation-error')?.focus();
      });
    } finally {
      setProgress('idle');
    }
  };

  if (loading) return <PageLayout loading error={null}>{null}</PageLayout>;
  if (loadError || !data || !preview) {
    return (
      <PageLayout loading={false} error={null} containerMaxWidth="sm">
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h4">New dynasty could not be loaded</Typography>
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            {loadError ?? 'New dynasty data is unavailable.'}
          </Alert>
          <Button variant="contained" onClick={loadInitialData} sx={{ mt: 2 }}>Retry</Button>
        </Box>
      </PageLayout>
    );
  }

  const summary = (
    <NewLeagueSummary
      selectedYear={selectedYear}
      selectedTeam={selectedTeam}
      alignmentMode={alignmentMode}
      playoffTeams={playoffTeams}
      playoffAutobids={playoffAutobids}
      topSeeds={conferenceChampionsReceiveTopSeeds}
      ready={createReady}
      progress={progress}
      creationError={creationError}
      savedLeagueInfo={savedLeagueInfo}
      onCreate={() => void createLeague()}
    />
  );

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box component="header" sx={{ flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth="xl" sx={{ minHeight: { xs: 64, sm: 72 }, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button component={RouterLink} to={ROUTES.HOME} startIcon={<ArrowBackIcon />} color="inherit" disabled={busy}>
            Home
          </Button>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h5">Create a dynasty</Typography>
            <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
              Configure your starting world and program.
            </Typography>
          </Box>
        </Container>
      </Box>
      <Container maxWidth="xl" component="main" sx={{ flex: 1, minHeight: 0, display: 'flex', py: { xs: 1, sm: 2 } }}>
        <Box sx={{ width: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' }, gap: 2 }}>
          <Paper variant="outlined" sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Stepper activeStep={CREATION_SECTIONS.findIndex(item => item.id === section)} sx={{ flexShrink: 0, px: { xs: 1, sm: 2 }, py: 1 }}>
              {CREATION_SECTIONS.map(item => {
                const enabled = canAccessCreationSection(
                  item.id,
                  Boolean(selectedTeam),
                );
                const completed = item.id === 'program' && Boolean(selectedTeam);
                return (
                  <Step key={item.id} completed={completed} disabled={!enabled || busy}>
                    <StepButton onClick={() => goToSection(item.id)}>{item.label}</StepButton>
                  </Step>
                );
              })}
            </Stepper>
            {section === 'rules' && (
              <>
                <Divider />
                <Tabs value={rulesTab} onChange={(_, value: RulesTab) => setRulesTab(value)}>
                  <Tab value="alignment" label="Alignment" disabled={busy} />
                  <Tab value="postseason" label="Postseason" disabled={busy} />
                </Tabs>
              </>
            )}
            <Divider />
            <Box sx={{ flex: 1, minHeight: 0, overflowY: section === 'program' ? 'hidden' : 'auto', p: { xs: 2, sm: 2.5 } }}>
              {section === 'program' && (
                <ProgramSection
                  years={data.years}
                  selectedYear={selectedYear}
                  preview={preview}
                  selectedTeam={selectedTeam}
                  search={teamSearch}
                  loading={previewLoading}
                  onYearChange={year => void changeYear(year)}
                  onSearchChange={setTeamSearch}
                  onSelect={team => {
                    setSelectedTeam(team);
                    setCreationError(null);
                    setSection('rules');
                    setRulesTab('alignment');
                  }}
                />
              )}
              {section === 'rules' && rulesTab === 'alignment' && (
                <AlignmentSection
                  preview={preview}
                  mode={alignmentMode}
                  plan={conferencePlan}
                  issues={[...structuralIssues, ...conferenceScheduleIssues]}
                  resolvedGames={resolvedPlan?.conferenceGames ?? {}}
                  advanced={advancedGames}
                  canUndo={planHistory.length > 0}
                  selectedTeam={selectedTeam}
                  disabled={busy}
                  onModeChange={value => { setAlignmentMode(value); invalidateAlignment(); }}
                  onPlanChange={updatePlan}
                  onUndo={undoPlan}
                  onReset={resetPlan}
                  onAdvancedChange={setAdvancedGames}
                />
              )}
              {section === 'rules' && rulesTab === 'postseason' && (
                <PostseasonSection
                  preview={preview}
                  teams={playoffTeams}
                  autobids={playoffAutobids}
                  topSeeds={conferenceChampionsReceiveTopSeeds}
                  eligibleConferences={eligibleConferences}
                  disabled={busy}
                  onTeamsChange={value => {
                    setCreationError(null);
                    setPlayoffTeams(value);
                    if (value !== 12) { setPlayoffAutobids(0); setTopSeeds(false); }
                  }}
                  onAutobidsChange={value => {
                    setCreationError(null);
                    setPlayoffAutobids(value);
                  }}
                  onTopSeedsChange={value => {
                    setCreationError(null);
                    setTopSeeds(value);
                  }}
                />
              )}
              {section === 'rules' && creationError && (
                <Alert
                  id="new-league-creation-error"
                  severity="error"
                  sx={{ mt: 1.5 }}
                  aria-live="assertive"
                  tabIndex={-1}
                >
                  {creationError}
                </Alert>
              )}
            </Box>
            <Divider />
            <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1.5, sm: 2 }, py: 1.25 }}>
              <Button onClick={handleBack} disabled={section === 'program' || busy}>Back</Button>
              <Button
                startIcon={<SummarizeIcon />}
                onClick={() => setSummaryOpen(true)}
                disabled={busy}
                sx={{ display: { lg: 'none' }, ml: 'auto' }}
              >
                Summary
              </Button>
              <Box sx={{ flex: { xs: 0, lg: 1 } }} />
              {section === 'rules' && (
                <Button
                  variant="contained"
                  onClick={() => void createLeague()}
                  disabled={!createReady || busy}
                  sx={{ display: { xs: 'inline-flex', lg: 'none' } }}
                >
                  {getCreateActionLabel(progress)}
                </Button>
              )}
            </Box>
          </Paper>
          <Paper variant="outlined" sx={{ display: { xs: 'none', lg: 'block' }, minHeight: 0, p: 2.5 }}>
            {summary}
          </Paper>
        </Box>
      </Container>
      <Drawer
        anchor="bottom"
        open={summaryOpen}
        onClose={() => { if (!busy) setSummaryOpen(false); }}
        slotProps={{ paper: { sx: { maxHeight: '80dvh', p: 3 } } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button onClick={() => setSummaryOpen(false)} disabled={busy}>Close summary</Button>
        </Box>
        <Box sx={{ minHeight: 0, overflowY: 'auto' }}>
          <NewLeagueSummary
            selectedYear={selectedYear}
            selectedTeam={selectedTeam}
            alignmentMode={alignmentMode}
            playoffTeams={playoffTeams}
            playoffAutobids={playoffAutobids}
            topSeeds={conferenceChampionsReceiveTopSeeds}
            ready={createReady}
            progress={progress}
            creationError={creationError}
            savedLeagueInfo={savedLeagueInfo}
            showCreate={false}
            onCreate={() => void createLeague()}
          />
        </Box>
      </Drawer>
    </Box>
  );
};

export default NewLeague;
