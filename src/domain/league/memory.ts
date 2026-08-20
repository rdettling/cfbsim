import type {
  GameLogRecord,
  GameRecord,
  PlayerRecord,
  PlayRecord,
} from '../../types/db';
import type { LeagueState } from '../../types/league';
import type {
  SeasonMemory,
  SeasonPlayoffArchive,
} from '../../types/memory';
import { SeasonMemoryDataIntegrityError } from '../../types/memory';
import { buildAwards } from './awards';
import { isNy6Bowl } from './utils/bowlSelection';
import { buildTeamAggregateTotalTables } from './utils/stats/teamAggregates';
import { sortStandingsTeams } from './utils/standings';

const completedGame = (
  gamesById: Map<number, GameRecord>,
  gameId: number | undefined,
  year: number,
  label: string,
) => {
  const game = gameId === undefined ? undefined : gamesById.get(gameId);
  if (!game || game.year !== year || game.winnerId === null) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${year} is missing a completed ${label} game.`,
    );
  }
  return game;
};

const buildPlayoffArchive = (
  league: LeagueState,
  gamesById: Map<number, GameRecord>,
): SeasonPlayoffArchive => {
  const year = league.info.currentYear;
  const format = league.settings.playoffTeams;
  if (league.playoff.seeds.length !== format) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${year} has an incomplete ${format}-team playoff field.`,
    );
  }
  const teamIds = new Set(league.teams.map(team => team.id));
  if (
    new Set(league.playoff.seeds).size !== league.playoff.seeds.length ||
    league.playoff.seeds.some(teamId => !teamIds.has(teamId))
  ) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${year} has an invalid ${format}-team playoff field.`,
    );
  }
  const autobids = league.settings.playoffAutobids ?? 0;
  if (!Number.isInteger(autobids) || autobids < 0 || autobids > format) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${year} has an invalid playoff autobid count.`,
    );
  }
  const base = {
    seeds: league.playoff.seeds.slice(),
    autobids,
    conferenceChampionsReceiveTopSeeds:
      league.settings.conferenceChampionsReceiveTopSeeds ?? false,
  };
  const requireGame = (
    gameId: number | undefined,
    label: string,
    gameType: GameRecord['gameType'],
  ) => {
    const game = completedGame(gamesById, gameId, year, label);
    if (game.gameType !== gameType) {
      throw new SeasonMemoryDataIntegrityError(
        `Season ${year} has an invalid ${label} game type.`,
      );
    }
    return game;
  };
  const requireMatchup = (
    game: GameRecord,
    teamAId: number,
    teamBId: number,
    label: string,
  ) => {
    const participants = new Set([game.teamAId, game.teamBId]);
    if (
      participants.size !== 2 ||
      !participants.has(teamAId) ||
      !participants.has(teamBId)
    ) {
      throw new SeasonMemoryDataIntegrityError(
        `Season ${year} has an invalid ${label} matchup.`,
      );
    }
    return game;
  };
  const seeds = league.playoff.seeds;

  if (format === 2) {
    const championship = requireMatchup(
      requireGame(league.playoff.natty, 'national championship', 'national_championship'),
      seeds[0],
      seeds[1],
      'national championship',
    );
    return {
      ...base,
      format,
      games: {
        championship: championship.id,
      },
    };
  }
  if (format === 4) {
    const leftSemifinal = requireMatchup(
      requireGame(league.playoff.left_semi, 'left semifinal', 'playoff_semifinal'),
      seeds[0],
      seeds[3],
      'left semifinal',
    );
    const rightSemifinal = requireMatchup(
      requireGame(league.playoff.right_semi, 'right semifinal', 'playoff_semifinal'),
      seeds[1],
      seeds[2],
      'right semifinal',
    );
    const championship = requireMatchup(
      requireGame(league.playoff.natty, 'national championship', 'national_championship'),
      leftSemifinal.winnerId!,
      rightSemifinal.winnerId!,
      'national championship',
    );
    return {
      ...base,
      format,
      games: {
        leftSemifinal: leftSemifinal.id,
        rightSemifinal: rightSemifinal.id,
        championship: championship.id,
      },
    };
  }

  const leftFirstRound1 = requireMatchup(
    requireGame(league.playoff.left_r1_1, 'left first-round 1', 'playoff_first_round'),
    seeds[7], seeds[8], 'left first-round 1',
  );
  const leftFirstRound2 = requireMatchup(
    requireGame(league.playoff.left_r1_2, 'left first-round 2', 'playoff_first_round'),
    seeds[4], seeds[11], 'left first-round 2',
  );
  const rightFirstRound1 = requireMatchup(
    requireGame(league.playoff.right_r1_1, 'right first-round 1', 'playoff_first_round'),
    seeds[6], seeds[9], 'right first-round 1',
  );
  const rightFirstRound2 = requireMatchup(
    requireGame(league.playoff.right_r1_2, 'right first-round 2', 'playoff_first_round'),
    seeds[5], seeds[10], 'right first-round 2',
  );
  const leftQuarterfinal1 = requireMatchup(
    requireGame(league.playoff.left_quarter_1, 'left quarterfinal 1', 'playoff_quarterfinal'),
    seeds[0], leftFirstRound1.winnerId!, 'left quarterfinal 1',
  );
  const leftQuarterfinal2 = requireMatchup(
    requireGame(league.playoff.left_quarter_2, 'left quarterfinal 2', 'playoff_quarterfinal'),
    seeds[3], leftFirstRound2.winnerId!, 'left quarterfinal 2',
  );
  const rightQuarterfinal1 = requireMatchup(
    requireGame(league.playoff.right_quarter_1, 'right quarterfinal 1', 'playoff_quarterfinal'),
    seeds[1], rightFirstRound1.winnerId!, 'right quarterfinal 1',
  );
  const rightQuarterfinal2 = requireMatchup(
    requireGame(league.playoff.right_quarter_2, 'right quarterfinal 2', 'playoff_quarterfinal'),
    seeds[2], rightFirstRound2.winnerId!, 'right quarterfinal 2',
  );
  const leftSemifinal = requireMatchup(
    requireGame(league.playoff.left_semi, 'left semifinal', 'playoff_semifinal'),
    leftQuarterfinal1.winnerId!, leftQuarterfinal2.winnerId!, 'left semifinal',
  );
  const rightSemifinal = requireMatchup(
    requireGame(league.playoff.right_semi, 'right semifinal', 'playoff_semifinal'),
    rightQuarterfinal1.winnerId!, rightQuarterfinal2.winnerId!, 'right semifinal',
  );
  const championship = requireMatchup(
    requireGame(league.playoff.natty, 'national championship', 'national_championship'),
    leftSemifinal.winnerId!, rightSemifinal.winnerId!, 'national championship',
  );

  return {
    ...base,
    format,
    games: {
      leftFirstRound1: leftFirstRound1.id,
      leftFirstRound2: leftFirstRound2.id,
      rightFirstRound1: rightFirstRound1.id,
      rightFirstRound2: rightFirstRound2.id,
      leftQuarterfinal1: leftQuarterfinal1.id,
      leftQuarterfinal2: leftQuarterfinal2.id,
      rightQuarterfinal1: rightQuarterfinal1.id,
      rightQuarterfinal2: rightQuarterfinal2.id,
      leftSemifinal: leftSemifinal.id,
      rightSemifinal: rightSemifinal.id,
      championship: championship.id,
    },
  };
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
  const gamesById = new Map(yearGames.map(game => [game.id, game]));
  const teamsByName = new Map(league.teams.map(team => [team.name, team]));
  const { final } = buildAwards(league, players, games, logs);
  const totals = buildTeamAggregateTotalTables(
    league.teams,
    yearGames,
    plays,
    year,
  );
  const awards = final.flatMap(entry => {
    const winner = entry.placements.find(placement => placement.key === 'first')?.player;
    if (!winner) return [];
    const player = players.find(candidate => candidate.id === winner.id);
    const team = teamsByName.get(winner.teamName);
    if (!player || !team) return [];
    return [{
      categorySlug: entry.categorySlug,
      playerId: player.id,
      teamId: team.id,
    }];
  });
  const playoff = buildPlayoffArchive(league, gamesById);
  const playoffGameIds = new Set(Object.values(playoff.games));
  const conferenceChampions = league.conferences
    .filter(conference => conference.confName !== 'Independent')
    .map(conference => {
      if (conference.championship) {
        const game = completedGame(
          gamesById,
          conference.championship,
          year,
          `${conference.confName} championship`,
        );
        return {
          conferenceName: conference.confName,
          teamId: game.winnerId!,
          championshipGameId: game.id,
        };
      }
      const champion = sortStandingsTeams(
        league.teams.filter(team => team.conference === conference.confName),
      )[0];
      if (!champion) {
        throw new SeasonMemoryDataIntegrityError(
          `Season ${year} has no ${conference.confName} champion.`,
        );
      }
      return {
        conferenceName: conference.confName,
        teamId: champion.id,
        championshipGameId: null,
      };
    });
  const bowls = yearGames
    .filter(game => game.gameType === 'bowl' && !playoffGameIds.has(game.id))
    .map(game => ({
      gameId: game.id,
      name: game.name ?? 'Bowl',
      tier: isNy6Bowl(game.name)
        ? 'ny6' as const
        : 'other' as const,
    }))
    .sort((left, right) => left.gameId - right.gameId);

  return {
    year,
    teamSnapshots: league.teams.map(team => ({
      teamId: team.id,
      conference: team.confName,
      rating: team.rating,
      prestige: team.prestige,
      ranking: team.ranking,
      record: team.record,
      offense: totals.offense[team.name],
      defense: totals.defense[team.name],
    })),
    postseason: {
      playoff,
      conferenceChampions,
      bowls,
    },
    awards,
  };
};
