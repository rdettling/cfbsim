import type {
  BubbleTeamEntry,
  ConferenceChampionEntry,
} from '../../../../types/postseason';
import { formatPostseasonRecord, loadPostseasonContext } from './context';

export const loadPlayoffPicture = async () => {
  const context = await loadPostseasonContext();
  const selectedIds = new Set(context.playoffTeams.map(team => team.id));
  const bubble_teams: BubbleTeamEntry[] = context.league.teams
    .slice()
    .sort((left, right) => left.ranking - right.ranking)
    .filter(team => !selectedIds.has(team.id))
    .slice(0, 5)
    .map(team => ({
      name: team.name,
      ranking: team.ranking,
      conference: team.conference ?? 'Independent',
      record: formatPostseasonRecord(team),
    }));
  const conference_champions: ConferenceChampionEntry[] = context.championResolutions.map(resolution => ({
    name: resolution.team.name,
    ranking: resolution.team.ranking,
    conference: resolution.team.conference ?? 'Independent',
    record: formatPostseasonRecord(resolution.team),
    seed: context.playoff_teams.find(entry => entry.name === resolution.team.name)?.seed ?? null,
    is_projected: resolution.status === 'projected',
  }));

  return {
    ...context.page,
    playoff_teams: context.playoff_teams,
    bubble_teams,
    conference_champions,
  };
};
