import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Step,
  StepButton,
  Stepper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { ROUTES } from '../constants/routes';
import { rivalryWarningKey } from '../domain/rivalryScheduling';
import {
  buildPreviewConferencePlan,
  resolvePreviewConferencePlan,
  validateNewLeagueConferencePlan,
} from '../domain/conferencePlan';
import { loadHomeData, startNewLeague } from '../domain/league';
import type {
  CustomConferencePlan,
  PlayoffTeamCount,
  PreviewData,
  RivalryPlanWarning,
} from '../types/domain';
import type { LaunchProps, StartNewLeagueInput } from '../types/league';
import { HomeLoadPanel } from './home/HomeLoadPanel';
import { ConferenceStep } from './home/newLeague/ConferenceStep';
import { PostseasonStep } from './home/newLeague/PostseasonStep';
import { ProgramStep } from './home/newLeague/ProgramStep';
import { ReviewStep } from './home/newLeague/ReviewStep';
import { SeasonStep } from './home/newLeague/SeasonStep';
import {
  clearNewLeagueDraft,
  loadNewLeagueDraft,
  saveNewLeagueDraft,
  type NewLeagueAlignmentMode,
  type NewLeagueDraft,
} from './home/newLeagueDraft';

type HomeTab = 'new' | 'load';
type AlignmentMode = NewLeagueAlignmentMode;

const STEPS = [
  'Starting season',
  'Program',
  'Conferences',
  'Postseason',
  'Review',
] as const;
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

const Home = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HomeTab>('new');
  const [data, setData] = useState<LaunchProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [step, setStep] = useState(0);
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
  const [rivalryWarnings, setRivalryWarnings] = useState<RivalryPlanWarning[]>([]);
  const [validatingConferences, setValidatingConferences] = useState(false);
  const [playoffTeams, setPlayoffTeams] = useState<PlayoffTeamCount>(12);
  const [playoffAutobids, setPlayoffAutobids] = useState(5);
  const [conferenceChampionsReceiveTopSeeds, setTopSeeds] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const initializeFromPreview = useCallback((
    response: LaunchProps,
    draft: NewLeagueDraft | null,
  ) => {
    const preview = response.preview;
    if (!preview || !response.selected_year) return;
    const historicalPlan = buildPreviewConferencePlan(preview);
    const validDraft =
      draft &&
      draft.year === response.selected_year &&
      Object.keys(draft.conferencePlan.assignments).length === preview.teams.length &&
      preview.teams.every(team => team.name in draft.conferencePlan.assignments) &&
      preview.conferences.every(
        conference => conference.name in draft.conferencePlan.conferenceGames,
      );

    setSelectedYear(response.selected_year);
    setConferencePlan(validDraft ? draft.conferencePlan : historicalPlan);
    setSelectedTeam(
      validDraft && preview.teams.some(team => team.name === draft.teamName)
        ? draft.teamName
        : null,
    );
    setAlignmentMode(validDraft ? draft.alignmentMode : 'historical');
    setPlayoffTeams(validDraft ? draft.playoffTeams : preview.playoff.teams);
    setPlayoffAutobids(
      validDraft ? draft.playoffAutobids : preview.playoff.conf_champ_autobids,
    );
    setTopSeeds(
      validDraft
        ? draft.conferenceChampionsReceiveTopSeeds
        : preview.playoff.conf_champ_top_4,
    );
    setStep(validDraft ? Math.max(0, Math.min(4, draft.step)) : 0);
    setPlanHistory([]);
    setConferenceScheduleIssues([]);
    setRivalryWarnings([]);
    setHydrated(true);
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const draft = loadNewLeagueDraft();
    try {
      let response: LaunchProps;
      try {
        response = await loadHomeData(draft?.year);
      } catch (error) {
        if (!draft) throw error;
        clearNewLeagueDraft();
        response = await loadHomeData();
      }
      setData(response);
      initializeFromPreview(response, response.selected_year === draft?.year ? draft : null);
    } catch (error) {
      clearNewLeagueDraft();
      setLoadError(getErrorMessage(error, 'Home data could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [initializeFromPreview]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const preview = data?.preview ?? null;
  const resolvedPlan = useMemo(
    () => preview
      ? resolvePreviewConferencePlan(preview, conferencePlan)
      : null,
    [conferencePlan, preview],
  );
  const eligibleConferences =
    alignmentMode === 'custom'
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

  useEffect(() => {
    if (!hydrated || !preview || !selectedYear) return;
    const draft: NewLeagueDraft = {
      year: selectedYear,
      step,
      teamName: selectedTeam,
      alignmentMode,
      conferencePlan,
      playoffTeams,
      playoffAutobids,
      conferenceChampionsReceiveTopSeeds,
    };
    saveNewLeagueDraft(draft);
  }, [
    alignmentMode,
    conferenceChampionsReceiveTopSeeds,
    conferencePlan,
    hydrated,
    playoffAutobids,
    playoffTeams,
    preview,
    selectedTeam,
    selectedYear,
    step,
  ]);

  const changeYear = async (year: string) => {
    setPreviewLoading(true);
    setCreationError(null);
    setHydrated(false);
    clearNewLeagueDraft();
    try {
      const response = await loadHomeData(year);
      setData(response);
      setTeamSearch('');
      initializeFromPreview(response, null);
    } catch (error) {
      setLoadError(getErrorMessage(error, `The ${year} season could not be loaded.`));
    } finally {
      setPreviewLoading(false);
    }
  };

  const updatePlan = (next: CustomConferencePlan) => {
    setPlanHistory(history => [...history, structuredClone(conferencePlan)].slice(-30));
    setConferenceScheduleIssues([]);
    setRivalryWarnings([]);
    setConferencePlan(next);
  };

  const undoPlan = () => {
    setConferenceScheduleIssues([]);
    setRivalryWarnings([]);
    setPlanHistory(history => {
      const previous = history[history.length - 1];
      if (previous) setConferencePlan(previous);
      return history.slice(0, -1);
    });
  };

  const resetPlan = () => {
    if (!preview) return;
    updatePlan(buildPreviewConferencePlan(preview));
  };

  const validateConferencesAndContinue = async () => {
    if (!preview) return;
    if (
      alignmentMode === 'custom' &&
      (!resolvedPlan || resolvedPlan.issues.length)
    ) {
      return;
    }
    setValidatingConferences(true);
    setConferenceScheduleIssues([]);
    try {
      const result = await validateNewLeagueConferencePlan(
        selectedYear,
        alignmentMode === 'historical'
          ? buildPreviewConferencePlan(preview)
          : conferencePlan,
      );
      const warningKeys = result.warnings.map(rivalryWarningKey).sort();
      const existingWarningKeys = rivalryWarnings.map(rivalryWarningKey).sort();
      const sameWarnings =
        warningKeys.length === existingWarningKeys.length &&
        warningKeys.every((key, index) => key === existingWarningKeys[index]);
      setRivalryWarnings(result.warnings);
      if (result.issues.length) {
        setConferenceScheduleIssues(result.issues.map(entry => entry.message));
        return;
      }
      if (result.warnings.length && !sameWarnings) return;
      setStep(3);
    } catch (error) {
      setConferenceScheduleIssues([
        getErrorMessage(error, 'The proposed schedule could not be validated.'),
      ]);
    } finally {
      setValidatingConferences(false);
    }
  };

  const createLeague = async () => {
    if (!selectedTeam || !preview) return;
    setCreating(true);
    setCreationError(null);
    try {
      await startNewLeague(
        buildInput(
          selectedYear,
          selectedTeam,
          alignmentMode,
          conferencePlan,
          playoffTeams,
          playoffAutobids,
          conferenceChampionsReceiveTopSeeds,
        ),
      );
      clearNewLeagueDraft();
      navigate(ROUTES.NONCON);
    } catch (error) {
      setCreationError(getErrorMessage(error, 'The league could not be created.'));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <PageLayout loading error={null}>{null}</PageLayout>;
  }
  if (loadError || !data || !preview) {
    return (
      <PageLayout loading={false} error={null} containerMaxWidth="sm">
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h4">Home could not be loaded</Typography>
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            {loadError ?? 'Home data is unavailable.'}
          </Alert>
          <Button variant="contained" onClick={loadInitialData} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Box>
      </PageLayout>
    );
  }

  const canContinueConferences =
    alignmentMode === 'historical' || resolvedPlan?.issues.length === 0;

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ pt: 2.5, px: 2, textAlign: 'center' }}>
        <Typography component="h1" variant="h3">CFB Sim</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Build a college football dynasty across history.
        </Typography>
      </Box>
      <Tabs
        value={activeTab}
        onChange={(_, value: HomeTab) => !creating && setActiveTab(value)}
        centered
        sx={{ mt: 1, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab value="new" label="New league" disabled={creating} />
        <Tab value="load" label="Load game" disabled={creating} />
      </Tabs>
      <Container maxWidth="xl" sx={{ py: 2.5, flex: 1 }}>
        {activeTab === 'load' ? (
          <HomeLoadPanel info={data.info} onStartNew={() => setActiveTab('new')} />
        ) : (
          <Stack spacing={2}>
            <Stepper
              activeStep={step}
              alternativeLabel
              nonLinear
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              {STEPS.map((label, index) => (
                <Step key={label} completed={index < step}>
                  <StepButton
                    onClick={() => {
                      if (index <= step) setStep(index);
                    }}
                  >
                    {label}
                  </StepButton>
                </Step>
              ))}
            </Stepper>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                Step {step + 1} of {STEPS.length}
              </Typography>
              {step === 0 && (
                <SeasonStep
                  years={data.years}
                  selectedYear={selectedYear}
                  loading={previewLoading}
                  onYearChange={changeYear}
                  onContinue={() => setStep(1)}
                />
              )}
              {step === 1 && (
                <ProgramStep
                  preview={preview}
                  selectedTeam={selectedTeam}
                  search={teamSearch}
                  onSearchChange={setTeamSearch}
                  onSelect={setSelectedTeam}
                  onBack={() => setStep(0)}
                  onContinue={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <ConferenceStep
                  preview={preview}
                  mode={alignmentMode}
                  plan={conferencePlan}
                  issues={[
                    ...(resolvedPlan?.issues.map(entry => entry.message) ?? []),
                    ...conferenceScheduleIssues,
                  ]}
                  warnings={rivalryWarnings}
                  resolvedGames={resolvedPlan?.conferenceGames ?? {}}
                  advanced={advancedGames}
                  canUndo={planHistory.length > 0}
                  onModeChange={value => {
                    setAlignmentMode(value);
                    setConferenceScheduleIssues([]);
                    setRivalryWarnings([]);
                  }}
                  onPlanChange={updatePlan}
                  onUndo={undoPlan}
                  onReset={resetPlan}
                  onAdvancedChange={setAdvancedGames}
                  onBack={() => setStep(1)}
                  onContinue={() => void validateConferencesAndContinue()}
                  canContinue={canContinueConferences && !validatingConferences}
                  validating={validatingConferences}
                  selectedTeam={selectedTeam}
                />
              )}
              {step === 3 && (
                <PostseasonStep
                  preview={preview}
                  teams={playoffTeams}
                  autobids={playoffAutobids}
                  topSeeds={conferenceChampionsReceiveTopSeeds}
                  eligibleConferences={eligibleConferences}
                  onTeamsChange={value => {
                    setPlayoffTeams(value);
                    if (value !== 12) {
                      setPlayoffAutobids(0);
                      setTopSeeds(false);
                    }
                  }}
                  onAutobidsChange={setPlayoffAutobids}
                  onTopSeedsChange={setTopSeeds}
                  onBack={() => setStep(2)}
                  onContinue={() => setStep(4)}
                />
              )}
              {step === 4 && (
                <ReviewStep
                  preview={preview}
                  info={data.info}
                  selectedYear={selectedYear}
                  selectedTeam={selectedTeam}
                  alignmentMode={alignmentMode}
                  plan={conferencePlan}
                  resolvedGames={resolvedPlan?.conferenceGames ?? {}}
                  rivalryWarnings={rivalryWarnings}
                  playoffTeams={playoffTeams}
                  playoffAutobids={playoffAutobids}
                  topSeeds={conferenceChampionsReceiveTopSeeds}
                  creating={creating}
                  error={creationError}
                  onBack={() => setStep(3)}
                  onCreate={createLeague}
                />
              )}
            </Paper>
          </Stack>
        )}
      </Container>
    </Box>
  );
};


export default Home;
