import {
  getHistoricalGamesIndex,
  getHistoryData,
  getRivalriesData,
} from '../../../../db/baseData';
import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import {
  getGamesByTeam,
  getGamesByYear,
} from '../../../../db/simRepo';
import type { HistoryRow } from '../../../../types/baseData';
import { SeasonMemoryDataIntegrityError } from '../../../../types/memory';
import {
  buildDynastyOverview,
  buildTeamAccomplishments,
  selectSignatureGames,
} from '../../memoryProjection';
import { listTeamNames, resolveTeam } from './shared';

export const loadTeamHistory = async (teamName?: string) => {
  const { league } = await loadLeaguePlayersSnapshot();
  const team = resolveTeam(league, teamName);
  const cutoffYear = league.info.currentYear - 1;

  const [
    historyData,
    teamGames,
    currentYearGames,
    persistedMemories,
    rivalries,
    historicalGamesIndex,
  ] = await Promise.all([
    getHistoryData(),
    getGamesByTeam(team.id),
    league.info.stage === 'summary'
      ? getGamesByYear(league.info.currentYear)
      : Promise.resolve([]),
    getAllSeasonMemories(),
    getRivalriesData(),
    getHistoricalGamesIndex(),
  ]);
  const allGames = Array.from(
    new Map([...teamGames, ...currentYearGames].map(game => [game.id, game])).values(),
  );
  const currentMemory = league.info.stage === 'summary'
    ? persistedMemories.find(memory => memory.year === league.info.currentYear) ?? null
    : null;
  const memories = currentMemory
    ? [
        currentMemory,
        ...persistedMemories.filter(memory => memory.year !== currentMemory.year),
      ]
    : persistedMemories;
  const memoriesByYear = new Map(memories.map(memory => [memory.year, memory]));
  const gamesById = new Map(allGames.map(game => [game.id, game]));
  const gamesByYear = new Map<number, typeof allGames>();
  for (const game of allGames) {
    const yearGames = gamesByYear.get(game.year) ?? [];
    yearGames.push(game);
    gamesByYear.set(game.year, yearGames);
  }

  const confById = new Map(
    Object.entries(historyData.conf_index).map(([name, id]) => [id, name]),
  );
  const years = (historyData.teams[team.name] ?? [])
    .filter(([year]) => year <= cutoffYear)
    .sort(([leftYear], [rightYear]) => rightYear - leftYear)
    .map(([year, conferenceId, rank, wins, losses, prestige]) => {
      const memory = memoriesByYear.get(year);
      const teamSnapshot = memory?.teamSnapshots.find(
        snapshot => snapshot.teamId === team.id,
      );
      const era = year >= league.info.startYear
        ? 'dynasty' as const
        : 'historical' as const;
      if (era === 'dynasty' && !teamSnapshot) {
        throw new SeasonMemoryDataIntegrityError(
          `Season ${year} is missing a ${team.name} team snapshot.`,
        );
      }
      const yearGames = gamesByYear.get(year) ?? [];
      const accomplishments = memory
        ? buildTeamAccomplishments(team.id, memory, gamesById)
        : [];
      return {
        year,
        prestige: teamSnapshot?.prestige ?? prestige,
        rating: teamSnapshot?.rating ?? null,
        conference: confById.get(conferenceId) ?? 'Independent',
        wins,
        losses,
        rank,
        hasSchedule: era === 'historical'
          ? historicalGamesIndex.years.includes(year)
          : yearGames.some(game =>
              game.teamAId === team.id || game.teamBId === team.id
            ),
        era,
        isChampion: accomplishments.some(
          accomplishment => accomplishment.type === 'national_champion',
        ),
        accomplishments,
        signatureGames: memory
          ? selectSignatureGames({
              teamId: team.id,
              memory,
              games: yearGames,
              teams: league.teams,
              rivalries,
            })
          : [],
      };
    });

  const shouldIncludeCurrentYear = league.info.stage === 'summary';
  const hasCurrentYearRow = years.some(entry => entry.year === league.info.currentYear);
  if (shouldIncludeCurrentYear && !hasCurrentYearRow) {
    const memory = memoriesByYear.get(league.info.currentYear);
    if (!memory) {
      throw new SeasonMemoryDataIntegrityError(
        `Season ${league.info.currentYear} is missing its current memory projection.`,
      );
    }
    const teamSnapshot = memory.teamSnapshots.find(
      snapshot => snapshot.teamId === team.id,
    );
    if (!teamSnapshot) {
      throw new SeasonMemoryDataIntegrityError(
        `Season ${league.info.currentYear} is missing a ${team.name} team snapshot.`,
      );
    }
    const accomplishments = buildTeamAccomplishments(team.id, memory, gamesById);
    years.push({
      year: league.info.currentYear,
      prestige: teamSnapshot.prestige,
      rating: teamSnapshot.rating,
      conference: team.conference ?? 'Independent',
      wins: team.totalWins,
      losses: team.totalLosses,
      rank: team.ranking ?? 0,
      hasSchedule: team.totalWins + team.totalLosses > 0,
      era: 'dynasty',
      isChampion: accomplishments.some(
        accomplishment => accomplishment.type === 'national_champion',
      ),
      accomplishments,
      signatureGames: selectSignatureGames({
        teamId: team.id,
        memory,
        games: gamesByYear.get(league.info.currentYear) ?? [],
        teams: league.teams,
        rivalries,
      }),
    });
    years.sort((left, right) => right.year - left.year);
  }

  const dynastyHistoryRows: HistoryRow[] = years
    .filter(entry => entry.era === 'dynasty')
    .map(entry => [
      entry.year,
      historyData.conf_index[entry.conference] ?? 0,
      entry.rank,
      entry.wins,
      entry.losses,
      entry.prestige,
    ] satisfies HistoryRow);

  return {
    info: league.info,
    team,
    conferences: league.conferences,
    years,
    startYear: league.info.startYear,
    dynastyOverview: buildDynastyOverview({
      teamId: team.id,
      historyRows: dynastyHistoryRows,
      memories,
      games: allGames,
    }),
    teams: listTeamNames(league),
  };
};
