import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { TeamLogo } from '../../components/team/TeamLogo';
import { DataTable } from '../../components/ui/DataTable';
import type { PlayoffTeamCount } from '../../types/domain';
import type { ResumeSnapshotTeam } from '../../types/league';

type ResumeComparisonViewProps = {
  teams: ResumeSnapshotTeam[];
  totalTeamCount: number;
  showAllTeams: boolean;
  format: PlayoffTeamCount;
  isProjection: boolean;
  onTeamClick: (teamName: string) => void;
  onToggleShowAll: () => void;
};

const ResumeTableFooter = ({
  columnCount,
  totalTeamCount,
  showAllTeams,
  onToggleShowAll,
}: {
  columnCount: number;
  totalTeamCount: number;
  showAllTeams: boolean;
  onToggleShowAll: () => void;
}) => {
  if (totalTeamCount <= 25) return null;

  return (
    <TableFooter>
      <TableRow>
        <TableCell colSpan={columnCount} sx={{ p: 0, borderBottom: 0 }}>
          <Button
            fullWidth
            onClick={onToggleShowAll}
            aria-expanded={showAllTeams}
            sx={{ py: 1.25, borderRadius: 0, fontWeight: 600 }}
          >
            {showAllTeams ? 'Show Top 25' : `Show All ${totalTeamCount}`}
          </Button>
        </TableCell>
      </TableRow>
    </TableFooter>
  );
};

const OpponentResult = ({
  result,
  onTeamClick,
}: {
  result: ResumeSnapshotTeam['bestWin'];
  onTeamClick: (teamName: string) => void;
}) => {
  if (!result) return <Typography variant="body2">—</Typography>;

  return (
    <Button
      size="small"
      onClick={() => onTeamClick(result.opponent)}
      sx={{
        p: 0,
        minWidth: 0,
        gap: 0.75,
        color: 'text.primary',
        fontWeight: 600,
        justifyContent: 'flex-start',
        textAlign: 'left',
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
        <TeamLogo name={result.opponent} size={24} />
      </Box>
      #{result.opponentRanking} {result.opponent}
    </Button>
  );
};

const DesktopPostseasonStatus = ({
  team,
  format,
  isProjection,
}: {
  team: ResumeSnapshotTeam;
  format: PlayoffTeamCount;
  isProjection: boolean;
}) => {
  if (!team.seed) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
        {isProjection ? 'Outside projected field' : 'Not selected'}
      </Typography>
    );
  }

  const details = [
    team.hasBye ? 'Bye' : null,
    team.isAutobid ? 'Autobid' : format === 12 ? 'At-large' : 'Selected',
    team.isChampion
      ? (isProjection ? 'Projected champ' : 'Conference champ')
      : null,
  ].filter((detail): detail is string => detail !== null);

  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700 }}>
        {isProjection ? 'Projected ' : ''}No. {team.seed} seed
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {details.join(' · ')}
      </Typography>
    </Box>
  );
};

type SortKey = 'ranking' | 'resumeScoreRank' | 'performanceIndexRank';
type SortDirection = 'asc' | 'desc';

const useResumeTeamSort = (teams: ResumeSnapshotTeam[]) => {
  const [sortColumn, setSortColumn] = useState<SortKey>('ranking');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const sortedTeams = useMemo(() => teams.slice().sort((left, right) => {
    const difference = left[sortColumn] - right[sortColumn];
    return (sortDirection === 'asc' ? difference : -difference) ||
      left.ranking - right.ranking;
  }), [sortColumn, sortDirection, teams]);
  const handleSort = (column: SortKey) => {
    if (column === sortColumn) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  return { sortColumn, sortDirection, sortedTeams, handleSort };
};

const SortableHeader = ({
  column,
  label,
  accessibleLabel,
  activeColumn,
  direction,
  onSort,
  compact = false,
  width,
}: {
  column: SortKey;
  label: string;
  accessibleLabel?: string;
  activeColumn: SortKey;
  direction: SortDirection;
  onSort: (column: SortKey) => void;
  compact?: boolean;
  width?: number;
}) => {
  const active = column === activeColumn;
  return (
    <TableCell
      align={compact || column !== 'ranking' ? 'right' : 'left'}
      sortDirection={active ? direction : false}
      sx={{
        width,
        whiteSpace: 'nowrap',
        ...(compact && { px: 0.75, py: 1 }),
      }}
    >
      <TableSortLabel
        active={active}
        direction={active ? direction : 'asc'}
        onClick={() => onSort(column)}
        aria-label={accessibleLabel ? `Sort by ${accessibleLabel}` : undefined}
        sx={compact ? { fontSize: '0.75rem', fontWeight: 600 } : undefined}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
};

const ResumeDesktopTable = ({
  teams,
  format,
  isProjection,
  onTeamClick,
  totalTeamCount,
  showAllTeams,
  onToggleShowAll,
  sortColumn,
  sortDirection,
  onSort,
}: ResumeComparisonViewProps & {
  sortColumn: SortKey;
  sortDirection: SortDirection;
  onSort: (column: SortKey) => void;
}) => {
  return (
    <DataTable ariaLabel="Resume comparison" minWidth={1340}>
      <TableHead>
        <TableRow sx={{ bgcolor: 'background.default' }}>
          <SortableHeader
            column="ranking"
            label="Rank"
            activeColumn={sortColumn}
            direction={sortDirection}
            onSort={onSort}
          />
          <TableCell sx={{ minWidth: 160, whiteSpace: 'nowrap' }}>Team</TableCell>
          <TableCell sx={{ width: 118, whiteSpace: 'nowrap' }}>Record</TableCell>
          <TableCell sx={{ minWidth: 110, whiteSpace: 'nowrap' }}>Conference</TableCell>
          <SortableHeader
            column="resumeScoreRank"
            label="Resume Score"
            activeColumn={sortColumn}
            direction={sortDirection}
            onSort={onSort}
          />
          <SortableHeader
            column="performanceIndexRank"
            label="Performance Index"
            activeColumn={sortColumn}
            direction={sortDirection}
            onSort={onSort}
          />
          <TableCell align="center" sx={{ width: 104, whiteSpace: 'nowrap' }}>Top 25</TableCell>
          <TableCell sx={{ minWidth: 155, whiteSpace: 'nowrap' }}>Best Win</TableCell>
          <TableCell sx={{ minWidth: 155, whiteSpace: 'nowrap' }}>Worst Loss</TableCell>
          <TableCell sx={{ minWidth: 205, whiteSpace: 'nowrap' }}>Postseason</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {teams.map(team => (
          <TableRow key={team.name} hover>
            <TableCell>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {team.ranking}
              </Typography>
            </TableCell>
            <TableCell>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TeamLogo name={team.name} size={30} />
                <Button
                  size="small"
                  onClick={() => onTeamClick(team.name)}
                  sx={{ p: 0, minWidth: 0, color: 'text.primary', fontWeight: 600 }}
                >
                  {team.name}
                </Button>
              </Stack>
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{team.record}</TableCell>
            <TableCell>{team.conference}</TableCell>
            <TableCell align="right">#{team.resumeScoreRank}</TableCell>
            <TableCell align="right">#{team.performanceIndexRank}</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>{team.top25Record}</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <OpponentResult
                result={team.bestWin}
                onTeamClick={onTeamClick}
              />
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <OpponentResult
                result={team.worstLoss}
                onTeamClick={onTeamClick}
              />
            </TableCell>
            <TableCell>
              <DesktopPostseasonStatus team={team} format={format} isProjection={isProjection} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <ResumeTableFooter
        columnCount={10}
        totalTeamCount={totalTeamCount}
        showAllTeams={showAllTeams}
        onToggleShowAll={onToggleShowAll}
      />
    </DataTable>
  );
};

const ResumeMobileTable = ({
  teams,
  totalTeamCount,
  showAllTeams,
  onTeamClick,
  onToggleShowAll,
  sortColumn,
  sortDirection,
  onSort,
}: Pick<
  ResumeComparisonViewProps,
  'teams' | 'totalTeamCount' | 'showAllTeams' | 'onTeamClick' | 'onToggleShowAll'
> & {
  sortColumn: SortKey;
  sortDirection: SortDirection;
  onSort: (column: SortKey) => void;
}) => (
    <Paper
      variant="outlined"
      sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
    >
      <Table
        size="small"
        aria-label="Mobile resume comparison"
        sx={{ tableLayout: 'fixed', width: '100%' }}
      >
        <TableHead>
          <TableRow sx={{ bgcolor: 'background.default' }}>
            <SortableHeader
              column="ranking"
              label="Rank"
              accessibleLabel="Poll Score rank"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              compact
              width={58}
            />
            <TableCell sx={{ px: 0.75, py: 1, fontSize: '0.75rem', fontWeight: 600 }}>
              Team
            </TableCell>
            <SortableHeader
              column="performanceIndexRank"
              label="PI"
              accessibleLabel="Performance Index rank"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              compact
              width={64}
            />
            <SortableHeader
              column="resumeScoreRank"
              label="Resume"
              accessibleLabel="Resume Score rank"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              compact
              width={82}
            />
          </TableRow>
        </TableHead>
        <TableBody>
          {teams.map(team => (
            <TableRow key={team.name} hover>
              <TableCell align="right" sx={{ width: 52, px: 0.75, py: 0.75, fontWeight: 700 }}>
                {team.ranking}
              </TableCell>
              <TableCell sx={{ px: 0.75, py: 0.75, overflow: 'hidden' }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <TeamLogo name={team.name} size={26} />
                  <Button
                    size="small"
                    onClick={() => onTeamClick(team.name)}
                    sx={{
                      p: 0,
                      minWidth: 0,
                      color: 'text.primary',
                      display: 'block',
                      overflow: 'hidden',
                      fontWeight: 600,
                      textAlign: 'left',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {team.name}
                  </Button>
                </Stack>
              </TableCell>
              <TableCell align="right" sx={{ width: 58, px: 0.75, py: 0.75 }}>
                #{team.performanceIndexRank}
              </TableCell>
              <TableCell align="right" sx={{ width: 76, px: 0.75, py: 0.75 }}>
                #{team.resumeScoreRank}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <ResumeTableFooter
          columnCount={4}
          totalTeamCount={totalTeamCount}
          showAllTeams={showAllTeams}
          onToggleShowAll={onToggleShowAll}
        />
      </Table>
    </Paper>
  );

export const ResumeComparisonView = (props: ResumeComparisonViewProps) => {
  const { sortColumn, sortDirection, sortedTeams, handleSort } = useResumeTeamSort(props.teams);

  if (props.teams.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No resume comparison data is available.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        flex: { lg: 1 },
        display: { lg: 'flex' },
        flexDirection: { lg: 'column' },
        minHeight: { lg: 0 },
      }}
    >
      <ResumeDesktopTable
        {...props}
        teams={sortedTeams}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      <ResumeMobileTable
        teams={sortedTeams}
        totalTeamCount={props.totalTeamCount}
        showAllTeams={props.showAllTeams}
        onTeamClick={props.onTeamClick}
        onToggleShowAll={props.onToggleShowAll}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </Box>
  );
};
