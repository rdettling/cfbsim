import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Chip,
  Link,
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
import { ConfLogo, TeamLogo } from '../../components/team/TeamComponents';
import type { RecruitingTeamResult } from '../../types/recruiting';

interface RecruitingClassPanelProps {
  team: RecruitingTeamResult | null;
  headingId?: string;
}

export const RecruitingClassPanel = ({
  team,
  headingId = 'recruiting-class-title',
}: RecruitingClassPanelProps) => (
  <Paper
    component="section"
    aria-labelledby={headingId}
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
    }}
  >
    {team ? (
      <>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: 'center',
            px: { xs: 1.5, md: 2 },
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TeamLogo name={team.teamName} size={38} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id={headingId} component="h2" variant="h6" noWrap>
              {team.teamName} Class
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: 'center',
                color: 'text.secondary',
              }}
            >
              <ConfLogo name={team.conference} size={18} />
              <Typography variant="caption">
                {team.conference} · Prestige {team.prestige}
              </Typography>
            </Stack>
          </Box>
          <Chip label={`#${team.rank}`} size="small" variant="outlined" />
        </Stack>

        <TableContainer
          sx={{
            display: { xs: 'none', sm: 'block' },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <Table stickyHeader size="small" aria-label={`${team.teamName} recruiting class`}>
            <TableHead>
              <TableRow>
                <TableCell>Natl.</TableCell>
                <TableCell>Player</TableCell>
                <TableCell>Pos</TableCell>
                <TableCell align="right">Rating</TableCell>
                <TableCell align="right">Stars</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {team.recruits.map((player) => (
                <TableRow key={player.id} hover>
                  <TableCell>#{player.rank}</TableCell>
                  <TableCell>
                    <Link
                      component={RouterLink}
                      to={`/players/${player.id}`}
                      underline="hover"
                      sx={{ fontWeight: 700 }}
                    >
                      {player.first} {player.last}
                    </Link>
                  </TableCell>
                  <TableCell>{player.position.toUpperCase()}</TableCell>
                  <TableCell align="right">{player.rating}</TableCell>
                  <TableCell align="right">{player.stars}★</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack
          sx={{
            display: { xs: 'flex', sm: 'none' },
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          {team.recruits.map((player, index) => (
            <Stack
              component="article"
              key={player.id}
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                px: 1.5,
                py: 1.1,

                borderBottom: index === team.recruits.length - 1 ? 0 : '1px solid',

                borderColor: 'divider',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  width: 34,
                  flexShrink: 0,
                }}
              >
                #{player.rank}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  to={`/players/${player.id}`}
                  underline="hover"
                  sx={{ fontWeight: 700 }}
                >
                  {player.first} {player.last}
                </Link>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                  }}
                >
                  {player.position.toUpperCase()} · {player.stars}★
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 700 }}>{player.rating}</Typography>
            </Stack>
          ))}
        </Stack>
      </>
    ) : (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography id={headingId} variant="h6">
          No recruiting class selected
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          Select a ranked team to inspect its recruits.
        </Typography>
      </Box>
    )}
  </Paper>
);
