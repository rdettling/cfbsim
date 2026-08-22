import { getHistoryData } from '../../../db/baseData';
import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../db/seasonMemoryRepo';
import { getAllGames } from '../../../db/simRepo';
import type { HistoryRow } from '../../../types/baseData';
import type { GameRecord } from '../../../types/db';
import type { Team } from '../../../types/domain';
import {
  SeasonMemoryDataIntegrityError,
  type SeasonMemory,
} from '../../../types/memory';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

export interface LeagueRecordBestSeason {
  year: number;
  wins: number;
  losses: number;
  finalRank: number | null;
}

export interface LeagueRecordProgram {
  name: string;
  active: boolean;
  conference: string;
  seasons: number;
  wins: number;
  losses: number;
  winPercentage: number | null;
  bestSeason: LeagueRecordBestSeason | null;
  bestFinalRank: number | null;
  nationalTitles: number;
  conferenceTitles: number;
  playoffAppearances: number;
  bowlWins: number;
  awardWinners: number;
}

const finalRank = (rank: number) => rank > 0 ? rank : null;

const seasonWinPercentage = ([, , , wins, losses]: HistoryRow) => {
  const games = wins + losses;
  return games === 0 ? 0 : wins / games;
};

const isBetterSeason = (candidate: HistoryRow, current: HistoryRow) => {
  const percentageDifference = seasonWinPercentage(candidate) - seasonWinPercentage(current);
  if (percentageDifference !== 0) return percentageDifference > 0;
  const [candidateYear, , candidateFinalRank, candidateWins, candidateLosses] = candidate;
  const [currentYear, , currentFinalRank, currentWins, currentLosses] = current;
  if (candidateWins !== currentWins) return candidateWins > currentWins;
  if (candidateLosses !== currentLosses) return candidateLosses < currentLosses;
  const candidateRank = finalRank(candidateFinalRank) ?? Number.POSITIVE_INFINITY;
  const currentRank = finalRank(currentFinalRank) ?? Number.POSITIVE_INFINITY;
  if (candidateRank !== currentRank) return candidateRank < currentRank;
  return candidateYear > currentYear;
};

const toBestSeason = (row: HistoryRow | null): LeagueRecordBestSeason | null => {
  if (!row) return null;
  const [year, , rank, wins, losses] = row;
  return { year, wins, losses, finalRank: finalRank(rank) };
};

const requireTeam = (
  teamsById: Map<number, Team>,
  teamId: number,
  memory: SeasonMemory,
) => {
  const team = teamsById.get(teamId);
  if (!team) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${memory.year} references missing team ${teamId}.`,
    );
  }
  return team;
};

const requireCompletedGame = (
  gamesById: Map<number, GameRecord>,
  gameId: number,
  memory: SeasonMemory,
) => {
  const game = gamesById.get(gameId);
  if (!game || game.year !== memory.year || game.winnerId === null) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${memory.year} references missing or incomplete game ${gameId}.`,
    );
  }
  return game;
};

type Honors = Pick<
  LeagueRecordProgram,
  | 'nationalTitles'
  | 'conferenceTitles'
  | 'playoffAppearances'
  | 'bowlWins'
  | 'awardWinners'
>;

const emptyHonors = (): Honors => ({
  nationalTitles: 0,
  conferenceTitles: 0,
  playoffAppearances: 0,
  bowlWins: 0,
  awardWinners: 0,
});

const addDynastyHonors = (
  memories: SeasonMemory[],
  gamesById: Map<number, GameRecord>,
  teamsById: Map<number, Team>,
) => {
  const honorsByTeamId = new Map<number, Honors>();
  const honors = (teamId: number, memory: SeasonMemory) => {
    requireTeam(teamsById, teamId, memory);
    const existing = honorsByTeamId.get(teamId) ?? emptyHonors();
    honorsByTeamId.set(teamId, existing);
    return existing;
  };

  for (const memory of memories) {
    const playoff = memory.postseason.playoff;
    for (const teamId of playoff.seeds) {
      honors(teamId, memory).playoffAppearances += 1;
    }
    for (const champion of memory.postseason.conferenceChampions) {
      honors(champion.teamId, memory).conferenceTitles += 1;
    }
    for (const award of memory.awards) {
      honors(award.teamId, memory).awardWinners += 1;
    }

    const championship = requireCompletedGame(
      gamesById,
      playoff.games.championship,
      memory,
    );
    honors(championship.winnerId!, memory).nationalTitles += 1;

    for (const bowl of memory.postseason.bowls) {
      const game = requireCompletedGame(gamesById, bowl.gameId, memory);
      honors(game.winnerId!, memory).bowlWins += 1;
    }
  }
  return honorsByTeamId;
};

export const loadLeagueRecords = async () => {
  const [{ league }, history, memories, games] = await Promise.all([
    loadLeaguePlayersSnapshot(),
    getHistoryData(),
    getAllSeasonMemories(),
    getAllGames(),
  ]);
  const envelope = buildLeagueNavigationEnvelope(league);
  const teamsByName = new Map(league.teams.map(team => [team.name, team]));
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const gamesById = new Map(games.map(game => [game.id, game]));
  const archivedYears = new Set(memories.map(memory => memory.year));
  const honorsByTeamId = addDynastyHonors(memories, gamesById, teamsById);
  const conferenceById = new Map(
    Object.entries(history.conf_index).map(([name, id]) => [id, name]),
  );
  const programNames = new Set([
    ...Object.keys(history.teams),
    ...league.teams.map(team => team.name),
  ]);
  const includedYears = new Set<number>();

  const programs = [...programNames].map(name => {
    const team = teamsByName.get(name);
    const rows = (history.teams[name] ?? [])
      .filter(([year]) => year < league.info.startYear || archivedYears.has(year))
      .sort(([leftYear], [rightYear]) => leftYear - rightYear);
    rows.forEach(([year]) => includedYears.add(year));
    const wins = rows.reduce((total, [, , , rowWins]) => total + rowWins, 0);
    const losses = rows.reduce(
      (total, [, , , , rowLosses]) => total + rowLosses,
      0,
    );
    const gamesPlayed = wins + losses;
    const bestRow = rows.reduce<HistoryRow | null>(
      (best, row) => !best || isBetterSeason(row, best) ? row : best,
      null,
    );
    const rankedRows = rows.map(([, , rank]) => rank).filter(rank => rank > 0);
    const lastRow = rows[rows.length - 1];
    const [, lastConferenceId] = lastRow ?? [];
    const honors = team ? honorsByTeamId.get(team.id) ?? emptyHonors() : emptyHonors();

    return {
      name,
      active: Boolean(team),
      conference:
        team?.conference ??
        (lastConferenceId === undefined
          ? undefined
          : conferenceById.get(lastConferenceId)) ??
        'Independent',
      seasons: rows.length,
      wins,
      losses,
      winPercentage: gamesPlayed === 0 ? null : wins / gamesPlayed,
      bestSeason: toBestSeason(bestRow),
      bestFinalRank: rankedRows.length ? Math.min(...rankedRows) : null,
      ...honors,
    } satisfies LeagueRecordProgram;
  });

  const completedYears = [...includedYears].sort((left, right) => left - right);
  const dynastyYears = memories.map(memory => memory.year).sort((left, right) => left - right);
  return {
    ...envelope,
    coverage: {
      firstCompletedYear: completedYears[0] ?? null,
      lastCompletedYear: completedYears[completedYears.length - 1] ?? null,
      firstDynastyYear: dynastyYears[0] ?? null,
      lastDynastyYear: dynastyYears[dynastyYears.length - 1] ?? null,
    },
    hasCompletedSeasons: programs.some(program => program.seasons > 0),
    programs,
  };
};
