import { Box, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { CompactGameSummary } from '../../components/game/CompactGameSummary';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import { DataTable } from '../../components/ui/DataTable';
import type { StandingsViewProps } from './types';

export const StandingsDesktopTable = ({
  teams,
  isIndependent,
  onTeamClick,
}: StandingsViewProps) => (
  <DataTable ariaLabel="Conference standings" minWidth={980}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell align="center" sx={{ width: 72 }}>
          Pos
        </TableCell>
        <TableCell sx={{ minWidth: 220 }}>Team</TableCell>
        {!isIndependent && (
          <TableCell align="center" sx={{ width: 100 }}>
            Conf
          </TableCell>
        )}
        <TableCell align="center" sx={{ width: 100 }}>
          Overall
        </TableCell>
        <TableCell sx={{ minWidth: 230 }}>Last Week</TableCell>
        <TableCell sx={{ minWidth: 230 }}>This Week</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {teams.map((team, index) => (
        <TableRow key={team.name} hover>
          <TableCell align="center">
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {index + 1}
            </Typography>
          </TableCell>
          <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TeamLogo name={team.name} size={32} />
              <Box sx={{ minWidth: 0 }}>
                <TeamLink name={team.name} onTeamClick={onTeamClick} />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                  }}
                >
                  {team.confName ?? team.conference}
                </Typography>
              </Box>
            </Box>
          </TableCell>
          {!isIndependent && (
            <TableCell align="center" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
              {team.confWins}-{team.confLosses}
            </TableCell>
          )}
          <TableCell align="center" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
            {team.totalWins}-{team.totalLosses}
          </TableCell>
          <TableCell>
            <CompactGameSummary
              game={team.last_game}
              mode="previous"
              onOpponentClick={onTeamClick}
            />
          </TableCell>
          <TableCell>
            <CompactGameSummary
              game={team.next_game}
              mode="upcoming"
              onOpponentClick={onTeamClick}
            />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
