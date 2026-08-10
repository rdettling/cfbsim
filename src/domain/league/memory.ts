import type {
  GameLogRecord,
  GameRecord,
  PlayerRecord,
  PlayRecord,
} from '../../types/db';
import type { LeagueState } from '../../types/league';
import type {
  SeasonMemory,
  SeasonMemoryEvent,
} from '../../types/memory';
import { buildAwards } from './awards';
import { buildTeamAggregateTotalTables } from './utils/stats/teamAggregates';

const collectPostseasonEvents = (
  league: LeagueState,
  games: GameRecord[],
): SeasonMemoryEvent[] => {
  const events: SeasonMemoryEvent[] = [];
  const seen = new Set<number>();
  const add = (event: SeasonMemoryEvent | null) => {
    if (!event || seen.has(event.gameId)) return;
    seen.add(event.gameId);
    events.push(event);
  };

  for (const conference of league.conferences) {
    if (!conference.championship) continue;
    add({
      type: 'conference_championship',
      gameId: conference.championship,
      conferenceName: conference.confName,
    });
  }

  const playoffRounds: Array<{
    type: Extract<
      SeasonMemoryEvent['type'],
      | 'playoff_first_round'
      | 'playoff_quarterfinal'
      | 'playoff_semifinal'
      | 'national_championship'
    >;
    ids: Array<number | undefined>;
  }> = [
    {
      type: 'playoff_first_round',
      ids: [
        league.playoff.left_r1_1,
        league.playoff.left_r1_2,
        league.playoff.right_r1_1,
        league.playoff.right_r1_2,
      ],
    },
    {
      type: 'playoff_quarterfinal',
      ids: [
        league.playoff.left_quarter_1,
        league.playoff.left_quarter_2,
        league.playoff.right_quarter_1,
        league.playoff.right_quarter_2,
      ],
    },
    {
      type: 'playoff_semifinal',
      ids: [league.playoff.left_semi, league.playoff.right_semi],
    },
    {
      type: 'national_championship',
      ids: [league.playoff.natty],
    },
  ];
  for (const round of playoffRounds) {
    for (const gameId of round.ids) {
      if (gameId) add({ type: round.type, gameId });
    }
  }

  for (const game of games) {
    if (
      game.winnerId !== null &&
      game.gameType === 'bowl' &&
      !seen.has(game.id)
    ) {
      add({ type: 'bowl', gameId: game.id, bowlName: game.name ?? 'Bowl' });
    }
  }

  return events.sort((left, right) => left.gameId - right.gameId);
};

export const buildSeasonMemory = (
  league: LeagueState,
  games: GameRecord[],
  players: PlayerRecord[],
  logs: GameLogRecord[],
  plays: PlayRecord[],
): SeasonMemory => {
  const year = league.info.currentYear;
  const yearGames = games.filter(
    game => game.year === year && game.winnerId !== null,
  );
  const yearGameIds = new Set(yearGames.map(game => game.id));
  const yearLogs = logs.filter(log => yearGameIds.has(log.gameId));
  const teamsByName = new Map(league.teams.map(team => [team.name, team]));
  const { final } = buildAwards(league, players, yearLogs);
  const totals = buildTeamAggregateTotalTables(
    league.teams,
    yearGames,
    plays,
    year,
  );
  const awards = final.flatMap(entry => {
    const winner = entry.first_place;
    if (!winner) return [];
    const player = players.find(candidate => candidate.id === winner.id);
    const team = teamsByName.get(winner.team_name);
    if (!player || !team) return [];
    return [{
      categorySlug: entry.category_slug,
      playerId: player.id,
      teamId: team.id,
    }];
  });

  return {
    year,
    playoffTeams: league.settings.playoffTeams,
    teamSnapshots: league.teams.map(team => ({
      teamId: team.id,
      conference: team.confName ?? team.conference,
      rating: team.rating,
      prestige: team.prestige,
      ranking: team.ranking,
      record: team.record,
      offense: totals.offense[team.name],
      defense: totals.defense[team.name],
    })),
    events: collectPostseasonEvents(league, yearGames),
    awards,
  };
};
