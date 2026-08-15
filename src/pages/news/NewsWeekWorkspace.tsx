import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { NewsStoryCard } from '../../components/news/NewsStoryCard';
import type { NewsPageData } from '../../types/pages';

type NewsWeek = NewsPageData['weeks'][number];

const getWeekLabel = (week: number) => week === 0 ? 'Preseason' : `Week ${week}`;

const storyCountLabel = (count: number) => `${count} ${count === 1 ? 'story' : 'stories'}`;

const WeekNavigator = ({
  weeks,
  selectedWeek,
  onSelect,
}: {
  weeks: NewsPageData['weeks'];
  selectedWeek: number;
  onSelect: (week: number) => void;
}) => (
  <Paper
    component="nav"
    variant="outlined"
    aria-label="News weeks"
    sx={{
      display: { xs: 'none', lg: 'flex' },
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden',
    }}
  >
    <Box
      component="header"
      sx={{ px: 1.75, py: 1.1, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Typography variant="h6">Weeks</Typography>
    </Box>
    <Box
      component="ul"
      sx={{ flex: 1, minHeight: 0, overflowY: 'auto', listStyle: 'none', m: 0, p: 0 }}
    >
      {weeks.map(group => {
        const selected = group.week === selectedWeek;
        return (
          <Box component="li" key={group.week}>
            <Button
              fullWidth
              onClick={() => onSelect(group.week)}
              aria-current={selected ? 'true' : undefined}
              sx={{
                justifyContent: 'space-between',
                gap: 1,
                px: 1.5,
                py: 1.1,
                borderLeft: '3px solid',
                borderLeftColor: selected ? 'primary.main' : 'transparent',
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
                borderRadius: 0,
                color: 'text.primary',
                backgroundColor: selected ? 'action.selected' : 'transparent',
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 600 }}>
                {getWeekLabel(group.week)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {group.stories.length}
              </Typography>
            </Button>
          </Box>
        );
      })}
    </Box>
  </Paper>
);

const WeekStories = ({
  group,
  weeks,
  onSelect,
}: {
  group: NewsWeek;
  weeks: NewsPageData['weeks'];
  onSelect: (week: number) => void;
}) => {
  const label = getWeekLabel(group.week);

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={`${label} stories`}
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
    >
      <Stack
        component="header"
        direction="row"
        spacing={2}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 1.5, sm: 2 },
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography component="h2" variant="h6">{label}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {storyCountLabel(group.stories.length)}
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          label="Week"
          value={group.week}
          onChange={event => onSelect(Number(event.target.value))}
          sx={{ display: { xs: 'flex', lg: 'none' }, minWidth: 132 }}
        >
          {weeks.map(week => (
            <MenuItem key={week.week} value={week.week}>{getWeekLabel(week.week)}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box sx={{ flex: { lg: 1 }, minHeight: { lg: 0 }, overflowY: { lg: 'auto' } }}>
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
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
                sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <NewsStoryCard story={story} />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export const NewsWeekWorkspace = ({
  group,
  weeks,
  onSelect,
}: {
  group: NewsWeek;
  weeks: NewsPageData['weeks'];
  onSelect: (week: number) => void;
}) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '208px minmax(0, 1fr)' },
      gap: 1.5,
      flex: { lg: 1 },
      minHeight: { lg: 0 },
    }}
  >
    <WeekNavigator weeks={weeks} selectedWeek={group.week} onSelect={onSelect} />
    <WeekStories group={group} weeks={weeks} onSelect={onSelect} />
  </Box>
);
