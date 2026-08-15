import { getGameById } from '../../../../db/simRepo';
import type { Team } from '../../../../types/domain';
import type { LeagueState } from '../../../../types/league';
import type { PlayoffTeamEntry } from '../../../../types/postseason';
import { loadLeagueOrThrow } from '../../leagueStore';
import { buildPlayoffSelection } from '../../utils/playoffSelection';
import { sortStandingsTeams } from '../../utils/standings';
import { buildLeagueNavigationEnvelope } from '../navigationEnvelope';

export const formatPostseasonRecord = (team: Team) =>
  `${team.totalWins}-${team.totalLosses} (${team.confWins}-${team.confLosses})`;

const getConferenceChampion = async (
  league: LeagueState,
  conferenceName: string,
) => {
  const conference = league.conferences.find(entry => entry.confName === conferenceName);
  if (!conference || conference.confName === 'Independent') return null;

  if (conference.championship) {
    const game = await getGameById(conference.championship);
    if (game?.winnerId) {
      return league.teams.find(team => team.id === game.winnerId) ?? null;
    }
  }

  const conferenceTeams = league.teams.filter(team => team.conference === conferenceName);
  return sortStandingsTeams(conferenceTeams)[0] ?? null;
};

export const loadPostseasonContext = async (loadedLeague?: LeagueState) => {
  const league = loadedLeague ?? await loadLeagueOrThrow();
  const format = league.settings.playoffTeams;
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const persistedTeams = league.playoff.seeds
    .map(id => teamsById.get(id))
    .filter((team): team is Team => Boolean(team));
  const hasPersistedField =
    league.playoff.seeds.length === format && persistedTeams.length === format;
  const isProjection = !hasPersistedField;

  const conferenceNames = league.conferences
    .map(conference => conference.confName)
    .filter(conferenceName => conferenceName !== 'Independent');
  const champions: Team[] = [];
  for (const conferenceName of conferenceNames) {
    const champion = await getConferenceChampion(league, conferenceName);
    if (champion) champions.push(champion);
  }
  champions.sort((left, right) => left.ranking - right.ranking);

  const selection = buildPlayoffSelection(league, champions);
  const projectedTeams = selection.order.slice(0, format);
  const playoffTeams = hasPersistedField ? persistedTeams : projectedTeams;
  const playoff_teams: PlayoffTeamEntry[] = playoffTeams.map((team, index) => ({
    name: team.name,
    seed: index + 1,
    ranking: team.ranking,
    conference: team.conference ?? 'Independent',
    record: formatPostseasonRecord(team),
    is_autobid: selection.autobidIds.has(team.id),
  }));

  return {
    league,
    format,
    isProjection,
    champions,
    selection,
    playoffTeams,
    playoff_teams,
    page: {
      ...buildLeagueNavigationEnvelope(league),
      playoff: {
        teams: format,
        autobids: league.settings.playoffAutobids,
        conf_champ_top_4: league.settings.conferenceChampionsReceiveTopSeeds,
      },
      is_projection: isProjection,
    },
  };
};
