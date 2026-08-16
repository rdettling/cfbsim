import type { GameRecord } from '../../types/db';
import type { ScheduleGame, Team } from '../../types/domain';
import type { FullGame } from '../../types/scheduleTypes';
import { orientConferenceMatchups } from './conferenceSites';
import {
  REGULAR_SEASON_GAMES,
  VALIDATION_SCHEDULE_SEED,
} from './constants';
import {
  SchedulePlanningError,
  ScheduleValidationError,
} from './errors';
import { isConferenceGame } from './matchups';
import { orientAutomaticNonConferenceMatchups } from './nonConferenceSites';
import {
  type OpponentSelection,
  selectScheduleOpponents,
} from './opponentSelection';
import {
  buildUserScheduleFromGames,
  projectFullGamesToUserSchedule,
} from './projection';
import { assignRegularSeasonWeeks } from './weekAssignment';

export interface SchedulePlannerOptions {
  year: number;
  seed: number;
  requireComplete: boolean;
  requiredGames?: FullGame[];
}

const scheduleKey = (teamAId: number, teamBId: number, weekPlayed: number) => {
  const [minId, maxId] = teamAId < teamBId ? [teamAId, teamBId] : [teamBId, teamAId];
  return `${minId}-${maxId}-${weekPlayed}`;
};

const buildFixedGamesFromRecords = (
  games: GameRecord[],
  teamsById: Map<number, Team>,
): FullGame[] =>
  games
    .filter(game => game.weekPlayed && game.weekPlayed > 0)
    .map(game => ({
      teamA: teamsById.get(game.teamAId)!,
      teamB: teamsById.get(game.teamBId)!,
      weekPlayed: game.weekPlayed,
      homeTeam: game.homeTeamId ? teamsById.get(game.homeTeamId)! : null,
      awayTeam: game.awayTeamId ? teamsById.get(game.awayTeamId)! : null,
      venue: game.venue,
      name: game.name ?? null,
      rivalryKey: game.rivalryKey,
    }));

export const buildFullScheduleFromExisting = (
  userTeam: Team,
  teams: Team[],
  existingGames: GameRecord[],
  options: SchedulePlannerOptions,
) => {
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const schedule = buildUserScheduleFromGames(userTeam, teams, existingGames);
  const fixedGames = buildFixedGamesFromRecords(existingGames, teamsById);
  const persistedFixedGames = [...fixedGames];
  const existingOpponents = new Set(
    fixedGames.map(game => scheduleKey(game.teamA.id, game.teamB.id, 0)),
  );
  fixedGames.push(
    ...(options.requiredGames ?? []).filter(
      game => !existingOpponents.has(scheduleKey(game.teamA.id, game.teamB.id, 0)),
    ),
  );

  let fullGames: FullGame[];
  try {
    fullGames = fillUserSchedule(schedule, userTeam, teams, fixedGames, options);
  } catch (error) {
    if (
      !(error instanceof SchedulePlanningError) ||
      options.seed === VALIDATION_SCHEDULE_SEED
    ) {
      throw error;
    }
    fullGames = fillUserSchedule(
      schedule,
      userTeam,
      teams,
      fixedGames,
      { ...options, seed: VALIDATION_SCHEDULE_SEED },
    );
  }

  const fixedKeys = new Set(
    persistedFixedGames.map(game =>
      scheduleKey(game.teamA.id, game.teamB.id, game.weekPlayed),
    ),
  );
  const newGames = fullGames.filter(
    game => !fixedKeys.has(scheduleKey(game.teamA.id, game.teamB.id, game.weekPlayed)),
  );
  return { schedule, fixedGames, fullGames, newGames };
};

export const fillUserSchedule = (
  schedule: ScheduleGame[],
  userTeam: Team,
  teams: Team[],
  fixedGames: FullGame[],
  options: SchedulePlannerOptions,
): FullGame[] => {
  const { year, seed, requireComplete } = options;
  let selection: OpponentSelection | undefined;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    selection = selectScheduleOpponents({
      teams,
      fixedGames,
      year,
      seed,
      attempt,
    });
    if (!selection.incompleteTeam) break;
  }
  if (!selection) {
    throw new SchedulePlanningError('Schedule opponents could not be selected.');
  }
  if (selection.incompleteTeam && requireComplete) {
    throw new SchedulePlanningError(
      `${selection.incompleteTeam.name} cannot be assigned ` +
      `${REGULAR_SEASON_GAMES} distinct opponents.`,
    );
  }

  const games = selection.fixedGames;
  games.push(...orientConferenceMatchups({
    matchups: selection.conferenceMatchups,
    fixedGames: games.filter(game => isConferenceGame(game.teamA, game.teamB)),
    year,
    seed,
  }));
  games.push(...orientAutomaticNonConferenceMatchups({
    matchups: selection.automaticNonConferenceMatchups,
    lockedGames: games,
    year,
    seed,
  }));

  assignRegularSeasonWeeks({ games, teams, year, seed });
  projectFullGamesToUserSchedule(schedule, userTeam, games);
  return games;
};

export const assertCompleteSchedule = (teams: Team[], games: FullGame[]) => {
  const gamesByTeam = new Map<number, FullGame[]>(
    teams.map(team => [team.id, []]),
  );
  games.forEach(game => {
    gamesByTeam.get(game.teamA.id)?.push(game);
    gamesByTeam.get(game.teamB.id)?.push(game);
  });

  for (const team of teams) {
    const teamGames = gamesByTeam.get(team.id) ?? [];
    if (teamGames.length !== REGULAR_SEASON_GAMES) {
      throw new ScheduleValidationError(
        `${team.name} can only be assigned ${teamGames.length} of ` +
        `${REGULAR_SEASON_GAMES} games with this alignment.`,
      );
    }
    const opponents = new Set(
      teamGames.map(game =>
        game.teamA.id === team.id ? game.teamB.id : game.teamA.id
      ),
    );
    if (opponents.size !== teamGames.length) {
      throw new ScheduleValidationError(
        `${team.name} has a duplicate opponent in the proposed schedule.`,
      );
    }
    const weeks = new Set(teamGames.map(game => game.weekPlayed));
    if (weeks.size !== teamGames.length) {
      throw new ScheduleValidationError(
        `${team.name} would play more than once in the same week.`,
      );
    }
  }
};
