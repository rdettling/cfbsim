import { Box, Paper, Stack, Typography } from '@mui/material';
import type { Team } from '../../types/domain';
import { TeamLink } from '../team/TeamLink';
import { TeamLogo } from '../team/TeamLogo';
import { formatNeutralSite } from '../../domain/utils/gameDisplay';

type MatchupGame = {
  label: string;
  weekPlayed: number;
  year: number;
  venue: string | null;
};

type MatchupTeam = {
  team: Team;
  rank: number;
  score?: number;
  winner?: boolean;
};

type MatchupHeaderBaseProps = {
  game: MatchupGame;
  away: MatchupTeam;
  home: MatchupTeam;
  neutral: boolean;
  onTeamClick: (name: string) => void;
};

type PreviewMatchupHeaderProps = MatchupHeaderBaseProps & {
  mode: 'preview';
};

type ResultMatchupHeaderProps = MatchupHeaderBaseProps & {
  mode: 'result';
  overtime: number;
};

export type GameMatchupHeaderProps = PreviewMatchupHeaderProps | ResultMatchupHeaderProps;

type TeamIdentityProps = MatchupTeam & {
  align: 'left' | 'right';
  onTeamClick: (name: string) => void;
};

const TeamIdentity = ({ team, rank, score, winner, align, onTeamClick }: TeamIdentityProps) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '72px minmax(0, 1fr) 52px',
        md: align === 'right'
          ? '52px minmax(0, 1fr) 72px'
          : '72px minmax(0, 1fr) 52px',
      },
      gridTemplateAreas: {
        xs: '"logo info score"',
        md: align === 'right' ? '"score info logo"' : '"logo info score"',
      },
      alignItems: 'center',
      gap: 1,
      width: '100%',
      minWidth: 0,
    }}
  >
    <Box
      sx={{
        gridArea: 'logo',
        lineHeight: 0,
        display: 'flex',
        justifyContent: { xs: 'flex-start', md: align === 'right' ? 'flex-end' : 'flex-start' },
      }}
    >
      <TeamLogo name={team.name} size={36} />
    </Box>
    <Box
      sx={{
        minWidth: 0,
        gridArea: 'info',
        textAlign: { xs: 'left', md: align },
      }}
    >
      <Stack
        direction="row"
        spacing={0.6}
        sx={{
          alignItems: 'baseline',
          justifyContent: { xs: 'flex-start', md: align === 'right' ? 'flex-end' : 'flex-start' },
          minWidth: 0,
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', fontWeight: 600, flexShrink: 0 }}
        >
          {rank > 0 ? `#${rank}` : 'NR'}
        </Typography>
        <Box
          sx={{
            minWidth: 0,
            flex: { xs: 1, md: 'initial' },
            '& .MuiLink-root': {
              color: 'text.primary',
              fontSize: '1.15rem',
              fontWeight: winner ? 800 : 700,
              lineHeight: 1.1,
              textDecoration: 'none',
              display: 'block',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              '&:hover': { textDecoration: 'underline' },
            },
          }}
        >
          <TeamLink name={team.name} onTeamClick={onTeamClick} />
        </Box>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
        {team.record} · OVR {team.rating}
      </Typography>
    </Box>
    <Box
      sx={{
        gridArea: 'score',
        minHeight: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: {
          xs: 'flex-end',
          md: align === 'right' ? 'flex-start' : 'flex-end',
        },
      }}
    >
      <Typography
        variant="h5"
        aria-label={typeof score === 'number' ? `${team.name} score ${score}` : undefined}
        aria-hidden={typeof score !== 'number'}
        sx={{
          visibility: typeof score === 'number' ? 'visible' : 'hidden',
          fontSize: { md: '2.125rem' },
          fontWeight: winner ? 800 : 600,
          lineHeight: 1,
        }}
      >
        {score ?? '\u00a0'}
      </Typography>
    </Box>
  </Box>
);

export default function GameMatchupHeader(props: GameMatchupHeaderProps) {
  const { game, away, home, neutral, mode, onTeamClick } = props;
  const isResult = mode === 'result';
  const venue = neutral
    ? formatNeutralSite(game.venue)
    : `${home.team.stadium} • ${home.team.city}, ${home.team.state}`;
  const status = isResult
    ? props.overtime > 1
      ? `Final · ${props.overtime}OT`
      : props.overtime === 1
        ? 'Final · OT'
        : 'Final'
    : 'Scheduled';

  return (
    <Paper
      component="header"
      variant="outlined"
      sx={{
        p: { xs: 1.25, md: 1.5 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(0, 1fr) minmax(280px, 0.9fr) minmax(0, 1fr)',
          },
          gridTemplateAreas: {
            xs: '"context" "away" "home"',
            md: '"away context home"',
          },
          alignItems: 'center',
          gap: { xs: 0.9, md: 2 },
        }}
      >
        <Box sx={{ gridArea: 'away', minWidth: 0 }}>
          <TeamIdentity {...away} align="left" onTeamClick={onTeamClick} />
        </Box>

        <Box sx={{ gridArea: 'context', textAlign: 'center', minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {status}
          </Typography>
          {game.label && (
            <Typography
              component="h1"
              variant="h6"
              sx={{ mt: 0.1, lineHeight: 1.15 }}
            >
              {game.label}
            </Typography>
          )}
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 0.35,
            }}
          >
            Week {game.weekPlayed} · {game.year} · {venue}
          </Typography>
        </Box>

        <Box sx={{ gridArea: 'home', minWidth: 0 }}>
          <TeamIdentity {...home} align="right" onTeamClick={onTeamClick} />
        </Box>
      </Box>
    </Paper>
  );
}
