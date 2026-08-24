import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { POSITION_ORDER } from '../../../rosterConfig';
import { listTeamNames, resolveTeam } from './shared';

export const loadTeamRoster = async (teamName?: string) => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const team = resolveTeam(league, teamName);
  const roster = players.filter(player => player.teamId === team.id);
  const positionSet = new Set(roster.map(player => player.pos));
  const orderedPositions = POSITION_ORDER.filter(position => positionSet.has(position));
  const extraPositions = [...positionSet]
    .filter(position => !POSITION_ORDER.includes(position))
    .sort((left, right) => left.localeCompare(right));

  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    team,
    roster,
    positions: [...orderedPositions, ...extraPositions],
    conferences: league.conferences,
    teams: listTeamNames(league),
  };
};
