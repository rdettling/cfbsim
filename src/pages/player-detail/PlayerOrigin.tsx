import { Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import type { PlayerPageData } from '../../types/pages';
import type { RecruitPlayerOrigin } from '../../types/db';

type PlayerOriginProps = {
  origin: PlayerPageData['origin'];
  onTeamClick: (teamName: string) => void;
};

const classLabels = {
  fr: 'Freshman',
  so: 'Sophomore',
  jr: 'Junior',
  sr: 'Senior',
} as const;

const commitmentLabel = (round: RecruitPlayerOrigin['commitmentRound']) =>
  round === 'signing_day' ? 'Signing Day' : `Round ${round}`;

export const PlayerOrigin = ({ origin, onTeamClick }: PlayerOriginProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-labelledby="player-origin-heading"
    sx={{ mb: 1.5, p: { xs: 1.5, md: 2 } }}
  >
    <Typography id="player-origin-heading" variant="overline" color="text.secondary">
      Dynasty-era origin
    </Typography>
    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
      {origin.kind === 'recruit' && (
        <>
          <Typography variant="subtitle1">
            {origin.acquisitionYear} recruiting class · #{origin.nationalRank} national · #
            {origin.positionRank} at position
          </Typography>
          <Typography variant="body2" color="text.secondary">
            From {origin.homeState} · Signed with{' '}
            <TeamLink name={origin.originalTeam} onTeamClick={onTeamClick} /> ·{' '}
            {commitmentLabel(origin.commitmentRound)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Original public scouting range: {origin.publicRatingMin}–
            {origin.publicRatingMax}
          </Typography>
        </>
      )}
      {origin.kind === 'walk_on' && (
        <>
          <Typography variant="subtitle1">Walk-on · Joined in {origin.acquisitionYear}</Typography>
          <Typography variant="body2" color="text.secondary">
            Original team:{' '}
            <TeamLink name={origin.originalTeam} onTeamClick={onTeamClick} />
          </Typography>
        </>
      )}
      {origin.kind === 'initial_roster' && (
        <>
          <Typography variant="subtitle1">Initial dynasty roster</Typography>
          <Typography variant="body2" color="text.secondary">
            {classLabels[origin.classAtStart]} at the start of {origin.acquisitionYear} ·{' '}
            <TeamLink name={origin.originalTeam} onTeamClick={onTeamClick} />
          </Typography>
        </>
      )}
    </Stack>
  </Paper>
);
