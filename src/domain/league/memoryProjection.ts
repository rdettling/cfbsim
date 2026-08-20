import type { HistoryRow } from '../../types/baseData';
import type { GameRecord } from '../../types/db';
import type { RivalryDefinition, Team } from '../../types/domain';
import type { SeasonMemory } from '../../types/memory';
import { rivalryKey } from '../rivalryScheduling';
import {
  getArchivedPostseasonGameType,
  type ArchivedPostseasonGameType,
} from './postseasonArchive';

export interface MemoryAccomplishment {
  type:
    | 'national_champion'
    | 'national_runner_up'
    | 'playoff'
    | 'conference_champion'
    | 'bowl_win'
    | 'award_winner';
  label: string;
}

export interface SignatureGame {
  id: number;
  year: number;
  opponent: string;
  result: 'W' | 'L';
  score: string;
  label: string;
}

export interface DynastyOverview {
  wins: number;
  losses: number;
  bestFinalRank: number | null;
  conferenceTitles: number;
  playoffAppearances: number;
  bowlWins: number;
  nationalTitles: number;
  awardWinners: number;
}

const POSTSEASON_PRIORITY: Record<ArchivedPostseasonGameType, number> = {
  national_championship: 6,
  playoff_semifinal: 5,
  playoff_quarterfinal: 4,
  playoff_first_round: 3,
  conference_championship: 2,
  bowl: 1,
};

const includesTeam = (game: GameRecord, teamId: number) =>
  game.teamAId === teamId || game.teamBId === teamId;

const opponentId = (game: GameRecord, teamId: number) =>
  game.teamAId === teamId ? game.teamBId : game.teamAId;

const teamScore = (game: GameRecord, teamId: number) =>
  game.teamAId === teamId ? game.scoreA ?? 0 : game.scoreB ?? 0;

const opponentScore = (game: GameRecord, teamId: number) =>
  game.teamAId === teamId ? game.scoreB ?? 0 : game.scoreA ?? 0;

const teamWinProbability = (game: GameRecord, teamId: number) =>
  game.teamAId === teamId ? game.winProbA : game.winProbB;

const opponentRank = (game: GameRecord, teamId: number) =>
  game.teamAId === teamId ? game.rankBTOG : game.rankATOG;

const toSignatureGame = (
  game: GameRecord,
  teamId: number,
  teamsById: Map<number, Team>,
): SignatureGame => {
  const opponent = teamsById.get(opponentId(game, teamId));
  const result = game.winnerId === teamId ? 'W' : 'L';
  return {
    id: game.id,
    year: game.year,
    opponent: opponent?.name ?? 'Unknown',
    result,
    score: `${teamScore(game, teamId)}-${opponentScore(game, teamId)}`,
    label: `${result} ${teamScore(game, teamId)}-${opponentScore(game, teamId)} vs ${opponent?.name ?? 'Unknown'}`,
  };
};

const eventPriority = (
  memory: SeasonMemory | undefined,
  gameId: number,
) => {
  const type = getArchivedPostseasonGameType(memory, gameId);
  return type ? POSTSEASON_PRIORITY[type] : 0;
};

const rivalryPairs = (
  rivalries: { rivalries: RivalryDefinition[] },
) =>
  new Set(
    rivalries.rivalries.map(({ teamA, teamB }) => rivalryKey(teamA, teamB)),
  );

export const buildTeamAccomplishments = (
  teamId: number,
  memory: SeasonMemory,
  gamesById: Map<number, GameRecord>,
): MemoryAccomplishment[] => {
  const results: MemoryAccomplishment[] = [];
  const championship = gamesById.get(
    memory.postseason.playoff.games.championship,
  );
  if (championship && includesTeam(championship, teamId)) {
    results.push(
      championship.winnerId === teamId
        ? { type: 'national_champion', label: 'National Champion' }
        : { type: 'national_runner_up', label: 'National Runner-up' },
    );
  }
  if (memory.postseason.playoff.seeds.includes(teamId)) {
    results.push({ type: 'playoff', label: 'Playoff' });
  }
  for (const champion of memory.postseason.conferenceChampions) {
    if (champion.teamId !== teamId) continue;
    results.push({
      type: 'conference_champion',
      label: `${champion.conferenceName} Champion`,
    });
  }
  for (const bowl of memory.postseason.bowls) {
    const game = gamesById.get(bowl.gameId);
    if (game?.winnerId === teamId) {
      results.push({ type: 'bowl_win', label: `${bowl.name} Winner` });
    }
  }
  const awards = memory.awards.filter(award => award.teamId === teamId);
  if (awards.length) {
    results.push({
      type: 'award_winner',
      label: awards.length === 1 ? '1 Award Winner' : `${awards.length} Award Winners`,
    });
  }
  return results;
};

export const selectSignatureGames = ({
  teamId,
  memory,
  games,
  teams,
  rivalries,
}: {
  teamId: number;
  memory: SeasonMemory;
  games: GameRecord[];
  teams: Team[];
  rivalries: { rivalries: RivalryDefinition[] };
}): SignatureGame[] => {
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const team = teamsById.get(teamId);
  if (!team) return [];
  const pairs = rivalryPairs(rivalries);
  const completed = games.filter(
    game => game.winnerId !== null && includesTeam(game, teamId),
  );
  const selected: GameRecord[] = [];
  const add = (game?: GameRecord) => {
    if (game && !selected.some(entry => entry.id === game.id)) selected.push(game);
  };

  add(
    completed
      .filter(game => eventPriority(memory, game.id) > 0)
      .sort(
        (left, right) =>
          eventPriority(memory, right.id) - eventPriority(memory, left.id) ||
          right.id - left.id,
      )[0],
  );

  add(
    completed
      .filter(game => game.winnerId === teamId)
      .sort(
        (left, right) =>
          teamWinProbability(left, teamId) -
            teamWinProbability(right, teamId) ||
          (opponentRank(left, teamId) || Number.MAX_SAFE_INTEGER) -
            (opponentRank(right, teamId) || Number.MAX_SAFE_INTEGER) ||
          left.id - right.id,
      )[0],
  );

  add(
    completed
      .filter(game => game.winnerId !== teamId)
      .sort((left, right) => {
        const eventDifference =
          eventPriority(memory, right.id) - eventPriority(memory, left.id);
        if (eventDifference) return eventDifference;
        const leftOpponent = teamsById.get(opponentId(left, teamId));
        const rightOpponent = teamsById.get(opponentId(right, teamId));
        const leftRivalry = leftOpponent
          ? Number(
              pairs.has(
                rivalryKey(team.name, leftOpponent.name),
              ),
            )
          : 0;
        const rightRivalry = rightOpponent
          ? Number(
              pairs.has(
                rivalryKey(team.name, rightOpponent.name),
              ),
            )
          : 0;
        return (
          rightRivalry - leftRivalry ||
          right.overtime - left.overtime ||
          Math.abs(teamScore(left, teamId) - opponentScore(left, teamId)) -
            Math.abs(teamScore(right, teamId) - opponentScore(right, teamId)) ||
          left.id - right.id
        );
      })[0],
  );

  const fillers = completed
    .filter(game => !selected.some(entry => entry.id === game.id))
    .sort(
      (left, right) =>
        eventPriority(memory, right.id) - eventPriority(memory, left.id) ||
        right.overtime - left.overtime ||
        Number(opponentRank(right, teamId) > 0) -
          Number(opponentRank(left, teamId) > 0) ||
        right.watchability - left.watchability ||
        left.id - right.id,
    );
  for (const game of fillers) {
    if (selected.length >= 3) break;
    add(game);
  }
  return selected.slice(0, 3).map(game =>
    toSignatureGame(game, teamId, teamsById),
  );
};

export const buildDynastyOverview = ({
  teamId,
  historyRows,
  memories,
  games,
}: {
  teamId: number;
  historyRows: HistoryRow[];
  memories: SeasonMemory[];
  games: GameRecord[];
}): DynastyOverview => {
  const gamesById = new Map(games.map(game => [game.id, game]));
  let conferenceTitles = 0;
  let playoffAppearances = 0;
  let bowlWins = 0;
  let nationalTitles = 0;
  for (const memory of memories) {
    const achievements = buildTeamAccomplishments(teamId, memory, gamesById);
    conferenceTitles += Number(
      achievements.some(entry => entry.type === 'conference_champion'),
    );
    playoffAppearances += Number(
      achievements.some(entry => entry.type === 'playoff'),
    );
    bowlWins += Number(
      achievements.some(entry => entry.type === 'bowl_win'),
    );
    nationalTitles += Number(
      achievements.some(entry => entry.type === 'national_champion'),
    );
  }
  const ranked = historyRows.map(row => row[2]).filter(rank => rank > 0);
  return {
    wins: historyRows.reduce((sum, row) => sum + row[3], 0),
    losses: historyRows.reduce((sum, row) => sum + row[4], 0),
    bestFinalRank: ranked.length ? Math.min(...ranked) : null,
    conferenceTitles,
    playoffAppearances,
    bowlWins,
    nationalTitles,
    awardWinners: memories.reduce(
      (sum, memory) =>
        sum + memory.awards.filter(award => award.teamId === teamId).length,
      0,
    ),
  };
};

export const buildSeasonMilestones = ({
  teamId,
  current,
  previous,
  games,
  currentWins,
  currentRank,
  previousRows,
}: {
  teamId: number;
  current: SeasonMemory;
  previous: SeasonMemory[];
  games: GameRecord[];
  currentWins: number;
  currentRank: number;
  previousRows: HistoryRow[];
}) => {
  const gamesById = new Map(games.map(game => [game.id, game]));
  const currentAchievements = buildTeamAccomplishments(
    teamId,
    current,
    gamesById,
  );
  const priorAchievements = previous.flatMap(memory =>
    buildTeamAccomplishments(teamId, memory, gamesById),
  );
  const milestones: string[] = [];
  if (
    currentAchievements.some(entry => entry.type === 'national_champion') &&
    !priorAchievements.some(entry => entry.type === 'national_champion')
  ) {
    milestones.push('First national championship of the dynasty era.');
  }
  if (
    currentAchievements.some(entry => entry.type === 'conference_champion') &&
    !priorAchievements.some(entry => entry.type === 'conference_champion')
  ) {
    milestones.push('First conference championship of the dynasty era.');
  }
  if (
    currentAchievements.some(entry => entry.type === 'playoff') &&
    !priorAchievements.some(entry => entry.type === 'playoff')
  ) {
    milestones.push('First playoff appearance of the dynasty era.');
  }
  const previousRanks = previousRows.map(row => row[2]).filter(rank => rank > 0);
  if (
    currentRank > 0 &&
    previousRanks.length > 0 &&
    currentRank < Math.min(...previousRanks)
  ) {
    milestones.push(`New dynasty-best final ranking: #${currentRank}.`);
  }
  const previousBestWins = Math.max(0, ...previousRows.map(row => row[3]));
  if (previousRows.length && currentWins > previousBestWins) {
    milestones.push(`New dynasty record with ${currentWins} wins.`);
  }
  return milestones.slice(0, 3);
};
