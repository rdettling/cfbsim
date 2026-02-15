import type { Team } from '../types/domain';

export const buildBaseLabel = (team: Team, opponent: Team, name?: string | null) => {
  if (name) return name;
  const teamConf = team.conference;
  const oppConf = opponent.conference;
  if (teamConf && oppConf && teamConf === oppConf) {
    return `Conference: ${teamConf}`;
  }
  const teamLabel = teamConf || 'Independent';
  const oppLabel = oppConf || 'Independent';
  return `Non-Conference: ${teamLabel} vs ${oppLabel}`;
};
