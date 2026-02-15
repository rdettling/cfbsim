import { Box, Grid, Paper, Typography, Chip, Stack, Link as MuiLink } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { useDomainData } from '../domain/hooks';
import { loadAwards } from '../domain/league';
import { TeamLogo } from '../components/team/TeamComponents';
type AwardsPageData = Awaited<ReturnType<typeof loadAwards>>;
type AwardPlayer = AwardsPageData['favorites'][number]['first_place'];

const RANK_LABELS = ['1st Favorite', '2nd Favorite', '3rd Favorite'];

const getAwardStatLine = (stats?: Record<string, any> | null) => stats?.stat_line ?? 'No stats yet';

const AwardRow = ({
  label,
  player,
  score,
  stats,
}: {
  label: string;
  player: AwardPlayer | null;
  score: number | null;
  stats: Record<string, any> | null;
}) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 2,
      borderTop: '1px solid',
      borderColor: 'divider',
      py: 2,
      '&:first-of-type': { borderTop: 'none', pt: 0 },
    }}
  >
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
        {player && <TeamLogo name={player.team_name} size={32} />}
        {player ? (
          <MuiLink
            href={`/players/${player.id}`}
            underline="hover"
            sx={{ fontWeight: 700, fontSize: '1.1rem' }}
          >
            {`${player.first} ${player.last}`}
          </MuiLink>
        ) : (
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            TBD
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {getAwardStatLine(stats)}
      </Typography>
    </Box>
    <Stack alignItems="flex-end" spacing={0.5}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {score !== null && score !== undefined ? score.toFixed(1) : '—'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {player?.pos || '--'}
      </Typography>
    </Stack>
  </Box>
);

const AwardCard = ({
  award,
  highlightLabel,
  highlightColor,
}: {
  award: AwardsPageData['favorites'][number];
  highlightLabel: string;
  highlightColor: 'primary' | 'success';
}) => {
  const nominees = [award.first_place, award.second_place, award.third_place];

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        borderRadius: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {award.category_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {award.category_description}
          </Typography>
        </Box>
        <Chip label={highlightLabel} color={highlightColor} variant="outlined" />
      </Stack>

      <Box>
        {nominees.map((player, index) => (
          <AwardRow
            key={`${award.category_slug}-${index}`}
            label={RANK_LABELS[index]}
            player={player}
            score={
              index === 0
                ? award.first_score
                : index === 1
                ? award.second_score
                : award.third_score
            }
            stats={
              index === 0
                ? award.first_stats
                : index === 1
                ? award.second_stats
                : award.third_stats
            }
          />
        ))}
      </Box>
    </Paper>
  );
};

const Awards = () => {
  const { data, loading, error } = useDomainData<AwardsPageData>({
    fetcher: loadAwards,
    deps: [],
  });

  const hasAwards = (data?.favorites?.length || 0) > 0 || (data?.final?.length || 0) > 0;

  return (
    <PageLayout
      loading={loading}
      error={error}
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
      containerMaxWidth="xl"
    >
      {data && (
        <Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h2" sx={{ fontWeight: 700 }}>
              Individual Awards
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {data.info.stage === 'summary'
                ? 'Final award winners based on the completed season.'
                : 'Live award races — the top favorites are updated each time you visit this page.'}
            </Typography>
          </Box>

          {!hasAwards && (
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="body1" color="text.secondary">
                Awards will appear here once enough games have been played.
              </Typography>
            </Paper>
          )}

          {data.favorites.length > 0 && (
            <Grid container spacing={3}>
              {data.favorites.map((award) => (
                <Grid item xs={12} md={6} key={`${award.category_slug}-fav`}>
                  <AwardCard award={award} highlightLabel="Live Favorites" highlightColor="primary" />
                </Grid>
              ))}
            </Grid>
          )}

          {data.final.length > 0 && (
            <Box sx={{ mt: 5 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                Final Award Winners
              </Typography>
              <Grid container spacing={3}>
                {data.final.map((award) => (
                  <Grid item xs={12} md={6} key={`${award.category_slug}-final`}>
                    <AwardCard award={award} highlightLabel="Final Winner" highlightColor="success" />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}
    </PageLayout>
  );
};

export default Awards;
