import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Container, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { loadHomeData } from '../domain/league';
import type { HomeData } from '../types/league';
import { HomeContent } from './home/HomeContent';

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : 'Home data could not be loaded.';

const Home = () => {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadHomeData());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return <PageLayout loading error={null}>{null}</PageLayout>;
  }

  if (error || !data) {
    return (
      <PageLayout loading={false} error={null} containerMaxWidth="sm">
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h4">Home could not be loaded</Typography>
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            {error ?? 'Home data is unavailable.'}
          </Alert>
          <Button variant="contained" onClick={loadData} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Box>
      </PageLayout>
    );
  }

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        component="header"
        sx={{
          flexShrink: 0,
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            minHeight: { xs: 72, sm: 88 },
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src="/logos/football.png"
              alt=""
              aria-hidden="true"
              sx={{ width: { xs: 44, sm: 52 }, height: 'auto', flexShrink: 0 }}
            />
            <Box>
              <Typography component="h1" variant="h4">CFB Sim</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                Build a college football dynasty across history.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
      <Container
        component="main"
        maxWidth="lg"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'flex-start',
          pt: { xs: 1, sm: 2.5, md: 4 },
          pb: { xs: 1, sm: 2.5, md: 4 },
        }}
      >
        <HomeContent data={data} />
      </Container>
    </Box>
  );
};

export default Home;
