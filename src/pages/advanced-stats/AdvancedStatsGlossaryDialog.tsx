import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  EVIDENCE_PERFORMANCE_WEIGHT,
  EVIDENCE_RESUME_WEIGHT,
  getTeamRatingPriorWeight,
  RANKING_RECORD_WEIGHT,
  RANKING_WINS_OVER_EXPECTATION_WEIGHT,
  TEAM_RATING_CEILING,
  TEAM_RATING_FLOOR,
} from '../../domain/sim/rankingScores';
import { ADVANCED_METRIC_COLUMNS } from './config';

type GlossaryDialogProps = {
  open: boolean;
  onClose: () => void;
};

const Definition = ({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) => (
  <Box>
    <Typography variant="subtitle2">{term}</Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {children}
    </Typography>
  </Box>
);

const Formula = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1.25, py: 1 }}>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {children}
    </Typography>
  </Box>
);

const MetricList = ({ mode }: { mode: 'offense' | 'defense' }) => (
  <Stack spacing={1.25}>
    {ADVANCED_METRIC_COLUMNS[mode].slice(1).map(metric => (
      <Definition key={metric.key} term={metric.mobileLabel}>
        {metric.description}{' '}
        <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {metric.direction === 'desc' ? 'Higher is better.' : 'Lower is better.'}
        </Box>
      </Definition>
    ))}
  </Stack>
);

export const AdvancedStatsGlossaryContent = () => (
  <Stack spacing={2.5} divider={<Divider flexItem />}>
    <Stack component="section" spacing={1.25} aria-labelledby="glossary-poll-heading">
      <Typography id="glossary-poll-heading" variant="h6">Poll and ranking</Typography>
      <Definition term="Official Poll Rank">
        The team’s published place in the poll. Sorting this page by another
        metric does not change the official rank shown beside the team.
      </Definition>
      <Definition term="Poll Score">
        The published 0–100 score used to order the poll. First place is not
        automatically 100, so the score shows the distance between teams.
      </Definition>
      <Definition term="Projected Poll Score">
        What the latest completed-game inputs would produce now. During a
        partially completed week or postseason freeze, it remains informational
        until the normal ranking publication replaces the published Poll Score.
      </Definition>
      <Definition term="Team Rating and Team Score">
        Team Rating is the forward-looking, player-based strength used to
        simulate games. Team Score maps that rating from the fixed{' '}
        {TEAM_RATING_FLOOR}–{TEAM_RATING_CEILING} scale onto 0–100 for the
        early-season poll prior.
      </Definition>
      <Formula>
        Team Score = (Team Rating − {TEAM_RATING_FLOOR}) ÷ ({TEAM_RATING_CEILING}
        {' '}− {TEAM_RATING_FLOOR}) × 100, limited to 0–100
      </Formula>
      <Definition term="Wins Over Expectation">
        Wins above or below what an average team would be expected to produce
        against the same opponents, averaged across completed games.
      </Definition>
      <Definition term="Résumé Score">
        A 0–100 measure of wins and losses relative to schedule difficulty.
        It uses winning percentage and wins over expectation; play efficiency and
        scoring margin are excluded. Its fixed theoretical range of −0.30 to 1.0
        is mapped onto 0–100.
      </Definition>
      <Formula>
        Résumé value = {(RANKING_RECORD_WEIGHT * 100).toFixed(0)}% × winning
        percentage + {(RANKING_WINS_OVER_EXPECTATION_WEIGHT * 100).toFixed(0)}%
        × wins over expectation per game
      </Formula>
      <Definition term="Evidence Score">
        The poll’s completed-game basis. It gives substantially more weight
        to the win-and-loss résumé than to play-by-play performance.
      </Definition>
      <Formula>
        Evidence Score = {(EVIDENCE_RESUME_WEIGHT * 100).toFixed(1)}% × Résumé
        Score + {(EVIDENCE_PERFORMANCE_WEIGHT * 100).toFixed(1)}% × Performance Index
      </Formula>
      <Definition term="Team Rating prior">
        The early-season share supplied by Team Score. It declines with each
        completed game and reaches zero after eight games; by then the poll is
        entirely evidence-based.
      </Definition>
      <Formula>
        Poll Score = prior × Team Score + (1 − prior) × Evidence Score
      </Formula>
      <Box
        aria-label="Team Rating prior by games played"
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}
      >
        {Array.from({ length: 9 }, (_, games) => (
          <Box
            key={games}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0.75 }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {games === 8 ? '8+ games' : `${games} ${games === 1 ? 'game' : 'games'}`}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {(getTeamRatingPriorWeight(games) * 100).toFixed(0)}% prior
            </Typography>
          </Box>
        ))}
      </Box>
      <Definition term="Postseason rank override">
        Playoff selection can reorder teams for autobids or conference-champion
        placement, and the champion and runner-up finish No. 1 and No. 2. These
        are the only explicit cases where official rank can differ from Poll
        Score order; the model score itself is not replaced.
      </Definition>
    </Stack>

    <Stack component="section" spacing={1.25} aria-labelledby="glossary-performance-heading">
      <Typography id="glossary-performance-heading" variant="h6">Performance</Typography>
      <Definition term="Performance Index">
        A backward-looking 0–100 description of how a team played in completed
        games, adjusted for each opponent’s stable Team Rating. The evaluated
        team’s own Team Rating, record, location, result, and margin do not enter it.
      </Definition>
      <Definition term="Offense and Defense Performance">
        The two equal halves of Performance Index. Higher is better for both;
        Defense Performance reverses defensive inputs where allowing less is better.
      </Definition>
      <Formula>
        Raw unit = 50% success-rate z-score + 15% successful-play-yards z-score
        + 15% points-per-opportunity z-score + 10% field-position z-score
        + 10% havoc z-score
      </Formula>
      <Formula>
        Opponent signal = (opponent Team Score − 50) ÷ 15; adjusted unit = raw
        unit + 0.35 × average opponent signal
      </Formula>
      <Formula>
        Unit Performance = 50 + 15 × adjusted unit; Performance Index is the
        average of offense and defense
      </Formula>
    </Stack>

    <Stack component="section" spacing={1.25} aria-labelledby="glossary-offense-heading">
      <Typography id="glossary-offense-heading" variant="h6">Offense metrics</Typography>
      <MetricList mode="offense" />
    </Stack>

    <Stack component="section" spacing={1.25} aria-labelledby="glossary-defense-heading">
      <Typography id="glossary-defense-heading" variant="h6">Defense metrics</Typography>
      <MetricList mode="defense" />
    </Stack>
  </Stack>
);

export const AdvancedStatsGlossaryDialog = ({
  open,
  onClose,
}: GlossaryDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    fullWidth
    maxWidth="md"
    aria-labelledby="advanced-stats-glossary-title"
    slotProps={{
      paper: {
        variant: 'outlined',
        sx: { maxHeight: 'min(820px, 92dvh)' },
      },
    }}
  >
    <DialogTitle id="advanced-stats-glossary-title" sx={{ pr: 7 }}>
      Advanced Statistics Glossary
      <IconButton
        aria-label="Close glossary"
        onClick={onClose}
        sx={{ position: 'absolute', right: 12, top: 10 }}
      >
        <CloseIcon />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers>
      <AdvancedStatsGlossaryContent />
    </DialogContent>
  </Dialog>
);
