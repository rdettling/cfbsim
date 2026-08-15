import type { LeagueState } from '../../types/league';
import type { PlayerRecord, GameLogRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type {
  AwardDisplayPlacement,
  AwardsResult,
} from '../../types/awards';
import type {
  DefenseStats,
  KickingStats,
  PassingStats,
  ReceivingStats,
  RushingStats,
} from '../../types/stats';
import {
  AWARD_DEFINITIONS,
  type AwardSlug,
} from './awardDefinitions';
import { formatAwardStatLine } from './utils/awardStatLine';
import { createAwardDisplayEntry } from './utils/awardDisplay';
import {
  aggregatePlayerLogs,
  buildDefenseStats,
  buildKickingStats,
  buildPassingStats,
  buildReceivingStats,
  buildRushingStats,
} from './utils/stats/playerAggregates';

type AwardCandidate = {
  player: PlayerRecord;
  score: number;
};

type AwardStatCache = {
  passing: Map<number, PassingStats>;
  rushing: Map<number, RushingStats>;
  receiving: Map<number, ReceivingStats>;
  defensive: Map<number, DefenseStats>;
  kicking: Map<number, KickingStats>;
  statLines: Map<number, string>;
};

const FINAL_WINNER_PRIORITY = [
  'heisman',
  'bednarik',
  'davey_obrien',
  'doak_walker',
  'biletnikoff',
  'ted_hendricks',
  'butkus',
  'thorpe',
  'lou_groza',
] as const satisfies readonly AwardSlug[];

const DEFENSIVE_POSITIONS = new Set(['dl', 'lb', 'cb', 's', 'de']);

const buildStatCache = (
  players: PlayerRecord[],
  logs: GameLogRecord[],
  teamsById: Map<number, Team>
): AwardStatCache => {
  const passing = new Map<number, PassingStats>();
  const rushing = new Map<number, RushingStats>();
  const receiving = new Map<number, ReceivingStats>();
  const defensive = new Map<number, DefenseStats>();
  const kicking = new Map<number, KickingStats>();
  const statLines = new Map<number, string>();
  const totalsByPlayer = aggregatePlayerLogs(logs);

  players.forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    const totals = totalsByPlayer.get(player.id);
    if (!totals) return;

    const gamesPlayed = Math.max(1, team.gamesPlayed);
    passing.set(player.id, buildPassingStats(totals, gamesPlayed));
    rushing.set(player.id, buildRushingStats(totals, gamesPlayed));
    receiving.set(player.id, buildReceivingStats(totals, gamesPlayed));
    defensive.set(player.id, buildDefenseStats(totals));
    kicking.set(player.id, buildKickingStats(totals));
    statLines.set(player.id, formatAwardStatLine(totals));
  });

  return { passing, rushing, receiving, defensive, kicking, statLines };
};

const calcHeisman = (
  league: LeagueState,
  players: PlayerRecord[],
  statCache: ReturnType<typeof buildStatCache>,
  teamsById: Map<number, Team>
) => {
  const totalTeams = league.teams.length;
  const candidates: AwardCandidate[] = [];

  players.filter(player => player.starter).forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    let score = player.rating || 0;

    const passStats = statCache.passing.get(player.id);
    const rushStats = statCache.rushing.get(player.id);
    const recvStats = statCache.receiving.get(player.id);

    if (passStats) {
      score += (passStats.passer_rating || 0) * 2;
    }
    if (rushStats) {
      score += (rushStats.yards_per_game || 0) * 1.5;
    }
    if (recvStats) {
      score += (recvStats.yards_per_game || 0) * 1.2;
    }

    if (team.ranking && team.ranking > 0) {
      const rankBonus = Math.max(0, (totalTeams + 1 - team.ranking)) * 0.5;
      score += rankBonus;
    }

    candidates.push({ player, score });
  });

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcDaveyObrien = (
  players: PlayerRecord[],
  statCache: AwardStatCache,
) => {
  const candidates: AwardCandidate[] = [];
  players.forEach(player => {
    if (player.pos !== 'qb' || !player.starter) return;
    const stats = statCache.passing.get(player.id);
    if (!stats) return;
    const score = (player.rating || 0) + (stats.passer_rating || 0) * 2.5;
    candidates.push({ player, score });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcDoakWalker = (
  players: PlayerRecord[],
  statCache: AwardStatCache,
) => {
  const candidates: AwardCandidate[] = [];
  players.forEach(player => {
    if (player.pos !== 'rb' || !player.starter) return;
    const stats = statCache.rushing.get(player.id);
    if (!stats) return;
    const score = (player.rating || 0) + (stats.yards_per_game || 0) * 1.8;
    candidates.push({ player, score });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcBiletnikoff = (
  players: PlayerRecord[],
  statCache: AwardStatCache,
) => {
  const candidates: AwardCandidate[] = [];
  players.forEach(player => {
    if (player.pos !== 'wr' || !player.starter) return;
    const stats = statCache.receiving.get(player.id);
    if (!stats) return;
    const score = (player.rating || 0) + (stats.yards_per_game || 0) * 2;
    candidates.push({ player, score });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcDefensivePlayer = (
  players: PlayerRecord[],
  statCache: AwardStatCache,
) => {
  const candidates: AwardCandidate[] = [];
  players.forEach(player => {
    if (!player.starter) return;
    if (!DEFENSIVE_POSITIONS.has(player.pos)) return;
    const stats = statCache.defensive.get(player.id);
    if (!stats) return;
    const score = (player.rating || 0) + stats.tackles * 1.5 + stats.sacks * 4 + stats.interceptions * 3;
    candidates.push({ player, score });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcSpecificDefender = (
  players: PlayerRecord[],
  statCache: AwardStatCache,
  allowedPositions: Set<string>,
  weights: Partial<Record<'tackles' | 'sacks' | 'interceptions', number>>,
) => {
  const candidates: AwardCandidate[] = [];
  players.forEach(player => {
    if (!player.starter) return;
    if (!allowedPositions.has(player.pos)) return;
    const stats = statCache.defensive.get(player.id);
    if (!stats) return;
    let score = player.rating || 0;
    Object.entries(weights).forEach(([key, weight]) => {
      const value = stats[key as keyof typeof weights] ?? 0;
      score += value * weight;
    });
    candidates.push({ player, score });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcKicking = (
  players: PlayerRecord[],
  statCache: AwardStatCache,
) => {
  const candidates: AwardCandidate[] = [];
  players.forEach(player => {
    if (player.pos !== 'k' || !player.starter) return;
    const stats = statCache.kicking.get(player.id);
    if (!stats) return;
    const accuracy = stats.field_goals_attempted > 0
      ? (stats.field_goals_made / stats.field_goals_attempted) * 100
      : 0;
    const score = (player.rating || 0) + stats.field_goals_made * 2 + accuracy * 0.1;
    candidates.push({ player, score });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

export const buildAwards = (
  league: LeagueState,
  players: PlayerRecord[],
  logs: GameLogRecord[]
): AwardsResult => {
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const statCache = buildStatCache(players, logs, teamsById);

  const candidatesBySlug: Record<AwardSlug, AwardCandidate[]> = {
    heisman: calcHeisman(league, players, statCache, teamsById),
    davey_obrien: calcDaveyObrien(players, statCache),
    doak_walker: calcDoakWalker(players, statCache),
    biletnikoff: calcBiletnikoff(players, statCache),
    bednarik: calcDefensivePlayer(players, statCache),
    ted_hendricks: calcSpecificDefender(
      players,
      statCache,
      new Set(['dl', 'de']),
      { sacks: 5, tackles: 1.2 }
    ),
    butkus: calcSpecificDefender(
      players,
      statCache,
      new Set(['lb']),
      { tackles: 1.3, interceptions: 3 }
    ),
    thorpe: calcSpecificDefender(
      players,
      statCache,
      new Set(['cb', 's']),
      { interceptions: 4, tackles: 1.0 }
    ),
    lou_groza: calcKicking(players, statCache),
  };

  const buildDisplayEntry = (
    slug: AwardSlug,
    candidates: AwardCandidate[],
  ) => {
    const keys = ['first', 'second', 'third'] as const;
    const placements: AwardDisplayPlacement[] = keys.map((key, index) => {
      const candidate = candidates[index];
      if (!candidate) {
        return { key, player: null, score: null, statLine: null };
      }
      return {
        key,
        player: {
          id: candidate.player.id,
          first: candidate.player.first,
          last: candidate.player.last,
          position: candidate.player.pos,
          teamName: teamsById.get(candidate.player.teamId)?.name ?? '',
        },
        score: candidate.score,
        statLine: statCache.statLines.get(candidate.player.id) ?? 'No stats yet',
      };
    });
    return createAwardDisplayEntry(slug, placements);
  };

  const live = AWARD_DEFINITIONS.map(definition =>
    buildDisplayEntry(definition.slug, candidatesBySlug[definition.slug]),
  );

  const blockedPlayers = new Set<number>();
  const final = FINAL_WINNER_PRIORITY.map(slug => {
    const candidates = candidatesBySlug[slug];
    let firstCandidate: (typeof candidates)[number] | undefined = candidates[0];
    if (firstCandidate && blockedPlayers.has(firstCandidate.player.id)) {
      firstCandidate = candidates.find(candidate => !blockedPlayers.has(candidate.player.id));
    }
    if (firstCandidate) {
      blockedPlayers.add(firstCandidate.player.id);
    }
    const ordered: AwardCandidate[] = [];
    if (firstCandidate) {
      ordered.push(firstCandidate);
    }
    ordered.push(...candidates.filter(candidate => candidate !== firstCandidate));
    return buildDisplayEntry(slug, ordered);
  });

  return { live, final };
};
