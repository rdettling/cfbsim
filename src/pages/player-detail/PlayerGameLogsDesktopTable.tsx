import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Chip,
  Link,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { DataTable } from '../../components/ui/DataTable';
import type { PlayerGameLog, PlayerStatCategory } from '../../types/player';
import { formatPlayerStat, getGameColumns } from './config';

type PlayerGameLogsDesktopTableProps = {
  logs: PlayerGameLog[];
  category: PlayerStatCategory;
  onTeamClick: (teamName: string) => void;
};

export const PlayerGameLogsDesktopTable = ({
  logs,
  category,
  onTeamClick,
}: PlayerGameLogsDesktopTableProps) => {
  const columns = getGameColumns(category);

  return (
    <DataTable ariaLabel="Player game logs" minWidth={880 + columns.length * 30}>
      <TableHead>
        <TableRow sx={{ bgcolor: 'background.default' }}>
          <TableCell sx={{ width: 72 }}>Week</TableCell>
          <TableCell sx={{ minWidth: 210 }}>Opponent</TableCell>
          <TableCell sx={{ width: 120 }}>Result</TableCell>
          {columns.map((column) => (
            <TableCell key={column.key} align="right" sx={{ minWidth: 82, whiteSpace: 'nowrap' }}>
              {column.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {logs.map((log, index) => {
          const opponent = log.game.opponent;
          const isWin = log.game.result === 'W';
          return (
            <TableRow key={`${log.game.id}-${index}`} hover>
              <TableCell sx={{ fontWeight: 600 }}>{log.game.weekPlayed}</TableCell>
              <TableCell>
                {opponent ? (
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{
                      alignItems: 'center',
                    }}
                  >
                    <TeamLogo name={opponent.name} size={28} />
                    <Box sx={{ minWidth: 0 }}>
                      <TeamLink name={opponent.name} onTeamClick={onTeamClick} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                        }}
                      >
                        {log.game.label}
                      </Typography>
                    </Box>
                  </Stack>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{
                    alignItems: 'center',
                  }}
                >
                  <Chip
                    label={isWin ? 'W' : 'L'}
                    size="small"
                    color={isWin ? 'success' : 'error'}
                    variant="outlined"
                  />
                  <Link
                    component={RouterLink}
                    to={`/game/${log.game.id}`}
                    underline="hover"
                    sx={{ fontWeight: 600 }}
                  >
                    {log.game.score}
                  </Link>
                </Stack>
              </TableCell>
              {columns.map((column) => (
                <TableCell key={column.key} align="right">
                  {formatPlayerStat(log.stats, column)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </DataTable>
  );
};
