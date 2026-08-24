import { useEffect } from 'react';
import { Box, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { ROUTES } from '../constants/routes';
import { useDomainData } from '../domain/hooks';
import { loadNews } from '../domain/league/loaders/season/loadNews';
import type { NewsPageData } from '../types/pages';
import { NewsWeekWorkspace } from './news/NewsWeekWorkspace';

const getSelectedNewsWeek = (
  weeks: NewsPageData['weeks'],
  weekParam: string | null,
) => {
  const parsedWeek = weekParam === null || weekParam.trim() === ''
    ? Number.NaN
    : Number(weekParam);
  if (Number.isInteger(parsedWeek) && parsedWeek >= 0) {
    const requestedWeek = weeks.find(group => group.week === parsedWeek);
    if (requestedWeek) return requestedWeek;
  }
  return weeks[0] ?? null;
};

const News = () => {
  const { year: yearParam } = useParams<{ year?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedYear = yearParam ? Number(yearParam) : undefined;
  const selectedYear = parsedYear === undefined || Number.isInteger(parsedYear)
    ? parsedYear
    : Number.NaN;
  const { data, loading, error } = useDomainData<NewsPageData>({
    fetcher: () => {
      if (Number.isNaN(selectedYear)) throw new Error('Invalid news season.');
      return loadNews(selectedYear);
    },
    deps: [yearParam],
  });
  const selectedWeek = data
    ? getSelectedNewsWeek(data.weeks, searchParams.get('week'))
    : null;

  useEffect(() => {
    document.title = data ? `${data.year} League News` : 'League News';
    return () => { document.title = 'College Football'; };
  }, [data]);

  const selectWeek = (week: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('week', String(week));
    setSearchParams(next);
  };

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={data ?? undefined}
    >
      {data && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: { lg: 1 }, minHeight: { lg: 0 } }}>
          <Stack
            component="header"
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
              flexShrink: 0,
            }}
          >
            <Box>
              <Typography component="h1" variant="h4">League News</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                National stories from the {data.year} season
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              label="Season"
              value={data.year}
              onChange={event => navigate(`${ROUTES.NEWS}/${event.target.value}`)}
              sx={{ minWidth: 120 }}
            >
              {data.availableYears.map(year => (
                <MenuItem key={year} value={year}>{year}</MenuItem>
              ))}
            </TextField>
          </Stack>

          {selectedWeek ? (
            <NewsWeekWorkspace
              group={selectedWeek}
              weeks={data.weeks}
              onSelect={selectWeek}
            />
          ) : (
            <Paper
              variant="outlined"
              sx={{
                display: 'grid',
                placeItems: 'center',
                flex: { lg: 1 },
                p: 4,
                textAlign: 'center',
              }}
            >
              <Box>
                <Typography variant="h6">No stories from this season yet</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Stories will appear here as games and league events unfold.
                </Typography>
              </Box>
            </Paper>
          )}
        </Box>
      )}
    </PageLayout>
  );
};

export default News;
