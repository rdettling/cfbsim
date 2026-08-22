import type { HistoricalGame, HistoryRow } from '../../../types/baseData';
import type { GameRecord } from '../../../types/db';
import type { Team } from '../../../types/domain';
import { SeasonMemoryDataIntegrityError } from '../../../types/memory';
import type {
  TeamScheduleGameRow,
  TeamScheduleHeaderMetrics,
  TeamScheduleRow,
} from '../../../types/scheduleTypes';

export const formatSelectedYearRecord = (
  games: GameRecord[],
  teamId: number,
) => {
  let wins = 0;
  let losses = 0;
  for (const game of games) {
    if (game.winnerId === null) continue;
    if (game.winnerId === teamId) wins += 1;
    else losses += 1;
  }
  return `${wins}-${losses}`;
};

export const buildTeamScheduleCalendar = (
  year: number,
  totalWeeks: number,
  games: TeamScheduleGameRow[],
): TeamScheduleRow[] => {
  const gamesByWeek = new Map<number, TeamScheduleGameRow[]>();
  for (const game of games) {
    const weekGames = gamesByWeek.get(game.weekPlayed) ?? [];
    weekGames.push(game);
    gamesByWeek.set(game.weekPlayed, weekGames);
  }

  const schedule: TeamScheduleRow[] = [];
  for (let week = 1; week <= totalWeeks; week += 1) {
    const weekGames = gamesByWeek.get(week);
    if (weekGames?.length) schedule.push(...weekGames);
    else {
      schedule.push({
        kind: 'bye',
        source: 'bye',
        rowKey: `bye:${year}:${week}`,
        weekPlayed: week,
      });
    }
  }
  return schedule;
};

const getLocation = (
  neutralSite: boolean,
  isHome: boolean,
): TeamScheduleGameRow['location'] =>
  neutralSite ? 'Neutral' : isHome ? 'Home' : 'Away';

export const buildHistoricalScheduleRow = (
  game: HistoricalGame,
  teamName: string,
  supportedTeamNames: Set<string>,
): TeamScheduleGameRow => {
  const isHome = game.homeTeam === teamName;
  const opponentName = isHome ? game.awayTeam : game.homeTeam;
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;

  return {
    kind: 'game',
    source: 'historical',
    rowKey: `historical:${game.sourceId}`,
    weekPlayed: game.weekPlayed,
    opponent: {
      name: opponentName,
      rating: null,
      ranking: isHome ? game.awayRank : game.homeRank,
      record: null,
      canOpen: supportedTeamNames.has(opponentName),
    },
    result: teamScore > opponentScore ? 'W' : 'L',
    score: `${teamScore}-${opponentScore}`,
    spread: null,
    moneyline: null,
    gameId: null,
    location: getLocation(game.neutralSite, isHome),
    venue: game.venue,
    label: game.label,
  };
};

export const buildSimulatedScheduleRow = ({
  game,
  team,
  teams,
  snapshots,
}: {
  game: GameRecord;
  team: Team;
  teams: Team[];
  snapshots: Map<number, {
    rating: number;
    ranking: number;
    record: string;
  }>;
}): TeamScheduleGameRow => {
  const isTeamA = game.teamAId === team.id;
  const opponentId = isTeamA ? game.teamBId : game.teamAId;
  const opponent = teams.find(entry => entry.id === opponentId);
  if (!opponent) {
    throw new SeasonMemoryDataIntegrityError(
      `Game ${game.id} references missing opponent ${opponentId}.`,
    );
  }
  const opponentSnapshot = snapshots.get(opponentId);
  if (!opponentSnapshot) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${game.year} is missing the team snapshot for ${opponent.name}.`,
    );
  }

  const isComplete = game.winnerId !== null;
  const teamScore = isTeamA ? game.scoreA : game.scoreB;
  const opponentScore = isTeamA ? game.scoreB : game.scoreA;

  return {
    kind: 'game',
    source: 'simulated',
    rowKey: `simulated:${game.id}`,
    weekPlayed: game.weekPlayed,
    opponent: {
      name: opponent.name,
      rating: opponentSnapshot.rating,
      ranking: opponentSnapshot.ranking,
      record: opponentSnapshot.record,
      canOpen: true,
    },
    result: isComplete ? (game.winnerId === team.id ? 'W' : 'L') : null,
    score: isComplete && teamScore !== null && opponentScore !== null
      ? `${teamScore}-${opponentScore}`
      : null,
    spread: isTeamA ? game.spreadA : game.spreadB,
    moneyline: isTeamA ? game.moneylineA : game.moneylineB,
    gameId: String(game.id),
    location: getLocation(game.neutralSite, game.homeTeamId === team.id),
    venue: game.venue,
    label: game.name ?? game.baseLabel ?? '',
  };
};

export const getHistoricalScheduleMetrics = (
  [, conferenceId, ranking, wins, losses, prestige]: HistoryRow,
  conferenceNames: Map<number, string>,
): TeamScheduleHeaderMetrics => ({
  record: `${wins}-${losses}`,
  rating: null,
  prestige,
  ranking,
  conference: conferenceNames.get(conferenceId) ?? 'Independent',
});
