import { Box, Paper, Stack, Typography } from '@mui/material';
import type { RankedTeamAggregateStats, TeamAggregateMode } from '../../types/stats';
import {
  formatTeamStat,
  TEAM_STAT_COLUMNS,
  TEAM_STAT_GROUPS,
} from '../../components/stats/teamAggregateConfig';

const defensiveLabels: Partial<Record<(typeof TEAM_STAT_COLUMNS)[number]['key'], string>> = {
  ppg: 'Points allowed / game',
  pass_cpg: 'Completions allowed / game',
  pass_apg: 'Pass attempts faced / game',
  comp_percent: 'Completion % allowed',
  pass_ypg: 'Passing yards allowed / game',
  pass_tdpg: 'Passing TD allowed / game',
  rush_apg: 'Rush attempts faced / game',
  rush_ypg: 'Rushing yards allowed / game',
  rush_ypc: 'Yards allowed / carry',
  rush_tdpg: 'Rushing TD allowed / game',
  playspg: 'Plays faced / game',
  yardspg: 'Yards allowed / game',
  ypp: 'Yards allowed / play',
  first_downs_pass: 'Passing first downs allowed',
  first_downs_rush: 'Rushing first downs allowed',
  first_downs_total: 'Total first downs allowed',
  fumbles: 'Fumble takeaways / game',
  interceptions: 'Interception takeaways / game',
  turnovers: 'Takeaways / game',
};

type TeamAggregatePanelProps = {
  mode: TeamAggregateMode;
  stats: RankedTeamAggregateStats;
};

export const TeamAggregatePanel = ({ mode, stats }: TeamAggregatePanelProps) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
      gap: 1,
    }}
  >
    {TEAM_STAT_GROUPS.map(group => (
      <Paper key={group} variant="outlined" sx={{ overflow: 'hidden' }}>
        <Typography
          component="h3"
          variant="subtitle2"
          sx={{ px: 1.25, py: 0.75, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}
        >
          {mode === 'defense' && group === 'Total Offense' ? 'Total Defense' : group}
        </Typography>
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {TEAM_STAT_COLUMNS.filter(column => column.group === group).map(column => (
            <Stack
              key={column.key}
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.25, py: 0.65 }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {mode === 'defense'
                  ? defensiveLabels[column.key] ?? column.mobileLabel
                  : column.mobileLabel}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline', flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatTeamStat(stats.values, column.key)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 28, textAlign: 'right' }}>
                  #{stats.ranks[column.key]}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Paper>
    ))}
  </Box>
);
