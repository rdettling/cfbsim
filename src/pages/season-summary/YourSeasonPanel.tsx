import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type {
  SeasonSummaryLegacy,
  SeasonSummaryTeam,
  TeamSelectionHandler,
} from './types';

type YourSeasonPanelProps = {
  userTeam: SeasonSummaryTeam;
  legacy: SeasonSummaryLegacy | null;
  onTeamClick: TeamSelectionHandler;
};

const formatRank = (ranking: number) => (ranking > 0 ? `#${ranking}` : 'Unranked');

const formatPrestigeMovement = (change: number) => {
  if (change === 0) return 'No change';
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
};

export const YourSeasonPanel = ({
  userTeam,
  legacy,
  onTeamClick,
}: YourSeasonPanelProps) => {
  const prestigeChange = userTeam.prestige_change;
  const nextPrestige = userTeam.prestige + prestigeChange;
  const accomplishments = legacy?.accomplishments ?? [];
  const milestones = legacy?.milestones ?? [];
  const signatureGames = legacy?.signatureGames ?? [];

  return (
    <Paper
      component="section"
      aria-labelledby="your-season-title"
      variant="outlined"
      sx={{
        p: { xs: 1.25, md: 1.5 },
        borderLeft: '3px solid',
        borderLeftColor: userTeam.colorPrimary || 'primary.main',
        minWidth: 0,
      }}
    >
      <Typography
        id="your-season-title"
        component="h2"
        variant="overline"
        sx={{ color: 'text.secondary', letterSpacing: 1, lineHeight: 1.4 }}
      >
        Your Season
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
          gap: { xs: 1, sm: 2 },
          alignItems: 'center',
          mt: 0.25,
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: 'center', minWidth: 0 }}
        >
          <TeamLogo name={userTeam.name} size={44} />
          <Box sx={{ minWidth: 0 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 800 }}>
              <TeamLink name={userTeam.name} onTeamClick={onTeamClick} />
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {userTeam.totalWins}-{userTeam.totalLosses} · Final {formatRank(userTeam.ranking)}
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            minWidth: 0,
            textAlign: { xs: 'left', sm: 'right' },
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Prestige
          </Typography>
          <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
            Tier {userTeam.prestige} → Tier {nextPrestige} ·{' '}
            {formatPrestigeMovement(prestigeChange)}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 1 }} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
          gap: { xs: 1.25, sm: 2 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
            Season Highlights
          </Typography>
          <Stack
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}
            aria-label="Season accomplishments"
          >
            {accomplishments.length ? accomplishments.map(accomplishment => (
              <Chip
                key={`${accomplishment.type}-${accomplishment.label}`}
                label={accomplishment.label}
                size="small"
                variant="outlined"
              />
            )) : (
              <Chip label="Season complete" size="small" variant="outlined" />
            )}
          </Stack>
          <Stack spacing={0.25}>
            {milestones.length ? milestones.map(milestone => (
              <Typography key={milestone} variant="body2">
                {milestone}
              </Typography>
            )) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No new dynasty milestones this season.
              </Typography>
            )}
          </Stack>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
            Signature Games
          </Typography>
          <Stack spacing={0.25}>
            {signatureGames.length ? signatureGames.map(game => (
              <Link
                key={game.id}
                component={RouterLink}
                to={`/game/${game.id}`}
                underline="none"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '3.5rem 1.25rem 2.75rem minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 0.75,
                  color: 'text.primary',
                  width: '100%',
                  '&:hover .signature-game-opponent, &:focus-visible .signature-game-opponent': {
                    textDecoration: 'underline',
                  },
                }}
              >
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                >
                  Week {game.week}
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    color: game.result === 'W' ? 'success.main' : 'error.main',
                    fontWeight: 800,
                  }}
                >
                  {game.result}
                </Typography>
                <Box
                  sx={{
                    width: '2.75rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <TeamLogo name={game.opponent} size={22} />
                </Box>
                <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <Typography
                    component="span"
                    variant="body2"
                    className="signature-game-opponent"
                  >
                    {game.opponent}
                  </Typography>
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                    {' · '}{game.gameLabel}
                  </Typography>
                </Box>
                <Typography component="span" variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                  {game.score.replace('-', '–')}
                </Typography>
              </Link>
            )) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No signature games were identified.
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
};
