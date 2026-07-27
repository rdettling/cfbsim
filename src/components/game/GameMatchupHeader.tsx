import { Box, Paper, Stack, Typography } from '@mui/material';
import type { Team } from '../../types/domain';
import { TeamLink, TeamLogo } from '../team/TeamComponents';

type MatchupGame = {
  label: string;
  weekPlayed: number;
  year: number;
  headline?: string | null;
};

type MatchupTeam = {
  team: Team;
  rank: number;
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
  awayScore: number;
  homeScore: number;
  overtime: number;
  headlineSubtitle?: string | null;
};

export type GameMatchupHeaderProps = PreviewMatchupHeaderProps | ResultMatchupHeaderProps;

type TeamIdentityProps = MatchupTeam & {
  align: 'left' | 'right';
  compact: boolean;
  onTeamClick: (name: string) => void;
};

const TeamIdentity = ({ team, rank, align, compact, onTeamClick }: TeamIdentityProps) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: {
        xs: 'flex-start',
        md: align === 'right' ? 'flex-end' : 'flex-start',
      },
      minWidth: 0,
    }}
  >
    <Stack
      direction="row"
      spacing={compact ? 0.75 : 1}
      sx={{
        alignItems: 'center',
        minWidth: 0,
        width: { xs: '100%', md: 'auto' },

        flexDirection: {
          xs: 'row',
          md: compact ? 'row' : align === 'right' ? 'row-reverse' : 'row',
        },
      }}
    >
      <Box sx={{ lineHeight: 0, flexShrink: 0 }}>
        <TeamLogo name={team.name} size={compact ? 30 : 40} />
      </Box>
      <Box
        sx={{
          minWidth: 0,
          textAlign: { xs: 'left', md: align },
          flex: { xs: 1, md: 'initial' },
        }}
      >
        <Stack
          direction="row"
          spacing={0.6}
          sx={{
            alignItems: 'baseline',
            minWidth: 0,

            justifyContent: {
              xs: 'flex-start',
              md: align === 'right' ? 'flex-end' : 'flex-start',
            },
          }}
        >
          <Typography
            variant={compact ? 'body1' : 'h6'}
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {rank > 0 ? `#${rank}` : 'NR'}
          </Typography>
          <Box
            sx={{
              minWidth: 0,
              '& .MuiLink-root': {
                color: 'text.primary',
                fontSize: '1.5rem',
                fontWeight: 800,
                lineHeight: 1,
                textDecoration: 'none',
                display: 'block',
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
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.25,
          }}
        >
          {team.record} · OVR {team.rating}
        </Typography>
      </Box>
    </Stack>
  </Box>
);

export default function GameMatchupHeader(props: GameMatchupHeaderProps) {
  const { game, away, home, neutral, mode, onTeamClick } = props;
  const isResult = mode === 'result';
  const venue = neutral
    ? 'Neutral Site'
    : `${home.team.stadium} • ${home.team.city}, ${home.team.state}`;
  const resultStatus = isResult
    ? props.overtime > 1
      ? `Final · ${props.overtime}OT`
      : props.overtime === 1
        ? 'Final · OT'
        : 'Final'
    : null;

  return (
    <Paper
      component="header"
      variant="outlined"
      sx={{
        p: { xs: isResult ? 1.05 : 1.5, md: isResult ? 1.05 : 1.75 },
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
            xs: isResult ? '"away" "context" "home"' : '"context" "away" "home"',
            md: '"away context home"',
          },
          alignItems: 'center',
          gap: { xs: 1.25, md: 2 },
        }}
      >
        <Box sx={{ gridArea: 'away', minWidth: 0 }}>
          <TeamIdentity {...away} align="left" compact={isResult} onTeamClick={onTeamClick} />
        </Box>

        <Box sx={{ gridArea: 'context', textAlign: 'center', minWidth: 0 }}>
          {isResult && (
            <>
              <Typography
                variant="overline"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {resultStatus}
              </Typography>
              <Typography
                variant="h3"
                sx={{ color: 'primary.main', fontWeight: 700, lineHeight: 1 }}
              >
                {props.awayScore} - {props.homeScore}
              </Typography>
            </>
          )}
          {game.label && (
            <Typography
              component="h1"
              variant={isResult ? 'h6' : 'h5'}
              sx={{ mt: isResult ? 0.25 : 0, lineHeight: 1.15 }}
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
          {isResult && game.headline && (
            <Typography variant="body1" sx={{ mt: 0.35, fontStyle: 'italic', lineHeight: 1.2 }}>
              {game.headline}
            </Typography>
          )}
          {isResult && props.headlineSubtitle && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mt: 0.15,
                lineHeight: 1.2,
              }}
            >
              {props.headlineSubtitle}
            </Typography>
          )}
        </Box>

        <Box sx={{ gridArea: 'home', minWidth: 0 }}>
          <TeamIdentity {...home} align="right" compact={isResult} onTeamClick={onTeamClick} />
        </Box>
      </Box>
    </Paper>
  );
}
