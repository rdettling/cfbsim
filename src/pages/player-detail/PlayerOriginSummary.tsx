import { TeamLink } from '../../components/team/TeamLink';
import { PLAYER_YEAR_LABELS } from '../../constants/player';
import type { RecruitPlayerOrigin } from '../../types/db';
import type { PlayerPageData } from '../../types/pages';

type PlayerOriginSummaryProps = {
  origin: PlayerPageData['origin'];
  onTeamClick: (teamName: string) => void;
};

const commitmentLabel = (round: RecruitPlayerOrigin['commitmentRound']) =>
  round === 'signing_day' ? 'Signing Day' : `Round ${round}`;

export const PlayerOriginSummary = ({
  origin,
  onTeamClick,
}: PlayerOriginSummaryProps) => {
  if (origin.kind === 'recruit') {
    return (
      <>
        {origin.acquisitionYear} recruiting class · #{origin.nationalRank} national · #
        {origin.positionRank} at position · From {origin.homeState} · Signed with{' '}
        <TeamLink name={origin.originalTeam} onTeamClick={onTeamClick} /> ·{' '}
        {commitmentLabel(origin.commitmentRound)} · Public scouting range{' '}
        {origin.publicRatingMin}–{origin.publicRatingMax}
      </>
    );
  }

  if (origin.kind === 'walk_on') {
    return (
      <>
        Walk-on · Joined{' '}
        <TeamLink name={origin.originalTeam} onTeamClick={onTeamClick} /> in{' '}
        {origin.acquisitionYear}
      </>
    );
  }

  if (origin.kind === 'initial_roster') {
    return (
      <>
        Initial dynasty roster · {PLAYER_YEAR_LABELS[origin.classAtStart]} at{' '}
        <TeamLink name={origin.originalTeam} onTeamClick={onTeamClick} /> in{' '}
        {origin.acquisitionYear}
      </>
    );
  }

  return (
    <>
      Program entry roster · {PLAYER_YEAR_LABELS[origin.classAtEntry]} when{' '}
      <TeamLink name={origin.originalTeam} onTeamClick={onTeamClick} /> joined in{' '}
      {origin.acquisitionYear}
    </>
  );
};
