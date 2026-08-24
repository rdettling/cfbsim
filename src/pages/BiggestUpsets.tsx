import { useEffect, useMemo, useState } from 'react';
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
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import {
  BIGGEST_UPSET_MAX_WIN_PROBABILITY,
  loadBiggestUpsets,
} from '../domain/league/loaders/biggestUpsets';
import type { BiggestUpsetsPageData } from '../types/pages';
import { BiggestUpsetsDesktopTable } from './biggest-upsets/BiggestUpsetsDesktopTable';
import { BiggestUpsetsMobileList } from './biggest-upsets/BiggestUpsetsMobileList';
import {
  sortBiggestUpsets,
  type BiggestUpsetsSortKey,
} from './biggest-upsets/sorting';

const BiggestUpsets = () => {
  const [sortKey, setSortKey] = useState<BiggestUpsetsSortKey>('week');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<BiggestUpsetsPageData>({
    fetcher: loadBiggestUpsets,
    deps: [],
  });
  const upsets = useMemo(
    () => sortBiggestUpsets(data?.upsets ?? [], sortKey),
    [data?.upsets, sortKey],
  );

  useEffect(() => {
    document.title = 'Biggest Upsets';
    return () => { document.title = 'College Football'; };
  }, []);

  const openTeam = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };
  const threshold = `${BIGGEST_UPSET_MAX_WIN_PROBABILITY * 100}%`;

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={data ?? undefined}
    >
      {data && (
        <>
          <Stack
            component="header"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', mb: 1.5 }}
          >
            <Box>
              <Typography component="h1" variant="h4">Biggest Upsets</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {data.info.currentYear} season · {upsets.length} qualifying {upsets.length === 1 ? 'upset' : 'upsets'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Completed games won by teams with a pregame win probability of {threshold} or lower.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 250 } }}>
              <InputLabel id="biggest-upsets-sort-label">Sort by</InputLabel>
              <Select
                labelId="biggest-upsets-sort-label"
                value={sortKey}
                label="Sort by"
                onChange={event => setSortKey(event.target.value as BiggestUpsetsSortKey)}
              >
                <MenuItem value="week">Week — newest first</MenuItem>
                <MenuItem value="magnitude">Upset magnitude — biggest first</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {upsets.length ? (
            <>
              <BiggestUpsetsDesktopTable upsets={upsets} onTeamClick={openTeam} />
              <BiggestUpsetsMobileList upsets={upsets} onTeamClick={openTeam} />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No qualifying upsets yet</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Wins by teams with a {threshold} or lower pregame chance will appear here as the season progresses.
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

export default BiggestUpsets;
