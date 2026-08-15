import { useState } from 'react';
import { Box, Button, Chip, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type {
  AwardDisplayEntry,
  AwardDisplayPlacement,
  AwardGroup,
  AwardMode,
} from '../../types/awards';

type TeamSelectionHandler = (teamName: string) => void;

interface AwardsBoardProps {
  awards: AwardDisplayEntry[];
  mode: AwardMode;
  onTeamClick: TeamSelectionHandler;
  emptyTitle?: string;
  emptyDescription?: string;
}

interface AwardStandingsProps {
  id: string;
  mode: AwardMode;
  placements: AwardDisplayPlacement[];
  onTeamClick: TeamSelectionHandler;
}

const GROUPS: Array<{ id: AwardGroup; label: string; domId: string }> = [
  { id: 'overall', label: 'Overall', domId: 'overall' },
  { id: 'offense', label: 'Offense', domId: 'offense' },
  { id: 'defense', label: 'Defense', domId: 'defense' },
  { id: 'specialTeams', label: 'Special Teams', domId: 'special-teams' },
];

const getPlacementLabel = (
  placement: AwardDisplayPlacement['key'],
  mode: AwardMode,
) => {
  if (placement === 'first') return mode === 'final' ? 'Winner' : 'Leader';
  return placement === 'second' ? 'Second' : 'Third';
};

export const getNextExpandedAward = (
  currentSlug: string | null,
  selectedSlug: string,
) => currentSlug === selectedSlug ? null : selectedSlug;

const PlayerIdentity = ({
  placement,
  logoSize,
  onTeamClick,
}: {
  placement: AwardDisplayPlacement;
  logoSize: number;
  onTeamClick: TeamSelectionHandler;
}) => {
  const { player } = placement;
  if (!player) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No candidate
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
      <TeamLogo name={player.teamName} size={logoSize} />
      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <MuiLink
            component={RouterLink}
            to={`/players/${player.id}`}
            underline="hover"
            sx={{ fontWeight: 700 }}
          >
            {player.first} {player.last}
          </MuiLink>
          <Chip label={player.position.toUpperCase()} size="small" variant="outlined" />
        </Stack>
        <TeamLink name={player.teamName} onTeamClick={onTeamClick} />
      </Box>
    </Stack>
  );
};

export const AwardStandings = ({
  id,
  mode,
  placements,
  onTeamClick,
}: AwardStandingsProps) => (
  <Box
    id={id}
    sx={{
      borderTop: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.default',
      px: { xs: 1.5, md: 2 },
    }}
  >
    {placements.map(placement => (
      <Box
        key={placement.key}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '58px minmax(0, 1fr) auto',
            md: '72px minmax(220px, 0.9fr) minmax(0, 1.3fr) auto',
          },
          columnGap: { xs: 1, md: 1.5 },
          rowGap: 0.5,
          alignItems: 'center',
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:last-of-type': { borderBottom: 0 },
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          {getPlacementLabel(placement.key, mode)}
        </Typography>
        <PlayerIdentity placement={placement} logoSize={24} onTeamClick={onTeamClick} />
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            gridColumn: { xs: '2 / -1', md: 3 },
            gridRow: { xs: 2, md: 1 },
          }}
        >
          {placement.player ? placement.statLine ?? 'No stats yet' : 'No eligible candidate yet'}
        </Typography>
        <Box sx={{ textAlign: 'right', gridColumn: { xs: 3, md: 4 }, gridRow: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Score
          </Typography>
          <Typography variant="subtitle2">
            {placement.score === null ? '—' : placement.score.toFixed(1)}
          </Typography>
        </Box>
      </Box>
    ))}
  </Box>
);

const AwardRow = ({
  award,
  mode,
  expanded,
  onToggle,
  onTeamClick,
}: {
  award: AwardDisplayEntry;
  mode: AwardMode;
  expanded: boolean;
  onToggle: () => void;
  onTeamClick: TeamSelectionHandler;
}) => {
  const leader = award.placements.find(placement => placement.key === 'first')
    ?? award.placements[0]
    ?? null;
  const candidateCount = award.placements.filter(placement => placement.player !== null).length;
  const canExpand = candidateCount >= 2;
  const panelId = `award-${award.categorySlug}-standings`;
  const actionLabel = mode === 'final' ? 'finalists' : 'race';

  return (
    <Box component="article" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr) auto',
            md: 'minmax(190px, 0.8fr) minmax(220px, 1fr) minmax(260px, 1.25fr) auto',
          },
          columnGap: { xs: 1, md: 2 },
          rowGap: { xs: 1, md: 0 },
          alignItems: 'center',
          px: { xs: 1.5, md: 2 },
          py: 1.25,
        }}
      >
        <Box sx={{ minWidth: 0, gridColumn: { xs: 1, md: 1 }, gridRow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {award.categoryName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {award.categoryDescription}
          </Typography>
        </Box>

        <Box
          sx={{
            minWidth: 0,
            gridColumn: { xs: '1 / -1', md: 2 },
            gridRow: { xs: 2, md: 1 },
          }}
        >
          {leader?.player ? (
            <PlayerIdentity placement={leader} logoSize={28} onTeamClick={onTeamClick} />
          ) : (
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              No leader yet
            </Typography>
          )}
        </Box>

        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            gridColumn: { xs: '1 / -1', md: 3 },
            gridRow: { xs: 3, md: 1 },
          }}
        >
          {leader?.player
            ? leader.statLine ?? 'No stats yet'
            : 'Eligible players will appear after games are played.'}
        </Typography>

        <Box sx={{ gridColumn: { xs: 2, md: 4 }, gridRow: 1, textAlign: 'right' }}>
          {canExpand && (
            <Button
              size="small"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={panelId}
            >
              {expanded ? `Hide ${actionLabel}` : `View ${actionLabel}`}
            </Button>
          )}
        </Box>
      </Box>

      {expanded && canExpand && (
        <AwardStandings
          id={panelId}
          mode={mode}
          placements={award.placements}
          onTeamClick={onTeamClick}
        />
      )}
    </Box>
  );
};

export const AwardsBoard = ({
  awards,
  mode,
  onTeamClick,
  emptyTitle = 'Awards are unavailable',
  emptyDescription = 'No award categories were returned for this season.',
}: AwardsBoardProps) => {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  if (!awards.length) {
    return (
      <Paper variant="outlined" sx={{ width: '100%', p: 3, textAlign: 'center' }}>
        <Typography variant="h6">{emptyTitle}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {emptyDescription}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      component="section"
      aria-label="Awards board"
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: { lg: 1 },
        minHeight: { lg: 0 },
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, overflowY: { lg: 'auto' } }}>
        {GROUPS.map(group => {
          const groupAwards = awards.filter(award => award.group === group.id);
          if (!groupAwards.length) return null;
          const headingId = `award-group-${group.domId}`;
          return (
            <Box component="section" aria-labelledby={headingId} key={group.id}>
              <Box sx={{ px: 2, py: 0.75, bgcolor: 'background.default' }}>
                <Typography
                  id={headingId}
                  component="h2"
                  variant="overline"
                  sx={{ color: 'text.secondary', letterSpacing: 1 }}
                >
                  {group.label}
                </Typography>
              </Box>
              {groupAwards.map(award => (
                <AwardRow
                  key={award.categorySlug}
                  award={award}
                  mode={mode}
                  expanded={expandedSlug === award.categorySlug}
                  onToggle={() => setExpandedSlug(current =>
                    getNextExpandedAward(current, award.categorySlug)
                  )}
                  onTeamClick={onTeamClick}
                />
              ))}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};
