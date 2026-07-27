import {
  Box,
  ButtonBase,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TeamLogo } from '../../components/team/TeamComponents';
import type { RecruitingTeamResult } from '../../types/recruiting';

interface RecruitingTeamRankingsProps {
  rankings: RecruitingTeamResult[];
  selectedTeamId: number | null;
  onSelect: (teamId: number) => void;
}

export const RecruitingTeamRankings = ({
  rankings,
  selectedTeamId,
  onSelect,
}: RecruitingTeamRankingsProps) => (
  <Paper
    component="section"
    aria-labelledby="recruiting-team-rankings-title"
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
    }}
  >
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        id="recruiting-team-rankings-title"
        component="h2"
        variant="h6"
      >
        Team Rankings
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Select a team to inspect its finalized class
      </Typography>
    </Box>

    <TableContainer
      sx={{
        display: { xs: 'none', lg: 'block' },
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
      }}
    >
      <Table stickyHeader size="small" aria-label="Recruiting team rankings">
        <TableHead>
          <TableRow>
            <TableCell>Rank</TableCell>
            <TableCell>Team</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">5★</TableCell>
            <TableCell align="right">4★</TableCell>
            <TableCell align="right">3★</TableCell>
            <TableCell align="right">Avg</TableCell>
            <TableCell align="right">Score</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rankings.map(team => (
            <TableRow
              key={team.teamId}
              hover
              selected={team.teamId === selectedTeamId}
            >
              <TableCell>#{team.rank}</TableCell>
              <TableCell>
                <ButtonBase
                  onClick={() => onSelect(team.teamId)}
                  sx={{
                    borderRadius: 1,
                    justifyContent: 'flex-start',
                    gap: 1,
                    py: 0.25,
                    textAlign: 'left',
                  }}
                >
                  <TeamLogo name={team.teamName} size={24} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {team.teamName}
                  </Typography>
                </ButtonBase>
              </TableCell>
              <TableCell align="right">{team.totalRecruits}</TableCell>
              <TableCell align="right">{team.starCounts.five}</TableCell>
              <TableCell align="right">{team.starCounts.four}</TableCell>
              <TableCell align="right">{team.starCounts.three}</TableCell>
              <TableCell align="right">{team.averageStars}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {team.classScore}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    <Stack sx={{ display: { xs: 'flex', lg: 'none' } }}>
      {rankings.map((team, index) => (
        <ButtonBase
          key={team.teamId}
          onClick={() => onSelect(team.teamId)}
          sx={{
            px: 1.5,
            py: 1.15,
            gap: 1.25,
            justifyContent: 'flex-start',
            textAlign: 'left',
            borderBottom:
              index === rankings.length - 1 ? 0 : '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="body2"
            sx={{ width: 32, flexShrink: 0, fontWeight: 700 }}
          >
            #{team.rank}
          </Typography>
          <TeamLogo name={team.teamName} size={30} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700 }}>
              {team.teamName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {team.totalRecruits} recruits · {team.averageStars} avg stars
            </Typography>
          </Box>
          <Stack alignItems="flex-end" spacing={0.25}>
            <Typography sx={{ fontWeight: 700 }}>
              {team.classScore}
            </Typography>
            <Chip
              label={`${team.starCounts.five} 5★`}
              size="small"
              variant="outlined"
            />
          </Stack>
        </ButtonBase>
      ))}
    </Stack>
  </Paper>
);
