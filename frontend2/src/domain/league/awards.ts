import type { LeagueState } from '../../types/league';
import type { PlayerRecord, GameLogRecord } from '../../types/db';
import type { Team } from '../../types/domain';

const AWARD_DEFINITIONS = [
  {
    slug: 'heisman',
    name: 'Heisman Trophy',
    description: 'Recognizes the most outstanding overall player in the regular season.',
  },
  {
    slug: 'davey_obrien',
    name: "Davey O'Brien Award",
    description: 'Awarded to the top-performing quarterback.',
  },
  {
    slug: 'doak_walker',
    name: 'Doak Walker Award',
    description: "Honoring the nation’s best running back.",
  },
  {
    slug: 'biletnikoff',
    name: 'Biletnikoff Award',
    description: 'Honors the top wide receiver.',
  },
  {
    slug: 'bednarik',
    name: 'Bednarik Award',
    description: 'Given to the defensive player of the year.',
  },
  {
    slug: 'ted_hendricks',
    name: 'Ted Hendricks Award',
    description: 'Best defensive end in the nation.',
  },
  {
    slug: 'butkus',
    name: 'Butkus Award',
    description: 'Recognizes the nation’s top linebacker.',
  },
  {
    slug: 'thorpe',
    name: 'Thorpe Award',
    description: 'Awarded to the premier defensive back.',
  },
  {
    slug: 'lou_groza',
    name: 'Lou Groza Award',
    description: 'Honors the top placekicker.',
  },
];

const PRIORITY_ORDER = [
  'heisman',
  'bednarik',
  'davey_obrien',
  'doak_walker',
  'biletnikoff',
  'ted_hendricks',
  'butkus',
  'thorpe',
  'lou_groza',
];

const DEFENSIVE_POSITIONS = new Set(['dl', 'lb', 'cb', 's', 'de']);

const average = (total: number, attempts: number, decimals = 1) => {
  if (!attempts) return 0;
  const factor = 10 ** decimals;
  return Math.round((total / attempts) * factor) / factor;
};

const passerRating = (
  completions: number,
  attempts: number,
  yards: number,
  touchdowns: number,
  interceptions: number
) => {
  if (!attempts) return 0;
  const a = Math.max(0, Math.min(((completions / attempts) - 0.3) * 5, 2.375));
  const b = Math.max(0, Math.min(((yards / attempts) - 3) * 0.25, 2.375));
  const c = Math.max(0, Math.min((touchdowns / attempts) * 20, 2.375));
  const d = Math.max(0, Math.min(2.375 - ((interceptions / attempts) * 25), 2.375));
  const rating = ((a + b + c + d) / 6) * 100;
  return Math.round(rating * 10) / 10;
};

const buildStatLine = (totals: {
  pass: { yards: number; td: number; int: number; att: number; cmp: number };
  rush: { yards: number; td: number; att: number };
  rec: { yards: number; td: number; rec: number };
  def: { tackles: number; sacks: number; interceptions: number };
  kick: { made: number; attempted: number };
}) => {
  const parts: string[] = [];

  if (totals.pass.att > 0) {
    parts.push(
      `${totals.pass.cmp}/${totals.pass.att} for ${totals.pass.yards} yards, ${totals.pass.td} TDs, ${totals.pass.int} INTs`
    );
  }

  if (totals.rush.att > 0) {
    parts.push(
      `${totals.rush.att} carries for ${totals.rush.yards} yards, ${totals.rush.td} TDs`
    );
  }

  if (totals.rec.rec > 0) {
    parts.push(
      `${totals.rec.rec} catches for ${totals.rec.yards} yards, ${totals.rec.td} TDs`
    );
  }

  if (totals.kick.attempted > 0) {
    const accuracy =
      totals.kick.attempted > 0
        ? Math.round((totals.kick.made / totals.kick.attempted) * 1000) / 10
        : 0;
    parts.push(`${totals.kick.made}/${totals.kick.attempted} FG (${accuracy}%)`);
  }

  if (
    parts.length === 0 &&
    (totals.def.tackles || totals.def.sacks || totals.def.interceptions)
  ) {
    const defenderParts: string[] = [];
    if (totals.def.tackles) defenderParts.push(`Tackles: ${totals.def.tackles}`);
    if (totals.def.sacks) defenderParts.push(`Sacks: ${totals.def.sacks}`);
    if (totals.def.interceptions) defenderParts.push(`INTs: ${totals.def.interceptions}`);
    parts.push(defenderParts.join(', '));
  }

  return parts.length ? parts.join(' · ') : 'No stats yet';
};

const summarizeLogs = (logs: GameLogRecord[]) => {
  const totals = {
    pass: { yards: 0, td: 0, int: 0, att: 0, cmp: 0 },
    rush: { yards: 0, td: 0, att: 0 },
    rec: { yards: 0, td: 0, rec: 0 },
    def: { tackles: 0, sacks: 0, interceptions: 0 },
    kick: { made: 0, attempted: 0 },
  };

  logs.forEach(log => {
    totals.pass.yards += log.pass_yards;
    totals.pass.td += log.pass_touchdowns;
    totals.pass.int += log.pass_interceptions;
    totals.pass.att += log.pass_attempts;
    totals.pass.cmp += log.pass_completions;

    totals.rush.yards += log.rush_yards;
    totals.rush.td += log.rush_touchdowns;
    totals.rush.att += log.rush_attempts;

    totals.rec.yards += log.receiving_yards;
    totals.rec.td += log.receiving_touchdowns;
    totals.rec.rec += log.receiving_catches;

    totals.def.tackles += log.tackles;
    totals.def.sacks += log.sacks;
    totals.def.interceptions += log.interceptions;

    totals.kick.made += log.field_goals_made;
    totals.kick.attempted += log.field_goals_attempted;
  });

  return {
    totals,
    stat_line: buildStatLine(totals),
  };
};

const buildStatCache = (
  league: LeagueState,
  players: PlayerRecord[],
  logs: GameLogRecord[],
  teamsById: Map<number, Team>
) => {
  const passing = new Map<number, { passer_rating: number; yards_per_game: number; att: number; cmp: number; yards: number; td: number; int: number }>();
  const rushing = new Map<number, { yards_per_game: number; att: number; yards: number; td: number; fumbles: number }>();
  const receiving = new Map<number, { yards_per_game: number; rec: number; yards: number; td: number }>();
  const defensive = new Map<number, { tackles: number; sacks: number; interceptions: number }>();
  const kicking = new Map<number, { made: number; attempted: number }>();

  const totalsByPlayer = new Map<number, ReturnType<typeof summarizeLogs>['totals']>();

  logs.forEach(log => {
    const totals = totalsByPlayer.get(log.playerId) ?? {
      pass: { yards: 0, td: 0, int: 0, att: 0, cmp: 0 },
      rush: { yards: 0, td: 0, att: 0 },
      rec: { yards: 0, td: 0, rec: 0 },
      def: { tackles: 0, sacks: 0, interceptions: 0 },
      kick: { made: 0, attempted: 0 },
    };
    totals.pass.yards += log.pass_yards;
    totals.pass.td += log.pass_touchdowns;
    totals.pass.int += log.pass_interceptions;
    totals.pass.att += log.pass_attempts;
    totals.pass.cmp += log.pass_completions;

    totals.rush.yards += log.rush_yards;
    totals.rush.td += log.rush_touchdowns;
    totals.rush.att += log.rush_attempts;

    totals.rec.yards += log.receiving_yards;
    totals.rec.td += log.receiving_touchdowns;
    totals.rec.rec += log.receiving_catches;

    totals.def.tackles += log.tackles;
    totals.def.sacks += log.sacks;
    totals.def.interceptions += log.interceptions;

    totals.kick.made += log.field_goals_made;
    totals.kick.attempted += log.field_goals_attempted;
    totalsByPlayer.set(log.playerId, totals);
  });

  players.forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    const totals = totalsByPlayer.get(player.id);
    if (!totals) return;

    const gamesPlayed = Math.max(1, team.gamesPlayed);
    passing.set(player.id, {
      passer_rating: passerRating(
        totals.pass.cmp,
        totals.pass.att,
        totals.pass.yards,
        totals.pass.td,
        totals.pass.int
      ),
      yards_per_game: average(totals.pass.yards, gamesPlayed),
      att: totals.pass.att,
      cmp: totals.pass.cmp,
      yards: totals.pass.yards,
      td: totals.pass.td,
      int: totals.pass.int,
    });
    rushing.set(player.id, {
      yards_per_game: average(totals.rush.yards, gamesPlayed),
      att: totals.rush.att,
      yards: totals.rush.yards,
      td: totals.rush.td,
      fumbles: 0,
    });
    receiving.set(player.id, {
      yards_per_game: average(totals.rec.yards, gamesPlayed),
      rec: totals.rec.rec,
      yards: totals.rec.yards,
      td: totals.rec.td,
    });
    defensive.set(player.id, {
      tackles: totals.def.tackles,
      sacks: totals.def.sacks,
      interceptions: totals.def.interceptions,
    });
    kicking.set(player.id, {
      made: totals.kick.made,
      attempted: totals.kick.attempted,
    });
  });

  return { passing, rushing, receiving, defensive, kicking };
};

const candidatePlayer = (player: PlayerRecord) => ({
  id: player.id,
  first: player.first,
  last: player.last,
  pos: player.pos,
  rating: player.rating,
  stars: player.stars,
  team_name: '',
});

const attachStatLines = (
  candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }>,
  logsByPlayer: Map<number, GameLogRecord[]>
) => {
  candidates.forEach(entry => {
    const logs = logsByPlayer.get(entry.player.id) ?? [];
    const summary = summarizeLogs(logs);
    entry.stats = { ...(entry.stats ?? {}), stat_line: summary.stat_line };
  });
};

const calcHeisman = (
  league: LeagueState,
  players: PlayerRecord[],
  statCache: ReturnType<typeof buildStatCache>,
  teamsById: Map<number, Team>
) => {
  const totalTeams = league.teams.length;
  const candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }> = [];

  players.filter(player => player.active && player.starter).forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    let score = player.rating || 0;
    const statsSummary: Record<string, any> = { team: team.name };

    const passStats = statCache.passing.get(player.id);
    const rushStats = statCache.rushing.get(player.id);
    const recvStats = statCache.receiving.get(player.id);

    if (passStats) {
      score += (passStats.passer_rating || 0) * 2;
      statsSummary.passing = passStats;
    }
    if (rushStats) {
      score += (rushStats.yards_per_game || 0) * 1.5;
      statsSummary.rushing = rushStats;
    }
    if (recvStats) {
      score += (recvStats.yards_per_game || 0) * 1.2;
      statsSummary.receiving = recvStats;
    }

    if (team.ranking && team.ranking > 0) {
      const rankBonus = Math.max(0, (totalTeams + 1 - team.ranking)) * 0.5;
      score += rankBonus;
    }

    candidates.push({ player, score, stats: statsSummary });
  });

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcDaveyObrien = (
  players: PlayerRecord[],
  statCache: ReturnType<typeof buildStatCache>,
  teamsById: Map<number, Team>
) => {
  const candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }> = [];
  players.forEach(player => {
    if (player.pos !== 'qb' || !player.starter) return;
    const stats = statCache.passing.get(player.id);
    if (!stats) return;
    const team = teamsById.get(player.teamId);
    const score = (player.rating || 0) + (stats.passer_rating || 0) * 2.5;
    const statsSummary = {
      passer_rating: stats.passer_rating,
      yards_per_game: stats.yards_per_game,
      team: team?.name ?? null,
    };
    candidates.push({ player, score, stats: statsSummary });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcDoakWalker = (
  players: PlayerRecord[],
  statCache: ReturnType<typeof buildStatCache>,
  teamsById: Map<number, Team>
) => {
  const candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }> = [];
  players.forEach(player => {
    if (player.pos !== 'rb' || !player.starter) return;
    const stats = statCache.rushing.get(player.id);
    if (!stats) return;
    const team = teamsById.get(player.teamId);
    const score = (player.rating || 0) + (stats.yards_per_game || 0) * 1.8;
    const statsSummary = {
      yards_per_game: stats.yards_per_game,
      att: stats.att,
      team: team?.name ?? null,
    };
    candidates.push({ player, score, stats: statsSummary });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcBiletnikoff = (
  players: PlayerRecord[],
  statCache: ReturnType<typeof buildStatCache>,
  teamsById: Map<number, Team>
) => {
  const candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }> = [];
  players.forEach(player => {
    if (player.pos !== 'wr' || !player.starter) return;
    const stats = statCache.receiving.get(player.id);
    if (!stats) return;
    const team = teamsById.get(player.teamId);
    const score = (player.rating || 0) + (stats.yards_per_game || 0) * 2;
    const statsSummary = {
      yards_per_game: stats.yards_per_game,
      rec: stats.rec,
      team: team?.name ?? null,
    };
    candidates.push({ player, score, stats: statsSummary });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcDefensivePlayer = (
  players: PlayerRecord[],
  statCache: ReturnType<typeof buildStatCache>,
  teamsById: Map<number, Team>
) => {
  const candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }> = [];
  players.forEach(player => {
    if (!player.starter) return;
    if (!DEFENSIVE_POSITIONS.has(player.pos)) return;
    const stats = statCache.defensive.get(player.id);
    if (!stats) return;
    const team = teamsById.get(player.teamId);
    const score = (player.rating || 0) + stats.tackles * 1.5 + stats.sacks * 4 + stats.interceptions * 3;
    const statsSummary = {
      tackles: stats.tackles,
      sacks: stats.sacks,
      interceptions: stats.interceptions,
      team: team?.name ?? null,
    };
    candidates.push({ player, score, stats: statsSummary });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcSpecificDefender = (
  players: PlayerRecord[],
  statCache: ReturnType<typeof buildStatCache>,
  teamsById: Map<number, Team>,
  allowedPositions: Set<string>,
  weights: Record<string, number>
) => {
  const candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }> = [];
  players.forEach(player => {
    if (!player.starter) return;
    if (!allowedPositions.has(player.pos)) return;
    const stats = statCache.defensive.get(player.id);
    if (!stats) return;
    const team = teamsById.get(player.teamId);
    let score = player.rating || 0;
    const statsSummary: Record<string, any> = { team: team?.name ?? null };
    Object.entries(weights).forEach(([key, weight]) => {
      const value = (stats as Record<string, number>)[key] ?? 0;
      score += value * weight;
      statsSummary[key] = value;
    });
    candidates.push({ player, score, stats: statsSummary });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

const calcKicking = (
  players: PlayerRecord[],
  statCache: ReturnType<typeof buildStatCache>,
  teamsById: Map<number, Team>
) => {
  const candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }> = [];
  players.forEach(player => {
    if (player.pos !== 'k' || !player.starter) return;
    const stats = statCache.kicking.get(player.id);
    if (!stats) return;
    const team = teamsById.get(player.teamId);
    const accuracy = stats.attempted > 0 ? (stats.made / stats.attempted) * 100 : 0;
    const score = (player.rating || 0) + stats.made * 2 + accuracy * 0.1;
    const statsSummary = {
      made: stats.made,
      attempted: stats.attempted,
      accuracy: Math.round(accuracy * 10) / 10,
      team: team?.name ?? null,
    };
    candidates.push({ player, score, stats: statsSummary });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
};

export const buildAwards = (
  league: LeagueState,
  players: PlayerRecord[],
  logs: GameLogRecord[]
) => {
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const logsByPlayer = new Map<number, GameLogRecord[]>();
  logs.forEach(log => {
    const list = logsByPlayer.get(log.playerId) ?? [];
    list.push(log);
    logsByPlayer.set(log.playerId, list);
  });

  const statCache = buildStatCache(league, players, logs, teamsById);

  const candidatesBySlug: Record<string, Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }>> = {
    heisman: calcHeisman(league, players, statCache, teamsById),
    davey_obrien: calcDaveyObrien(players, statCache, teamsById),
    doak_walker: calcDoakWalker(players, statCache, teamsById),
    biletnikoff: calcBiletnikoff(players, statCache, teamsById),
    bednarik: calcDefensivePlayer(players, statCache, teamsById),
    ted_hendricks: calcSpecificDefender(
      players,
      statCache,
      teamsById,
      new Set(['dl', 'de']),
      { sacks: 5, tackles: 1.2 }
    ),
    butkus: calcSpecificDefender(
      players,
      statCache,
      teamsById,
      new Set(['lb']),
      { tackles: 1.3, interceptions: 3 }
    ),
    thorpe: calcSpecificDefender(
      players,
      statCache,
      teamsById,
      new Set(['cb', 's']),
      { interceptions: 4, tackles: 1.0 }
    ),
    lou_groza: calcKicking(players, statCache, teamsById),
  };

  Object.values(candidatesBySlug).forEach(candidates => attachStatLines(candidates, logsByPlayer));

  const buildAwardEntry = (slug: string, candidates: Array<{ player: PlayerRecord; score: number; stats: Record<string, any> }>, isFinal: boolean) => {
    const def = AWARD_DEFINITIONS.find(defn => defn.slug === slug);
    const entry = {
      category_slug: slug,
      category_name: def?.name ?? slug,
      category_description: def?.description ?? '',
      is_final: isFinal,
      last_updated: new Date().toISOString(),
      first_place: null as any,
      first_score: null as number | null,
      first_stats: null as Record<string, any> | null,
      second_place: null as any,
      second_score: null as number | null,
      second_stats: null as Record<string, any> | null,
      third_place: null as any,
      third_score: null as number | null,
      third_stats: null as Record<string, any> | null,
    };

    const fillCandidate = (target: 'first' | 'second' | 'third', candidate?: { player: PlayerRecord; score: number; stats: Record<string, any> }) => {
      if (!candidate) return;
      const teamName = teamsById.get(candidate.player.teamId)?.name ?? '';
      const player = { ...candidatePlayer(candidate.player), team_name: teamName };
      if (target === 'first') {
        entry.first_place = player;
        entry.first_score = candidate.score;
        entry.first_stats = candidate.stats;
      } else if (target === 'second') {
        entry.second_place = player;
        entry.second_score = candidate.score;
        entry.second_stats = candidate.stats;
      } else {
        entry.third_place = player;
        entry.third_score = candidate.score;
        entry.third_stats = candidate.stats;
      }
    };

    fillCandidate('first', candidates[0]);
    fillCandidate('second', candidates[1]);
    fillCandidate('third', candidates[2]);

    return entry;
  };

  const favorites = AWARD_DEFINITIONS.map(def => buildAwardEntry(def.slug, candidatesBySlug[def.slug] ?? [], false));

  const blockedPlayers = new Set<number>();
  const finals: typeof favorites = [];
  PRIORITY_ORDER.forEach(slug => {
    const candidates = candidatesBySlug[slug] ?? [];
    let firstCandidate = candidates[0];
    if (firstCandidate && blockedPlayers.has(firstCandidate.player.id)) {
      firstCandidate = candidates.find(candidate => !blockedPlayers.has(candidate.player.id));
    }
    if (firstCandidate) {
      blockedPlayers.add(firstCandidate.player.id);
    }
    const ordered = [firstCandidate, ...candidates.filter(candidate => candidate !== firstCandidate)];
    finals.push(buildAwardEntry(slug, ordered, true));
  });

  return { favorites, final: finals };
};
