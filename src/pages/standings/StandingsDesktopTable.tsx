import { Box, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { CompactGameSummary } from '../../components/game/CompactGameSummary';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { DataTable } from '../../components/ui/DataTable';
import type { StandingsViewProps } from './types';
import { TIEBREAK_LABELS } from './tiebreakLabels';

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
          <>
            <TableCell align="center" sx={{ width: 100 }}>Conf</TableCell>
            <TableCell align="center" sx={{ width: 110 }}>Tiebreak</TableCell>
          </>
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
              <TeamLink name={team.name} onTeamClick={onTeamClick} />
            </Box>
          </TableCell>
          {!isIndependent && (
            <>
              <TableCell align="center" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                {team.confWins}-{team.confLosses}
              </TableCell>
              <TableCell align="center">
                {team.tiebreaker ? (
                  <Tooltip title={TIEBREAK_LABELS[team.tiebreaker].full}>
                    <Typography
                      component="span"
                      variant="caption"
                      aria-label={`Tiebreak: ${TIEBREAK_LABELS[team.tiebreaker].full}`}
                    >
                      {TIEBREAK_LABELS[team.tiebreaker].short}
                    </Typography>
                  </Tooltip>
                ) : '—'}
              </TableCell>
            </>
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
