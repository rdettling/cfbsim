import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { SeasonSummaryChampion, SeasonSummaryTeam, TeamSelectionHandler } from './types';

type SeasonOverviewProps = {
  champion: SeasonSummaryChampion | null;
  userTeam: SeasonSummaryTeam;
  onTeamClick: TeamSelectionHandler;
};

const formatRank = (ranking: number) => (ranking > 0 ? `#${ranking}` : 'Unranked');

type OverviewTeam = Pick<
  SeasonSummaryTeam,
  'id' | 'name' | 'totalWins' | 'totalLosses' | 'ranking'
>;

const TeamIdentity = ({
  team,
  onTeamClick,
}: {
  team: OverviewTeam;
  onTeamClick: TeamSelectionHandler;
}) => (
  <Stack
    direction="row"
    spacing={1.5}
    sx={{
      alignItems: 'center',
    }}
  >
    <TeamLogo name={team.name} size={48} />
    <Box sx={{ minWidth: 0 }}>
      <Typography component="div" variant="h6" sx={{ fontWeight: 800 }}>
        <TeamLink name={team.name} onTeamClick={onTeamClick} />
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {team.totalWins}-{team.totalLosses} · {formatRank(team.ranking)}
      </Typography>
    </Box>
  </Stack>
);

export const SeasonOverview = ({ champion, userTeam, onTeamClick }: SeasonOverviewProps) => {
  const prestigeChange = userTeam.prestige_change ?? 0;
  const nextPrestige = userTeam.prestige + prestigeChange;
  const isChampion = champion?.id === userTeam.id;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        gap: 1.25,
      }}
    >
      <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
              }}
            >
              National Champion
            </Typography>
            {champion ? (
              <Box sx={{ mt: 0.75 }}>
                <TeamIdentity team={champion} onTeamClick={onTeamClick} />
              </Box>
            ) : (
              <Box sx={{ mt: 0.75 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Champion unavailable
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  No completed championship result was returned for this season.
                </Typography>
              </Box>
            )}
          </Box>
          {champion && (
            <Chip label="National Champion" color="success" variant="outlined" size="small" />
          )}
        </Stack>
      </Paper>
      <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
              }}
            >
              Your Season
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <TeamIdentity team={userTeam} onTeamClick={onTeamClick} />
            </Box>
          </Box>
          {isChampion && <Chip label="Champion" color="success" variant="outlined" size="small" />}
        </Stack>
        <Stack
          direction="row"
          spacing={2.5}
          sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
              }}
            >
              Current Prestige
            </Typography>
            <Typography variant="subtitle2">Tier {userTeam.prestige}</Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
              }}
            >
              Next Prestige
            </Typography>
            <Typography variant="subtitle2">Tier {nextPrestige}</Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
              }}
            >
              Movement
            </Typography>
            <Typography variant="subtitle2">
              {prestigeChange > 0 ? `+${prestigeChange}` : prestigeChange}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};
