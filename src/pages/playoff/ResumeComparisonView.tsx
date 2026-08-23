import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TeamLogo } from '../../components/team/TeamLogo';
import { DataTable } from '../../components/ui/DataTable';
import type { PostseasonFormat, ResumeTeam, TeamAction } from './types';
import { PostseasonTeamIdentity } from './PostseasonTeamIdentity';

type ResumeComparisonViewProps = {
  teams: ResumeTeam[];
  format: PostseasonFormat;
  isProjection: boolean;
  onTeamClick: TeamAction;
};

const OpponentResult = ({
  result,
  onTeamClick,
}: {
  result: ResumeTeam['best_win'];
  onTeamClick: TeamAction;
}) => {
  if (!result) return <Typography variant="body2">—</Typography>;

  return (
    <Button
      size="small"
      onClick={() => onTeamClick(result.opponent)}
      sx={{ p: 0, minWidth: 0, color: 'text.primary', justifyContent: 'flex-start' }}
    >
      #{result.opponent_ranking} {result.opponent}
    </Button>
  );
};

const PlayoffStatus = ({
  team,
  format,
  isProjection,
}: {
  team: ResumeTeam;
  format: PostseasonFormat;
  isProjection: boolean;
}) => (
  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
    {team.seed ? (
      <>
        <Chip
          label={`${isProjection ? 'Projected ' : ''}Seed ${team.seed}`}
          size="small"
          color="primary"
        />
        {team.has_bye && <Chip label="Bye" size="small" color="success" variant="outlined" />}
        {team.is_autobid ? (
          <Chip label="Autobid" size="small" variant="outlined" />
        ) : (
          <Chip label={format === 12 ? 'At-large' : 'Selected'} size="small" variant="outlined" />
        )}
      </>
    ) : (
      <Chip label="Out" size="small" variant="outlined" />
    )}
    {team.is_champ && (
      <Chip
        label={isProjection ? 'Projected champion' : 'Champion'}
        size="small"
        color="success"
        variant="outlined"
      />
    )}
  </Stack>
);

const ResumeDesktopTable = ({
  teams,
  format,
  isProjection,
  onTeamClick,
}: ResumeComparisonViewProps) => (
  <DataTable ariaLabel="Resume comparison" minWidth={1380}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell sx={{ width: 64 }}>Rank</TableCell>
        <TableCell sx={{ minWidth: 210 }}>Team</TableCell>
        <TableCell sx={{ width: 118 }}>Record</TableCell>
        <TableCell sx={{ minWidth: 125 }}>Conference</TableCell>
        <TableCell align="right" sx={{ width: 110 }}>Weekly Score</TableCell>
        <TableCell align="right" sx={{ width: 92 }}>WOE Rank</TableCell>
        <TableCell align="right" sx={{ width: 72 }}>SOS</TableCell>
        <TableCell align="center" sx={{ width: 104 }}>Top 25</TableCell>
        <TableCell sx={{ minWidth: 170 }}>Best Win</TableCell>
        <TableCell sx={{ minWidth: 170 }}>Worst Loss</TableCell>
        <TableCell sx={{ minWidth: 220 }}>Postseason</TableCell>
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
          <TableCell align="right">{team.poll_score.toFixed(1)}</TableCell>
          <TableCell align="right">#{team.wins_over_expectation_rank}</TableCell>
          <TableCell align="right">{team.sos_rank ? `#${team.sos_rank}` : '—'}</TableCell>
          <TableCell align="center" sx={{ fontWeight: 600 }}>{team.top_25_record}</TableCell>
          <TableCell><OpponentResult result={team.best_win} onTeamClick={onTeamClick} /></TableCell>
          <TableCell><OpponentResult result={team.worst_loss} onTeamClick={onTeamClick} /></TableCell>
          <TableCell>
            <PlayoffStatus team={team} format={format} isProjection={isProjection} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {value}
    </Typography>
  </Box>
);

const ResumeMobileList = ({
  teams,
  format,
  isProjection,
  onTeamClick,
}: ResumeComparisonViewProps) => (
  <Paper
    component="section"
    aria-label="Resume comparison"
    variant="outlined"
    sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
  >
    {teams.map((team, index) => (
      <Box
        key={team.name}
        sx={{
          p: 1.5,
          borderBottom: index === teams.length - 1 ? 0 : '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 1,
              bgcolor: 'action.hover',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 700 }}>{team.ranking}</Typography>
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <PostseasonTeamIdentity
              name={team.name}
              secondary={`${team.record} · ${team.conference}`}
              logoSize={34}
              onTeamClick={onTeamClick}
            />
          </Box>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            mt: 1.5,
          }}
        >
          <Metric label="Weekly Score" value={team.poll_score.toFixed(1)} />
          <Metric
            label="Wins Over Expectation rank"
            value={`#${team.wins_over_expectation_rank}`}
          />
          <Metric label="SOS rank" value={team.sos_rank ? `#${team.sos_rank}` : '—'} />
          <Metric label="Top-25 record" value={team.top_25_record} />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            mt: 1.25,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Best win
            </Typography>
            <OpponentResult result={team.best_win} onTeamClick={onTeamClick} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Worst loss
            </Typography>
            <OpponentResult result={team.worst_loss} onTeamClick={onTeamClick} />
          </Box>
        </Box>

        <Box sx={{ mt: 1.25 }}>
          <PlayoffStatus team={team} format={format} isProjection={isProjection} />
        </Box>
      </Box>
    ))}
  </Paper>
);

export const ResumeComparisonView = (props: ResumeComparisonViewProps) => {
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
      <ResumeDesktopTable {...props} />
      <ResumeMobileList {...props} />
    </Box>
  );
};
