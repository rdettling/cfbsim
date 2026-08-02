import type { Team } from '../../../types/domain';
import type { LeagueState } from '../../../types/league';

export type PlayoffSelection = {
  order: Team[];
  autobidIds: Set<number>;
};

export const buildPlayoffSelection = (
  league: LeagueState,
  conferenceChampions: Team[],
): PlayoffSelection => {
  const format = league.settings.playoffTeams;
  if (format === 2 || format === 4) {
    return {
      order: league.teams.slice().sort((a, b) => a.ranking - b.ranking),
      autobidIds: new Set<number>(),
    };
  }

  const autobids = conferenceChampions
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .slice(0, league.settings.playoffAutobids);
  const autobidIds = new Set(autobids.map(team => team.id));
  const wildCards = league.teams
    .filter(team => !autobidIds.has(team.id))
    .sort((a, b) => a.ranking - b.ranking);

  const cutoff = 8 - (league.settings.playoffAutobids - 4);
  const nonPlayoffTeams = wildCards.slice(cutoff);
  const wildCardPool = wildCards.slice(0, cutoff);

  let byes: Team[] = [];
  let remainingAutobids: Team[] = [];
  let remainingWildCards: Team[] = [];

  if (league.settings.conferenceChampionsReceiveTopSeeds) {
    byes = autobids.slice(0, 4);
    remainingAutobids = autobids.slice(4);
    remainingWildCards = wildCardPool.slice();
  } else {
    const allCandidates = [...autobids, ...wildCardPool]
      .sort((a, b) => a.ranking - b.ranking);
    byes = allCandidates.slice(0, 4);
    const byeIds = new Set(byes.map(team => team.id));
    remainingAutobids = autobids.filter(team => !byeIds.has(team.id));
    remainingWildCards = wildCardPool.filter(team => !byeIds.has(team.id));
  }

  const seededRest = [...remainingWildCards, ...remainingAutobids]
    .sort((a, b) => a.ranking - b.ranking);
  return {
    order: [...byes, ...seededRest, ...nonPlayoffTeams],
    autobidIds,
  };
};
