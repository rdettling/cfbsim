import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Link as MuiLink,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { useDomainData } from '../domain/hooks';
import { loadRosterProgression } from '../domain/league';
import { POSITION_ORDER } from '../domain/roster';
import type { PlayerRecord } from '../types/db';

type RosterProgressionData = Awaited<ReturnType<typeof loadRosterProgression>>;

interface ProgressedPlayer {
  id: number;
  first: string;
  last: string;
  pos: string;
  year: PlayerRecord['year'];
  rating: number;
  next_year: PlayerRecord['year'];
  next_rating: number;
  stars: number;
  development_trait: number;
}

interface StatCardProps {
  title: string;
  value: number;
  color: 'success' | 'warning' | 'info' | 'secondary';
  gradient: string;
}

const StatCard = ({ title, value, color, gradient }: StatCardProps) => (
  <Card sx={{ height: '100%', background: gradient }}>
    <CardContent sx={{ textAlign: 'center' }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', color: `${color}.main` }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </CardContent>
  </Card>
);

interface PlayerTableProps {
  players: Array<PlayerRecord | ProgressedPlayer>;
  title: string;
  color: 'success' | 'warning';
  showChange?: boolean;
  positionFilter?: string;
}

const PlayerTable = ({ players, title, color, showChange = false, positionFilter }: PlayerTableProps) => {
  const sortedAndFilteredPlayers = players
    .filter(player => !positionFilter || player.pos === positionFilter)
    .sort((a, b) => b.rating - a.rating);

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: `${color}.main` }}>
            {title}
          </Typography>
          <Chip label={`${sortedAndFilteredPlayers.length} players`} color={color} size="small" />
          {positionFilter && (
            <Chip label={`Filtered: ${positionFilter.toUpperCase()}`} color="primary" size="small" variant="outlined" />
          )}
        </Box>

        {sortedAndFilteredPlayers.length > 0 ? (
          <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: `${color}.main` }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                  {showChange && <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Year</TableCell>}
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Position</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedAndFilteredPlayers.map((player, index) => {
                  const progressed = player as ProgressedPlayer;
                  const ratingChange = progressed.next_rating !== undefined ? progressed.next_rating - player.rating : 0;
                  return (
                    <TableRow key={player.id ?? index} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                      <TableCell>
                        <MuiLink
                          component={RouterLink}
                          to={`/players/${player.id}`}
                          underline="hover"
                          sx={{ fontWeight: 600 }}
                        >
                          {player.first} {player.last}
                        </MuiLink>
                      </TableCell>
                      {showChange && (
                        <TableCell>
                          <Chip
                            label={progressed.next_year?.toUpperCase() || ''}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip label={player.pos.toUpperCase()} size="small" color="secondary" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: showChange ? 'inherit' : `${color}.main` }}>
                        {player.rating}
                        {showChange && progressed.next_rating !== undefined && (
                          <Box
                            component="span"
                            sx={{
                              color: ratingChange >= 0 ? 'success.main' : 'error.main',
                              ml: 1,
                              fontWeight: 'normal',
                            }}
                          >
                            {ratingChange >= 0 ? `(+${ratingChange})` : `(${ratingChange})`}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {positionFilter ? `No ${positionFilter.toUpperCase()} players` : `No ${title.toLowerCase()}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {positionFilter
                ? `No ${positionFilter.toUpperCase()} players found.`
                : showChange
                ? 'No players have progressed this offseason.'
                : 'All players are returning for another season.'}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const RosterProgression = () => {
  const [positionFilter, setPositionFilter] = useState<string>('');

  const { data, loading, error } = useDomainData<RosterProgressionData>({
    fetcher: loadRosterProgression,
    deps: [],
  });

  const totalProgressed = data?.progressed.length || 0;
  const totalLeaving = data?.leaving.length || 0;

  const avgRatingChange =
    totalProgressed > 0 && data
      ? Math.round(
          data.progressed.reduce((sum, player) => sum + (player.next_rating - player.rating), 0) / totalProgressed
        )
      : 0;

  const maxRatingChange =
    totalProgressed > 0 && data
      ? Math.max(...data.progressed.map(player => player.next_rating - player.rating))
      : 0;

  const statCards: StatCardProps[] = [
    {
      title: 'Players Progressed',
      value: totalProgressed,
      color: 'success',
      gradient: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
    },
    {
      title: 'Seniors Leaving',
      value: totalLeaving,
      color: 'warning',
      gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%)',
    },
    {
      title: 'Avg Rating Change',
      value: avgRatingChange,
      color: 'info',
      gradient: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    },
    {
      title: 'Max Rating Gain',
      value: maxRatingChange,
      color: 'secondary',
      gradient: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)',
    },
  ];

  const uniquePositions = useMemo(() => {
    if (!data) return [];
    const allPlayers = [...data.progressed, ...data.leaving];
    const positionSet = new Set(allPlayers.map(player => player.pos));
    const orderedPositions = POSITION_ORDER.filter(pos => positionSet.has(pos));
    const extraPositions = Array.from(positionSet).filter(pos => !POSITION_ORDER.includes(pos));
    extraPositions.sort((a, b) => a.localeCompare(b));
    return [...orderedPositions, ...extraPositions];
  }, [data]);

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
      containerMaxWidth="lg"
    >
      {data && (
        <>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Roster Progression
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {data.info.currentYear} → {data.info.currentYear + 1} Season Transition
            </Typography>
          </Box>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {statCards.map((card, index) => (
              <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard {...card} />
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mb: 3 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Position</InputLabel>
              <Select
                value={positionFilter}
                label="Filter by Position"
                onChange={(e) => setPositionFilter(e.target.value)}
              >
                <MenuItem value="">All Positions</MenuItem>
                {uniquePositions.map((pos) => (
                  <MenuItem key={pos} value={pos}>
                    {pos.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <PlayerTable
            players={data.progressed}
            title="Players Progressed"
            color="success"
            showChange
            positionFilter={positionFilter}
          />

          <PlayerTable
            players={data.leaving}
            title="Seniors Leaving"
            color="warning"
            positionFilter={positionFilter}
          />

          <Card sx={{ background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Ready for Next Season
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Your roster has been updated for the upcoming season.
                {totalProgressed > 0 && ` ${totalProgressed} players have improved their skills.`}
                {totalLeaving > 0 && ` ${totalLeaving} seniors have graduated.`}
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </PageLayout>
  );
};

export default RosterProgression;
