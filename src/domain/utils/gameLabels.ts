import type { Team } from '../../types/domain';

export const buildConferenceGameLabel = (
  teamConference: string | null | undefined,
  opponentConference: string | null | undefined,
  name?: string | null,
) => {
  if (name) return name;
  if (
    teamConference &&
    opponentConference &&
    teamConference === opponentConference
  ) {
    return `Conference: ${teamConference}`;
  }
  const teamLabel = teamConference || 'Independent';
  const opponentLabel = opponentConference || 'Independent';
  return `Non-Conference: ${teamLabel} vs ${opponentLabel}`;
};

export const buildBaseLabel = (team: Team, opponent: Team, name?: string | null) => {
  return buildConferenceGameLabel(
    team.conference,
    opponent.conference,
    name,
  );
};
