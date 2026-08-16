import type { Team } from '../../types/domain';

export const isConferenceGame = (team: Team, opponent: Team) =>
  team.conference === opponent.conference && team.conference !== 'Independent';

export const registerMatchup = (team: Team, opponent: Team) => {
  if (isConferenceGame(team, opponent)) {
    team.confGames += 1;
    opponent.confGames += 1;
  } else {
    team.nonConfGames += 1;
    opponent.nonConfGames += 1;
  }
};

export const resetTeamScheduleCounts = (teams: Team[]) => {
  teams.forEach(team => {
    team.confGames = 0;
    team.nonConfGames = 0;
  });
};
