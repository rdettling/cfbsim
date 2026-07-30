import type { Team } from '../../../types/domain';
import type { HistoryRow } from '../../../types/baseData';
import type { GameRecord, GameLogRecord, PlayerRecord } from '../../../types/db';
import type {
  PlayerCareerSeason,
  PlayerGameLog,
  PlayerStatCategory,
  PlayerStatValues,
} from '../../../types/player';
import { getHistoryData, getRivalriesData } from '../../../db/baseData';
import {
  getAllGames,
  getAllGameLogs,
  getAllHistoricalPlayers,
  getGameDetailsByYear,
  getGamesByTeam,
  getGamesByYear,
  getPlayerSeasons,
} from '../../../db/simRepo';
import { getAllSeasonMemories } from '../../../db/seasonMemoryRepo';
import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import { loadLeagueOptional, loadLeagueOrThrow } from '../leagueStore';
import { POSITION_ORDER } from '../../rosterConfig';
import { buildAwards, getAwardName } from '../awards';
import { buildScheduleGameForTeam } from '../utils/scheduleView';
import { average, percentage } from '../utils/statMath';
import { buildSeasonMemory } from '../memory';
import {
  buildDynastyOverview,
  buildTeamAccomplishments,
  selectSignatureGames,
} from '../memoryProjection';
import { buildPlayerSeasons } from '../gameDetails';
import { getPlayerOrigin } from '../../../db/playerOriginRepo';


export const loadTeamRoster = async (teamName?: string) => {
  const { league, players } = await loadLeaguePlayersSnapshot();

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

  const roster = players.filter(
    player => player.teamId === team.id
  );

  const positionSet = new Set(roster.map(player => player.pos));
  const orderedPositions = POSITION_ORDER.filter(pos => positionSet.has(pos));
  const extraPositions = Array.from(positionSet).filter(pos => !POSITION_ORDER.includes(pos));
  extraPositions.sort((a, b) => a.localeCompare(b));
  const positions = [...orderedPositions, ...extraPositions];

  return {
    info: league.info,
    team,
    roster,
    positions,
    conferences: league.conferences,
    teams: league.teams.map(entry => entry.name).sort((a, b) => a.localeCompare(b)),
  };
};

export const loadTeamHistory = async (teamName?: string) => {
  const { league, players } = await loadLeaguePlayersSnapshot();

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

  const cutoffYear = league.info.currentYear - 1;
  let historicalRows: Array<{
    year: number;
    prestige: number;
    rating: number | null;
    conference: string;
    wins: number;
    losses: number;
    rank: number;
    has_games: boolean;
    era: 'historical' | 'dynasty';
    isChampion: boolean;
    accomplishments: ReturnType<typeof buildTeamAccomplishments>;
    signatureGames: ReturnType<typeof selectSignatureGames>;
  }> = [];

  const [
    historyData,
    teamGames,
    currentYearGames,
    persistedMemories,
    rivalries,
    gameLogs,
  ] =
    await Promise.all([
      getHistoryData(),
      getGamesByTeam(team.id),
      league.info.stage === 'summary'
        ? getGamesByYear(league.info.currentYear)
        : Promise.resolve([]),
      getAllSeasonMemories(),
      getRivalriesData(),
      getAllGameLogs(),
    ]);
  const allGames = Array.from(
    new Map([...teamGames, ...currentYearGames].map(game => [game.id, game])).values(),
  );
  const currentMemory =
    league.info.stage === 'summary'
      ? buildSeasonMemory(league, allGames, players, gameLogs)
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
  const teamHistory = historyData.teams[team.name] ?? [];
  const confById = new Map(
    Object.entries(historyData.conf_index).map(([name, id]) => [id, name]),
  );
  historicalRows = teamHistory
    .filter(entry => entry[0] <= cutoffYear)
    .sort((a, b) => b[0] - a[0])
    .map(entry => {
      const memory = memoriesByYear.get(entry[0]);
      const yearGames = gamesByYear.get(entry[0]) ?? [];
      const accomplishments = memory
        ? buildTeamAccomplishments(team.id, memory, gamesById)
        : [];
      return {
        year: entry[0],
        prestige: entry[5],
        rating: null,
        conference: confById.get(entry[1]) ?? 'Independent',
        wins: entry[3],
        losses: entry[4],
        rank: entry[2],
        has_games: yearGames.some(game =>
          game.teamAId === team.id || game.teamBId === team.id),
        era: entry[0] >= league.info.startYear
          ? 'dynasty' as const
          : 'historical' as const,
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

  const years = historicalRows.slice();
  const shouldIncludeCurrentYear = league.info.stage === 'summary';
  const hasCurrentYearRow = years.some(entry => entry.year === league.info.currentYear);
  if (shouldIncludeCurrentYear && !hasCurrentYearRow) {
    const memory = memoriesByYear.get(league.info.currentYear)!;
    const accomplishments = buildTeamAccomplishments(
      team.id,
      memory,
      gamesById,
    );
    years.push({
      year: league.info.currentYear,
      prestige: team.prestige,
      rating: team.rating ?? null,
      conference: team.conference ?? 'Independent',
      wins: team.totalWins,
      losses: team.totalLosses,
      rank: team.ranking ?? 0,
      has_games: team.totalWins + team.totalLosses > 0,
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
    years.sort((a, b) => b.year - a.year);
  }

  const dynastyHistoryRows: HistoryRow[] = years
    .filter(entry => entry.era === 'dynasty')
    .map(entry => {
      const conferenceId =
        historyData.conf_index[entry.conference] ?? 0;
      return [
        entry.year,
        conferenceId,
        entry.rank,
        entry.wins,
        entry.losses,
        entry.prestige,
      ] satisfies HistoryRow;
    });

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
    teams: league.teams.map(entry => entry.name).sort((a, b) => a.localeCompare(b)),
  };
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

const adjustedPassYardsPerAttempt = (
  passingYards: number,
  touchdownPasses: number,
  interceptions: number,
  passAttempts: number
) => {
  if (!passAttempts) return 0;
  const aya = (passingYards + 20 * touchdownPasses - 45 * interceptions) / passAttempts;
  return Math.round(aya * 10) / 10;
};

const getPlayerInfoForYear = (player: PlayerRecord, currentYear: number, year: number) => {
  const yearDiff = currentYear - year;
  if (yearDiff === 0) return { classYear: player.year, rating: player.rating };
  if (yearDiff === 1) {
    if (player.year === 'sr') return { classYear: 'jr', rating: player.rating_jr };
    if (player.year === 'jr') return { classYear: 'so', rating: player.rating_so };
    if (player.year === 'so') return { classYear: 'fr', rating: player.rating_fr };
  }
  if (yearDiff === 2) {
    if (player.year === 'sr') return { classYear: 'so', rating: player.rating_so };
    if (player.year === 'jr') return { classYear: 'fr', rating: player.rating_fr };
  }
  if (yearDiff === 3) {
    return { classYear: 'fr', rating: player.rating_fr };
  }
  return { classYear: player.year, rating: player.rating };
};

export const getPlayerStatCategory = (pos: string): PlayerStatCategory => {
  if (pos === 'qb') return 'passing';
  if (pos === 'rb') return 'rushing';
  if (pos === 'wr' || pos === 'te') return 'receiving';
  if (pos === 'k') return 'kicking';
  if (['dl', 'lb', 'cb', 's'].includes(pos)) return 'defense';
  return 'participation';
};

type YearlyStats = ReturnType<typeof calculateYearlyStats>;

const getPositionStats = (pos: string, values: YearlyStats): PlayerCareerSeason => {
  const category = getPlayerStatCategory(pos);
  let stats: PlayerStatValues = {};

  if (category === 'passing') {
    stats = {
      pass_completions: values.pass_completions,
      pass_attempts: values.pass_attempts,
      completion_percentage: values.completion_percentage,
      pass_yards: values.pass_yards,
      pass_touchdowns: values.pass_touchdowns,
      pass_interceptions: values.pass_interceptions,
      passer_rating: values.passer_rating,
      adjusted_pass_yards_per_attempt: values.adjusted_pass_yards_per_attempt,
    };
  } else if (category === 'rushing') {
    stats = {
      rush_attempts: values.rush_attempts,
      rush_yards: values.rush_yards,
      yards_per_rush: values.rush_ypa,
      rush_touchdowns: values.rush_touchdowns,
      receiving_catches: values.receiving_catches,
      receiving_yards: values.receiving_yards,
      yards_per_rec: values.receiving_ypr,
      receiving_touchdowns: values.receiving_touchdowns,
    };
  } else if (category === 'receiving') {
    stats = {
      receiving_catches: values.receiving_catches,
      receiving_yards: values.receiving_yards,
      yards_per_rec: values.receiving_ypr,
      receiving_touchdowns: values.receiving_touchdowns,
    };
  } else if (category === 'kicking') {
    stats = {
      field_goals_made: values.field_goals_made,
      field_goals_attempted: values.field_goals_attempted,
      field_goal_percent: values.field_goal_percent,
    };
  }

  return {
    classYear: values.class,
    rating: values.rating,
    games: values.games,
    stats,
  };
};

const getPositionGameLog = (
  pos: string,
  log: GameLogRecord,
  game: PlayerGameLog['game']
): PlayerGameLog => {
  const category = getPlayerStatCategory(pos);
  let stats: PlayerStatValues = {};

  if (category === 'passing') {
    stats = {
      pass_completions: log.pass_completions,
      pass_attempts: log.pass_attempts,
      completion_percentage: percentage(log.pass_completions, log.pass_attempts),
      pass_yards: log.pass_yards,
      pass_touchdowns: log.pass_touchdowns,
      pass_interceptions: log.pass_interceptions,
      passer_rating: passerRating(
        log.pass_completions,
        log.pass_attempts,
        log.pass_yards,
        log.pass_touchdowns,
        log.pass_interceptions
      ),
    };
  } else if (category === 'rushing') {
    stats = {
      rush_attempts: log.rush_attempts,
      rush_yards: log.rush_yards,
      rush_touchdowns: log.rush_touchdowns,
      receiving_catches: log.receiving_catches,
      receiving_yards: log.receiving_yards,
      yards_per_rec: average(log.receiving_yards, log.receiving_catches),
      receiving_touchdowns: log.receiving_touchdowns,
    };
  } else if (category === 'receiving') {
    stats = {
      receiving_catches: log.receiving_catches,
      receiving_yards: log.receiving_yards,
      yards_per_rec: average(log.receiving_yards, log.receiving_catches),
      receiving_touchdowns: log.receiving_touchdowns,
    };
  } else if (category === 'kicking') {
    stats = {
      field_goals_made: log.field_goals_made,
      field_goals_attempted: log.field_goals_attempted,
      field_goal_percent: percentage(log.field_goals_made, log.field_goals_attempted),
    };
  } else if (category === 'defense') {
    stats = {
      tackles: log.tackles,
      sacks: log.sacks,
      interceptions: log.interceptions,
      fumbles_forced: log.fumbles_forced,
      fumbles_recovered: log.fumbles_recovered,
    };
  }

  return { game, stats };
};

const calculateYearlyStats = (
  player: PlayerRecord,
  logs: Array<{ log: GameLogRecord }>,
  currentYear: number,
  year: number
) => {
  const yearStats = {
    games: logs.length,
    pass_completions: 0,
    pass_attempts: 0,
    pass_yards: 0,
    pass_touchdowns: 0,
    pass_interceptions: 0,
    rush_attempts: 0,
    rush_yards: 0,
    rush_touchdowns: 0,
    receiving_catches: 0,
    receiving_yards: 0,
    receiving_touchdowns: 0,
    field_goals_made: 0,
    field_goals_attempted: 0,
  };

  logs.forEach(entry => {
    const keys = [
      'pass_completions',
      'pass_attempts',
      'pass_yards',
      'pass_touchdowns',
      'pass_interceptions',
      'rush_attempts',
      'rush_yards',
      'rush_touchdowns',
      'receiving_catches',
      'receiving_yards',
      'receiving_touchdowns',
      'field_goals_made',
      'field_goals_attempted',
    ] as const;
    keys.forEach(key => {
      yearStats[key] += entry.log[key];
    });
  });

  return {
    ...yearStats,
    class: getPlayerInfoForYear(player, currentYear, year).classYear,
    rating: getPlayerInfoForYear(player, currentYear, year).rating,
    completion_percentage: percentage(yearStats.pass_completions, yearStats.pass_attempts),
    pass_ypa: average(yearStats.pass_yards, yearStats.pass_attempts),
    rush_ypa: average(yearStats.rush_yards, yearStats.rush_attempts),
    receiving_ypr: average(yearStats.receiving_yards, yearStats.receiving_catches),
    field_goal_percent: percentage(
      yearStats.field_goals_made,
      yearStats.field_goals_attempted
    ),
    passer_rating: passerRating(
      yearStats.pass_completions,
      yearStats.pass_attempts,
      yearStats.pass_yards,
      yearStats.pass_touchdowns,
      yearStats.pass_interceptions
    ),
    adjusted_pass_yards_per_attempt: adjustedPassYardsPerAttempt(
      yearStats.pass_yards,
      yearStats.pass_touchdowns,
      yearStats.pass_interceptions,
      yearStats.pass_attempts
    ),
  };
};

const getPlayerYears = (
  player: PlayerRecord,
  currentYear: number,
  logs: GameLogRecord[],
  gamesById: Map<number, GameRecord>
) => {
  const yearsFromLogs = logs
    .map(log => gamesById.get(log.gameId))
    .filter(Boolean)
    .map(game => game?.year)
    .filter(Boolean) as number[];

  const yearMapping: Record<PlayerRecord['year'], number[]> = {
    fr: [currentYear],
    so: [currentYear, currentYear - 1],
    jr: [currentYear, currentYear - 1, currentYear - 2],
    sr: [currentYear, currentYear - 1, currentYear - 2, currentYear - 3],
  };
  return Array.from(new Set([...yearsFromLogs, ...(yearMapping[player.year] ?? [currentYear])]))
    .filter(year => year <= currentYear)
    .sort((a, b) => b - a);
};

export const loadPlayer = async (playerId: string) => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const numericPlayerId = Number(playerId);
  const [gameLogs, games, historicalPlayers, finalizedSeasons, memories, origin] = await Promise.all([
    getAllGameLogs(),
    getAllGames(),
    getAllHistoricalPlayers(),
    getPlayerSeasons(numericPlayerId),
    getAllSeasonMemories(),
    getPlayerOrigin(numericPlayerId),
  ]);

  const currentPlayer = players.find(entry => entry.id === numericPlayerId);
  const historicalPlayer = historicalPlayers.find(entry => entry.id === numericPlayerId);
  if (!currentPlayer && !historicalPlayer) {
    throw new Error('Player not found.');
  }
  if (!origin) {
    throw new Error('Player origin not found.');
  }
  const latestSeason = finalizedSeasons.slice().sort((a, b) => b.year - a.year)[0];
  const teamId = currentPlayer?.teamId ?? latestSeason?.teamId;
  const team = league.teams.find(entry => entry.id === teamId);
  if (!team) {
    throw new Error('Team not found for player.');
  }
  const player: PlayerRecord = currentPlayer ?? {
    id: historicalPlayer!.id,
    teamId: team.id,
    first: historicalPlayer!.first,
    last: historicalPlayer!.last,
    year: latestSeason?.classYear ?? 'sr',
    pos: historicalPlayer!.pos,
    rating: latestSeason?.rating ?? 0,
    rating_fr: latestSeason?.rating ?? 0,
    rating_so: latestSeason?.rating ?? 0,
    rating_jr: latestSeason?.rating ?? 0,
    rating_sr: latestSeason?.rating ?? 0,
    stars: historicalPlayer!.stars,
    development_trait: historicalPlayer!.development_trait,
    starter: false,
  };

  const gamesById = new Map(games.map(game => [game.id, game]));
  const teamsById = new Map(league.teams.map(entry => [entry.id, entry]));
  const originalTeam = teamsById.get(origin.originalTeamId);
  if (!originalTeam) {
    throw new Error('Original team not found for player.');
  }

  const playerLogs = gameLogs.filter(log => log.playerId === player.id);
  const career_stats: Record<number, PlayerCareerSeason> = {};
  const game_logs: Record<number, PlayerGameLog[]> = {};

  const currentYearLogs = playerLogs.filter(
    log => gamesById.get(log.gameId)?.year === league.info.currentYear,
  );
  const seasonRows = [...finalizedSeasons];
  if (currentPlayer && currentYearLogs.length) {
    const currentDetails = await getGameDetailsByYear(league.info.currentYear);
    const [currentSeason] = buildPlayerSeasons(
      league.info.currentYear,
      currentDetails,
      players,
    ).filter(season => season.playerId === player.id);
    if (currentSeason) seasonRows.push(currentSeason);
  }
  const seasonsByYear = new Map(seasonRows.map(season => [season.year, season]));
  const years = Array.from(
    new Set([
      ...seasonRows.map(season => season.year),
      ...playerLogs.flatMap(log => {
        const game = gamesById.get(log.gameId);
        return game ? [game.year] : [];
      }),
    ]),
  ).sort((a, b) => b - a);

  years.forEach(year => {
    const yearLogs = playerLogs
      .map(log => ({ log, game: gamesById.get(log.gameId) }))
      .filter(entry => entry.game && entry.game.year === year);

    const logsWithGames = yearLogs
      .map(entry => {
        const scheduleGame = buildScheduleGameForTeam(team, entry.game!, teamsById);
        if (!scheduleGame) return null;
        return getPositionGameLog(player.pos, entry.log, scheduleGame);
      })
      .filter((entry): entry is PlayerGameLog => entry !== null);

    logsWithGames.sort((a, b) => a.game.weekPlayed - b.game.weekPlayed);

    const season = seasonsByYear.get(year);
    if (season) {
      const yearStats = {
        ...season,
        class: season.classYear,
        completion_percentage: percentage(
          season.pass_completions,
          season.pass_attempts,
        ),
        pass_ypa: average(season.pass_yards, season.pass_attempts),
        rush_ypa: average(season.rush_yards, season.rush_attempts),
        receiving_ypr: average(
          season.receiving_yards,
          season.receiving_catches,
        ),
        field_goal_percent: percentage(
          season.field_goals_made,
          season.field_goals_attempted,
        ),
        passer_rating: passerRating(
          season.pass_completions,
          season.pass_attempts,
          season.pass_yards,
          season.pass_touchdowns,
          season.pass_interceptions,
        ),
        adjusted_pass_yards_per_attempt: adjustedPassYardsPerAttempt(
          season.pass_yards,
          season.pass_touchdowns,
          season.pass_interceptions,
          season.pass_attempts,
        ),
      };
      career_stats[year] = getPositionStats(player.pos, yearStats);
    }
    game_logs[year] = logsWithGames;
  });

  const archivedAwards = memories.flatMap(memory =>
    memory.awards
      .filter(entry => entry.playerId === player.id)
      .map(entry => ({
        slug: entry.categorySlug,
        name: getAwardName(entry.categorySlug),
      })),
  );
  const awards = [
    ...archivedAwards,
    ...(league.info.stage === 'summary' && currentPlayer
      ? buildAwards(league, players, gameLogs.filter(log => {
          const game = gamesById.get(log.gameId);
          return game?.year === league.info.currentYear && game.winnerId !== null;
        }))
          .final.filter(entry => entry.first_place?.id === player.id)
          .map(entry => ({ slug: entry.category_slug, name: entry.category_name }))
      : []),
  ];

  return {
    info: league.info,
    player: {
      ...player,
      team: team.name,
    },
    team,
    conferences: league.conferences,
    career_stats,
    game_logs,
    stat_category: getPlayerStatCategory(player.pos),
    awards,
    origin: {
      ...origin,
      originalTeam: originalTeam.name,
    },
    gameLogScope: currentPlayer || team.id === (
      league.teams.find(entry => entry.name === league.info.team)?.id
    )
      ? 'complete'
      : 'retained_postseason_only',
  };
};

export const getTeamInfo = async (teamName: string): Promise<Team | null> => {
  const league = await loadLeagueOptional();
  if (!league) return null;
  return league.teams.find(team => team.name === teamName) ?? null;
};
