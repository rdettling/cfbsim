import { getAllGames } from '../../../../db/simRepo';
import type { Team } from '../../../../types/domain';
import type { LeagueState } from '../../../../types/league';
import { loadLeagueOrThrow } from '../../leagueStore';
import { buildPlayoffSelection } from '../../utils/playoffSelection';
import {
  buildConferenceStandings,
  resolveConferenceChampion,
} from '../../utils/standings';
import { buildLeagueNavigationEnvelope } from '../navigationEnvelope';

export const formatPostseasonRecord = (team: Team) =>
  `${team.totalWins}-${team.totalLosses} (${team.confWins}-${team.confLosses})`;

export const loadPostseasonContext = async (loadedLeague?: LeagueState) => {
  const league = loadedLeague ?? await loadLeagueOrThrow();
  const games = await getAllGames();
  const format = league.settings.playoffTeams;
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const persistedTeams = league.playoff.seeds
    .map(id => teamsById.get(id))
    .filter((team): team is Team => Boolean(team));
  const hasPersistedField =
    league.playoff.seeds.length === format && persistedTeams.length === format;
  const isProjection = !hasPersistedField;

  const championResolutions = [];
  for (const conference of league.conferences) {
    if (conference.confName === 'Independent') continue;
    const standings = buildConferenceStandings({
      teams: league.teams.filter(team => team.conference === conference.confName),
      games,
      year: league.info.currentYear,
      finalStandings: conference.finalStandings,
    });
    const resolution = resolveConferenceChampion({ conference, standings, games });
    if (resolution) championResolutions.push(resolution);
  }
  const champions: Team[] = championResolutions.map(resolution => resolution.team);
  champions.sort((left, right) => left.ranking - right.ranking);
  championResolutions.sort((left, right) => left.team.ranking - right.team.ranking);

  const selection = buildPlayoffSelection(league, champions);
  const projectedTeams = selection.order.slice(0, format);
  const playoffTeams = hasPersistedField ? persistedTeams : projectedTeams;

  return {
    league,
    games,
    format,
    isProjection,
    champions,
    championResolutions,
    selection,
    playoffTeams,
    navigation: buildLeagueNavigationEnvelope(league),
  };
};
