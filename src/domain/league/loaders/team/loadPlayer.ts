import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { getPlayerOrigin } from '../../../../db/playerOriginRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import {
  getAllGameLogs,
  getAllGames,
  getAllHistoricalPlayers,
  getGameDetailsByYear,
  getPlayerSeasons,
} from '../../../../db/simRepo';
import type { PlayerRecord } from '../../../../types/db';
import type { PlayerCareerSeason, PlayerGameLog } from '../../../../types/player';
import { getAwardName } from '../../awardDefinitions';
import { buildAwards } from '../../awards';
import { buildPlayerSeasons } from '../../gameDetails';
import { buildScheduleGameForTeam } from '../../utils/scheduleView';
import { average, percentage } from '../../utils/statMath';
import {
  adjustedPassYardsPerAttempt,
  getPlayerStatCategory,
  getPositionGameLog,
  getPositionStats,
  passerRating,
} from './playerStats';

export const loadPlayer = async (playerId: string) => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const numericPlayerId = Number(playerId);
  const [gameLogs, games, historicalPlayers, finalizedSeasons, memories, origin] =
    await Promise.all([
      getAllGameLogs(),
      getAllGames(),
      getAllHistoricalPlayers(),
      getPlayerSeasons(numericPlayerId),
      getAllSeasonMemories(),
      getPlayerOrigin(numericPlayerId),
    ]);

  const currentPlayer = players.find(entry => entry.id === numericPlayerId);
  const historicalPlayer = historicalPlayers.find(entry => entry.id === numericPlayerId);
  if (!currentPlayer && !historicalPlayer) throw new Error('Player not found.');
  if (!origin) throw new Error('Player origin not found.');

  const latestSeason = finalizedSeasons.slice().sort((a, b) => b.year - a.year)[0];
  const teamId = currentPlayer?.teamId ?? latestSeason?.teamId;
  const team = league.teams.find(entry => entry.id === teamId);
  if (!team) throw new Error('Team not found for player.');

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
  if (!originalTeam) throw new Error('Original team not found for player.');

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
  const years = Array.from(new Set([
    ...seasonRows.map(season => season.year),
    ...playerLogs.flatMap(log => {
      const game = gamesById.get(log.gameId);
      return game ? [game.year] : [];
    }),
  ])).sort((left, right) => right - left);

  years.forEach(year => {
    const logsWithGames = playerLogs
      .map(log => ({ log, game: gamesById.get(log.gameId) }))
      .filter(entry => entry.game?.year === year)
      .map(entry => {
        const scheduleGame = buildScheduleGameForTeam(team, entry.game!, teamsById);
        return scheduleGame
          ? getPositionGameLog(player.pos, entry.log, scheduleGame)
          : null;
      })
      .filter((entry): entry is PlayerGameLog => entry !== null)
      .sort((left, right) => left.game.weekPlayed - right.game.weekPlayed);

    const season = seasonsByYear.get(year);
    if (season) {
      career_stats[year] = getPositionStats(player.pos, {
        ...season,
        completion_percentage: percentage(season.pass_completions, season.pass_attempts),
        rush_ypa: average(season.rush_yards, season.rush_attempts),
        receiving_ypr: average(season.receiving_yards, season.receiving_catches),
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
      });
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
      ? buildAwards(
          league,
          players,
          games,
          gameLogs,
        ).final
          .filter(entry => entry.placements[0]?.player?.id === player.id)
          .map(entry => ({ slug: entry.categorySlug, name: entry.categoryName }))
      : []),
  ];

  return {
    info: league.info,
    player: { ...player, team: team.name },
    team,
    conferences: league.conferences,
    career_stats,
    game_logs,
    stat_category: getPlayerStatCategory(player.pos),
    awards,
    origin: { ...origin, originalTeam: originalTeam.name },
    gameLogScope:
      currentPlayer ||
      team.id === league.teams.find(entry => entry.name === league.info.team)?.id
        ? 'complete'
        : 'retained_postseason_only',
  };
};
