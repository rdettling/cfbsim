import { useEffect } from 'react';
import { Box, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { NewsStoryCard } from '../components/news/NewsStoryCard';
import { PageLayout } from '../components/layout/PageLayout';
import { useDomainData } from '../domain/hooks';
import { loadNews } from '../domain/league/loaders/season/loadNews';
import type { NewsPageData } from '../types/pages';

const News = () => {
  const { year: yearParam } = useParams<{ year?: string }>();
  const navigate = useNavigate();
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

  useEffect(() => {
    document.title = data ? `${data.year} League News` : 'League News';
    return () => { document.title = 'College Football'; };
  }, [data]);

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="lg"
      navbarData={data ? {
        team: data.team,
        currentStage: data.info.stage,
        info: data.info,
        conferences: data.conferences,
      } : undefined}
    >
      {data && (
        <>
          <Stack
            component="header"
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
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
              onChange={event => navigate(`/news/${event.target.value}`)}
              sx={{ minWidth: 120 }}
            >
              {data.availableYears.map(year => (
                <MenuItem key={year} value={year}>{year}</MenuItem>
              ))}
            </TextField>
          </Stack>

          {data.weeks.length ? (
            <Stack spacing={1.5}>
              {data.weeks.map(group => (
                <Paper key={group.week} component="section" variant="outlined">
                  <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6">
                      {group.week === 0 ? 'Preseason' : `Week ${group.week}`}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <NewsStoryCard story={group.stories[0]} lead />
                  </Box>
                  {group.stories.length > 1 && (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {group.stories.slice(1).map(story => (
                        <Box
                          key={story.id}
                          sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}
                        >
                          <NewsStoryCard story={story} />
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6">No stories from this season yet</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Stories will appear here as games and league events unfold.
              </Typography>
            </Paper>
          )}
        </>
      )}
    </PageLayout>
  );
};

export default News;
