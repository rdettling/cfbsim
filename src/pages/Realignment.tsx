import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { useDomainData } from '../domain/hooks';
import {
  normalizeNextSeasonConfiguration,
  updateNextSeasonConfiguration,
} from '../domain/league/nextSeasonConfiguration';
import { loadRealignment } from '../domain/league/loaders/loadRealignment';
import type { NextSeasonConfiguration } from '../types/domain';
import { OffseasonStageMismatchError } from '../types/league';
import type { RealignmentPageData } from '../types/pages';
import { ConferencePreviewPanel } from './next-season-setup/ConferencePreviewPanel';
import { NextSeasonConfigurationPanel } from './next-season-setup/NextSeasonConfigurationPanel';
import { NextSeasonHeader } from './next-season-setup/NextSeasonHeader';
import { PostseasonPreviewPanel } from './next-season-setup/PostseasonPreviewPanel';

type SetupTab = 'setup' | 'conferences' | 'postseason';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const Realignment = () => {
  const [configuration, setConfiguration] =
    useState<NextSeasonConfiguration | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SetupTab>('setup');
  const configurationSaveLock = useRef(false);

  const { data, loading, error, refetch } =
    useDomainData<RealignmentPageData>({
      fetcher: loadRealignment,
    });

  useEffect(() => {
    setConfiguration(data?.configuration ?? null);
  }, [data]);

  const handleConfigurationChange = async (
    patch: Partial<NextSeasonConfiguration>,
  ) => {
    if (!configuration || configurationSaveLock.current) return;
    configurationSaveLock.current = true;

    const previous = configuration;
    let optimistic: NextSeasonConfiguration;
    try {
      optimistic = normalizeNextSeasonConfiguration({
        ...configuration,
        ...patch,
      });
    } catch (configurationError) {
      setSaveStatus('error');
      setSaveError(
        configurationError instanceof Error
          ? configurationError.message
          : 'The configuration is invalid.',
      );
      configurationSaveLock.current = false;
      return;
    }

    setConfiguration(optimistic);
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const authoritative = await updateNextSeasonConfiguration(patch);
      setConfiguration(authoritative);
      setSaveStatus('saved');
    } catch (configurationError) {
      setConfiguration(previous);
      setSaveStatus('error');
      setSaveError(
        configurationError instanceof Error
          ? configurationError.message
          : 'The configuration could not be saved.',
      );
      if (configurationError instanceof OffseasonStageMismatchError) {
        await refetch();
      }
    } finally {
      configurationSaveLock.current = false;
    }
  };

  if (loading) {
    return (
      <PageLayout loading error={null}>
        {null}
      </PageLayout>
    );
  }

  if (error || !data) {
    return (
      <PageLayout
        loading={false}
        error={error || 'Next season setup could not be loaded.'}
      >
        {null}
      </PageLayout>
    );
  }

  const navigationData = {
    team: data.team,
    currentStage: data.info.stage,
    info: data.info,
    conferences: data.conferences,
    advanceDisabled:
      saveStatus === 'saving' || Boolean(data.previewError),
  };

  if (data.info.stage !== 'realignment') {
    return (
      <PageLayout
        loading={false}
        error={null}
        navbarData={navigationData}
        containerMaxWidth="lg"
      >
        <StageUnavailableState
          title="Next season setup unavailable"
          description="These choices are available only during the Next Season Setup stage."
          currentStage={data.info.stage}
        />
      </PageLayout>
    );
  }

  if (!configuration) {
    return (
      <PageLayout
        loading={false}
        error="Next season configuration could not be loaded."
        navbarData={navigationData}
      >
        {null}
      </PageLayout>
    );
  }

  const configurationPanel = (
    <NextSeasonConfigurationPanel
      configuration={configuration}
      saving={saveStatus === 'saving'}
      status={saveStatus}
      error={saveError}
      onChange={handleConfigurationChange}
    />
  );

  const previewUnavailable = (
    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h6">Historical preview unavailable</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {data.previewError ??
          'Historical data could not be prepared for this season.'}
      </Typography>
      <Button variant="outlined" onClick={refetch} sx={{ mt: 2 }}>
        Retry
      </Button>
    </Paper>
  );

  const conferencePanel = data.preview ? (
    <ConferencePreviewPanel
      changes={data.preview.conferenceChanges}
      policy={configuration.conferencePolicy}
    />
  ) : (
    previewUnavailable
  );

  const postseasonPanel = data.preview ? (
    <PostseasonPreviewPanel
      configuration={configuration}
      preview={data.preview}
    />
  ) : (
    previewUnavailable
  );

  return (
    <PageLayout
      loading={false}
      error={null}
      navbarData={navigationData}
      containerMaxWidth="xl"
      desktopViewportConstrained
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: { lg: 1 },
          minHeight: { lg: 0 },
        }}
      >
        <NextSeasonHeader
          targetYear={data.info.currentYear + 1}
          dataSource={data.preview?.dataSource}
          previewError={data.previewError}
        />

        <Box
          sx={{
            display: { xs: 'none', lg: 'grid' },
            gridTemplateColumns:
              'minmax(310px, 0.72fr) minmax(400px, 1.15fr) minmax(300px, 0.82fr)',
            gap: 1.25,
            flex: 1,
            minHeight: 0,
          }}
        >
          {configurationPanel}
          {conferencePanel}
          {postseasonPanel}
        </Box>

        <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
          <Tabs
            value={activeTab}
            onChange={(_, value: SetupTab) => setActiveTab(value)}
            variant="fullWidth"
            aria-label="Next season setup sections"
            sx={{ mb: 1.25 }}
          >
            <Tab value="setup" label="Setup" />
            <Tab value="conferences" label="Conferences" />
            <Tab value="postseason" label="Postseason" />
          </Tabs>
          {activeTab === 'setup' && configurationPanel}
          {activeTab === 'conferences' && conferencePanel}
          {activeTab === 'postseason' && postseasonPanel}
        </Box>

        {saveStatus === 'error' && saveError && activeTab !== 'setup' && (
          <Alert severity="error" sx={{ display: { lg: 'none' }, mt: 1 }}>
            {saveError}
          </Alert>
        )}
      </Box>
    </PageLayout>
  );
};

export default Realignment;
