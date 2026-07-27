import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  ButtonBase,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TeamLogo } from '../../components/team/TeamComponents';
import { DataTable } from '../../components/ui/DataTable';
import type {
  RecruitingPlayerResult,
  RecruitingTeamResult,
} from '../../types/recruiting';

interface RecruitingPlayerRankingsProps {
  players: RecruitingPlayerResult[];
  teams: RecruitingTeamResult[];
  positions: string[];
  teamFilter: number | '';
  positionFilter: string;
  filtersActive: boolean;
  onTeamFilterChange: (teamId: number | '') => void;
  onPositionFilterChange: (position: string) => void;
  onTeamSelect: (teamId: number) => void;
}

const PlayerLink = ({ player }: { player: RecruitingPlayerResult }) => (
  <Link
    component={RouterLink}
    to={`/players/${player.id}`}
    underline="hover"
    sx={{ fontWeight: 700 }}
  >
    {player.first} {player.last}
  </Link>
);

export const RecruitingPlayerRankings = ({
  players,
  teams,
  positions,
  teamFilter,
  positionFilter,
  filtersActive,
  onTeamFilterChange,
  onPositionFilterChange,
  onTeamSelect,
}: RecruitingPlayerRankingsProps) => (
  <Box
    component="section"
    aria-labelledby="recruiting-player-rankings-title"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      flex: { lg: 1 },
      minHeight: { lg: 0 },
    }}
  >
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ md: 'flex-end' }}
      justifyContent="space-between"
      spacing={1.25}
      sx={{ mb: 1.25 }}
    >
      <Box>
        <Typography
          id="recruiting-player-rankings-title"
          component="h2"
          variant="h6"
        >
          Player Rankings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {players.length} recruit{players.length === 1 ? '' : 's'} shown
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 190 } }}>
          <InputLabel id="recruiting-team-filter-label">Team</InputLabel>
          <Select
            labelId="recruiting-team-filter-label"
            value={teamFilter}
            label="Team"
            onChange={event =>
              onTeamFilterChange(event.target.value as number | '')
            }
          >
            <MenuItem value="">All Teams</MenuItem>
            {teams.map(team => (
              <MenuItem key={team.teamId} value={team.teamId}>
                {team.teamName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
          <InputLabel id="recruiting-position-filter-label">
            Position
          </InputLabel>
          <Select
            labelId="recruiting-position-filter-label"
            value={positionFilter}
            label="Position"
            onChange={event => onPositionFilterChange(event.target.value)}
          >
            <MenuItem value="">All Positions</MenuItem>
            {positions.map(position => (
              <MenuItem key={position} value={position}>
                {position.toUpperCase()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Stack>

    {players.length === 0 ? (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">
          {filtersActive ? 'No recruits match these filters' : 'No recruits found'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {filtersActive
            ? 'Choose another team or position to view recruiting results.'
            : 'No finalized freshmen were returned for this season.'}
        </Typography>
      </Paper>
    ) : (
      <>
        <DataTable ariaLabel="Recruiting player rankings" minWidth={760}>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Player</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Pos</TableCell>
              <TableCell align="right">Rating</TableCell>
              <TableCell align="right">Stars</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {players.map(player => (
              <TableRow key={player.id} hover>
                <TableCell>#{player.rank}</TableCell>
                <TableCell><PlayerLink player={player} /></TableCell>
                <TableCell>
                  <ButtonBase
                    onClick={() => onTeamSelect(player.teamId)}
                    sx={{
                      borderRadius: 1,
                      justifyContent: 'flex-start',
                      gap: 1,
                      py: 0.25,
                      textAlign: 'left',
                    }}
                  >
                    <TeamLogo name={player.teamName} size={22} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {player.teamName}
                    </Typography>
                  </ButtonBase>
                </TableCell>
                <TableCell>{player.position.toUpperCase()}</TableCell>
                <TableCell align="right">{player.rating}</TableCell>
                <TableCell align="right">{player.stars}★</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>

        <Paper
          variant="outlined"
          sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
        >
          {players.map((player, index) => (
            <Stack
              component="article"
              key={player.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                px: 1.5,
                py: 1.15,
                borderBottom:
                  index === players.length - 1 ? 0 : '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="body2"
                sx={{ width: 34, flexShrink: 0, fontWeight: 700 }}
              >
                #{player.rank}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <PlayerLink player={player} />
                <ButtonBase
                  onClick={() => onTeamSelect(player.teamId)}
                  sx={{
                    display: 'flex',
                    maxWidth: '100%',
                    color: 'text.secondary',
                    textAlign: 'left',
                  }}
                >
                  <Typography variant="caption" noWrap>
                    {player.teamName} · {player.position.toUpperCase()}
                  </Typography>
                </ButtonBase>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>{player.rating}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {player.stars}★
                </Typography>
              </Box>
            </Stack>
          ))}
        </Paper>
      </>
    )}
  </Box>
);
