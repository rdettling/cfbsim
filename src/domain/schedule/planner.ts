import type { ScheduleGame, Team } from '../../types/domain';
import type { FullGame } from '../../types/scheduleTypes';
import type { GameRecord } from '../../types/db';
import { buildUserScheduleFromGames } from './projection';

const REGULAR_SEASON_WEEKS = 14;
const REGULAR_SEASON_GAMES = 12;
export const VALIDATION_SCHEDULE_SEED = 0x51ced5ed;

export interface SchedulePlannerOptions {
  year: number;
  seed: number;
  requireComplete: boolean;
  requiredGames?: FullGame[];
}

export class SchedulePlanningError extends Error {}
export class ScheduleValidationError extends Error {}

export const isScheduleFailure = (error: unknown) =>
  error instanceof SchedulePlanningError ||
  error instanceof ScheduleValidationError;

export const stableNumber = (...values: number[]) => {
  let hash = 2166136261;
  values.forEach(value => {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
};

const scheduleKey = (teamAId: number, teamBId: number, weekPlayed: number) => {
  const [minId, maxId] = teamAId < teamBId ? [teamAId, teamBId] : [teamBId, teamAId];
  return `${minId}-${maxId}-${weekPlayed}`;
};

export const buildFixedGamesFromRecords = (
  games: GameRecord[],
  teamsById: Map<number, Team>
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
    fullGames = fillUserSchedule(
      schedule,
      userTeam,
      teams,
      fixedGames,
      options,
    );
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
    game => !fixedKeys.has(scheduleKey(game.teamA.id, game.teamB.id, game.weekPlayed))
  );
  return { schedule, fixedGames, fullGames, newGames };
};

const chooseHomeAway = (
  team: Team,
  opponent: Team,
  homeCounts: Map<number, number>,
  year: number,
  seed: number,
) => {
  const targetHome = Math.floor(REGULAR_SEASON_GAMES / 2);
  const teamHome = homeCounts.get(team.id) ?? 0;
  const opponentHome = homeCounts.get(opponent.id) ?? 0;

  const teamNeedsHome = teamHome < targetHome;
  const opponentNeedsHome = opponentHome < targetHome;

  if (teamNeedsHome && !opponentNeedsHome) return { homeTeam: team, awayTeam: opponent };
  if (opponentNeedsHome && !teamNeedsHome) return { homeTeam: opponent, awayTeam: team };

  if (teamHome === opponentHome) {
    return stableNumber(team.id, opponent.id, year, seed) % 2 === 0
      ? { homeTeam: team, awayTeam: opponent }
      : { homeTeam: opponent, awayTeam: team };
  }

  return teamHome < opponentHome
    ? { homeTeam: team, awayTeam: opponent }
    : { homeTeam: opponent, awayTeam: team };
};

export const isConferenceGame = (team: Team, opponent: Team) =>
  team.conference === opponent.conference && team.conference !== 'Independent';

const scheduleGame = (
  games: FullGame[],
  team: Team,
  opponent: Team,
  weekPlayed: number,
  homeTeam: Team | null,
  awayTeam: Team | null,
  name?: string | null,
  rivalryKey: string | null = null,
) => {
  games.push({
    teamA: team,
    teamB: opponent,
    weekPlayed,
    homeTeam,
    awayTeam,
    venue: null,
    name: name ?? null,
    rivalryKey,
  });

  if (isConferenceGame(team, opponent)) {
    team.confGames += 1;
    opponent.confGames += 1;
  } else {
    team.nonConfGames += 1;
    opponent.nonConfGames += 1;
  }
};

const buildOpponentCard = (team: Team) => ({
  name: team.name,
  rating: team.rating,
  ranking: team.ranking,
  record: team.record,
});

function buildLabel(userTeam: Team, opponent: Team) {
  if (isConferenceGame(userTeam, opponent)) {
    return `C (${userTeam.conference})`;
  }
  return opponent.conference ? `NC (${opponent.conference})` : 'NC (Ind)';
}

export const resetTeamScheduleCounts = (teams: Team[]) => {
  teams.forEach(team => {
    team.confGames = 0;
    team.nonConfGames = 0;
  });
};

export const fillUserSchedule = (
  schedule: ScheduleGame[],
  userTeam: Team,
  teams: Team[],
  fixedGames: FullGame[],
  options: SchedulePlannerOptions,
  opponentAttempt = 0,
): FullGame[] => {
  const { year, seed, requireComplete } = options;
  const initialSchedule = structuredClone(schedule);
  resetTeamScheduleCounts(teams);
  const teamByName = new Map(teams.map(team => [team.name, team]));
  const scheduledOpponents = new Map<number, Set<number>>(
    teams.map(team => [team.id, new Set<number>()])
  );
  const homeCounts = new Map<number, number>(teams.map(team => [team.id, 0]));
  const games: FullGame[] = [];

  fixedGames.forEach(game => {
    scheduleGame(
      games,
      game.teamA,
      game.teamB,
      game.weekPlayed,
      game.homeTeam,
      game.awayTeam,
      game.name ?? null,
      game.rivalryKey,
    );
    scheduledOpponents.get(game.teamA.id)?.add(game.teamB.id);
    scheduledOpponents.get(game.teamB.id)?.add(game.teamA.id);
    if (game.homeTeam) {
      homeCounts.set(game.homeTeam.id, (homeCounts.get(game.homeTeam.id) ?? 0) + 1);
    }
  });

  schedule.forEach(slot => {
    if (!slot.opponent) return;
    const opponent = teamByName.get(slot.opponent.name);
    if (!opponent) return;
    if (scheduledOpponents.get(userTeam.id)?.has(opponent.id)) return;

    let homeTeam = userTeam;
    let awayTeam = opponent;
    if (slot.location === 'Away') {
      homeTeam = opponent;
      awayTeam = userTeam;
    } else if (!slot.location) {
      const pick = chooseHomeAway(
        userTeam,
        opponent,
        homeCounts,
        year,
        seed,
      );
      homeTeam = pick.homeTeam;
      awayTeam = pick.awayTeam;
      slot.location = homeTeam.id === userTeam.id ? 'Home' : 'Away';
    }

    scheduleGame(
      games,
      userTeam,
      opponent,
      slot.weekPlayed,
      homeTeam,
      awayTeam,
      slot.label ?? null
    );
    scheduledOpponents.get(userTeam.id)?.add(opponent.id);
    scheduledOpponents.get(opponent.id)?.add(userTeam.id);
    homeCounts.set(homeTeam.id, (homeCounts.get(homeTeam.id) ?? 0) + 1);
  });

  const conferences = Array.from(new Set(teams.map(team => team.conference))).filter(
    (conf): conf is string => Boolean(conf) && conf !== 'Independent'
  );

  conferences.forEach(confName => {
    const confTeamsBase = teams.filter(team => team.conference === confName);
    const target = confTeamsBase.reduce(
      (maximum, team) => Math.max(maximum, team.confLimit),
      0,
    );
    confTeamsBase.forEach(team => {
      team.confLimit = target;
      team.nonConfLimit = REGULAR_SEASON_GAMES - target;
    });
    if ((confTeamsBase.length * target) % 2 === 1) {
      const rotation = confTeamsBase
        .slice()
        .sort((left, right) =>
          stableNumber(left.id, year, opponentAttempt) -
          stableNumber(right.id, year, opponentAttempt),
        )
        .find(team => team.confGames <= target - 1);
      if (rotation) {
        rotation.confLimit = target - 1;
        rotation.nonConfLimit = REGULAR_SEASON_GAMES - rotation.confLimit;
      }
    }
    let confTeamsList = confTeamsBase.slice();

    const getPotential = (team: Team) =>
      confTeamsBase.filter(opponent => {
        if (opponent.id === team.id) return false;
        if (opponent.confGames >= opponent.confLimit) return false;
        return !scheduledOpponents.get(team.id)?.has(opponent.id);
      });

    const getBuffer = (team: Team, potential: Team[]) =>
      potential.length - (team.confLimit - team.confGames);

    while (confTeamsList.length) {
      const stats = confTeamsList.map(team => {
        const potential = getPotential(team);
        return {
          team,
          potential,
          buffer: getBuffer(team, potential),
        };
      });
      stats.sort(
        (a, b) =>
          a.buffer - b.buffer ||
          a.team.confGames - b.team.confGames ||
          stableNumber(a.team.id, year, seed, opponentAttempt) -
          stableNumber(b.team.id, year, seed, opponentAttempt)
      );
      const { team, potential } = stats[0];
      confTeamsList = confTeamsList.filter(entry => entry.id !== team.id);

      const potentialBuffers = new Map(
        potential.map(opponent => {
          const opponentPotential = getPotential(opponent);
          return [opponent.id, getBuffer(opponent, opponentPotential)];
        }),
      );
      const sortedPotential = potential.slice().sort((a, b) => {
        const aBuffer = potentialBuffers.get(a.id) ?? 0;
        const bBuffer = potentialBuffers.get(b.id) ?? 0;
        return aBuffer - bBuffer ||
          a.confGames - b.confGames ||
          stableNumber(a.id, team.id, year, seed, opponentAttempt) -
          stableNumber(b.id, team.id, year, seed, opponentAttempt);
      });

      while (team.confGames < team.confLimit) {
        if (!sortedPotential.length) break;
        const opponent = sortedPotential.shift();
        if (!opponent) break;
        if (opponent.confGames >= opponent.confLimit) continue;
        if (scheduledOpponents.get(team.id)?.has(opponent.id)) continue;

        const { homeTeam, awayTeam } = chooseHomeAway(
          team,
          opponent,
          homeCounts,
          year,
          seed,
        );
        scheduleGame(games, team, opponent, 0, homeTeam, awayTeam, null);
        scheduledOpponents.get(team.id)?.add(opponent.id);
        scheduledOpponents.get(opponent.id)?.add(team.id);
        homeCounts.set(homeTeam.id, (homeCounts.get(homeTeam.id) ?? 0) + 1);
      }
    }
  });

  let teamsList = teams.slice();
  const getNonConfPotential = (team: Team) =>
    teams.filter(opponent => {
      if (opponent.id === team.id) return false;
      if (opponent.nonConfGames >= opponent.nonConfLimit) return false;
      if (scheduledOpponents.get(team.id)?.has(opponent.id)) return false;
      if (opponent.conference !== team.conference) return true;
      return team.conference === 'Independent' && opponent.conference === 'Independent';
    });

  const getNonConfBuffer = (team: Team, potential: Team[]) =>
    potential.length - (team.nonConfLimit - team.nonConfGames);

  while (teamsList.length) {
    const stats = teamsList.map(team => {
      const potential = getNonConfPotential(team);
      return {
        team,
        potential,
        buffer: getNonConfBuffer(team, potential),
      };
    });
    stats.sort(
      (a, b) =>
        a.buffer - b.buffer ||
        a.team.nonConfGames - b.team.nonConfGames ||
        stableNumber(a.team.id, year, seed, 1, opponentAttempt) -
        stableNumber(b.team.id, year, seed, 1, opponentAttempt)
    );
    const { team, potential } = stats[0];
    teamsList = teamsList.filter(entry => entry.id !== team.id);

    const potentialBuffers = new Map(
      potential.map(opponent => {
        const opponentPotential = getNonConfPotential(opponent);
        return [opponent.id, getNonConfBuffer(opponent, opponentPotential)];
      }),
    );
    const sortedPotential = potential.slice().sort((a, b) => {
      const aBuffer = potentialBuffers.get(a.id) ?? 0;
      const bBuffer = potentialBuffers.get(b.id) ?? 0;
      return aBuffer - bBuffer ||
        a.nonConfGames - b.nonConfGames ||
        stableNumber(a.id, team.id, year, seed, 1, opponentAttempt) -
        stableNumber(b.id, team.id, year, seed, 1, opponentAttempt);
    });

    while (team.nonConfGames < team.nonConfLimit) {
      if (!sortedPotential.length) break;
      const opponent = sortedPotential.shift();
      if (!opponent) break;
      if (opponent.nonConfGames >= opponent.nonConfLimit) continue;
      if (scheduledOpponents.get(team.id)?.has(opponent.id)) continue;

      const { homeTeam, awayTeam } = chooseHomeAway(
        team,
        opponent,
        homeCounts,
        year,
        seed,
      );
      scheduleGame(games, team, opponent, 0, homeTeam, awayTeam, null);
      scheduledOpponents.get(team.id)?.add(opponent.id);
      scheduledOpponents.get(opponent.id)?.add(team.id);
      homeCounts.set(homeTeam.id, (homeCounts.get(homeTeam.id) ?? 0) + 1);
    }
  }

  const incompleteTeam = teams.find(
    team => team.confGames + team.nonConfGames !== REGULAR_SEASON_GAMES,
  );
  if (incompleteTeam) {
    if (opponentAttempt < 49) {
      return fillUserSchedule(
        initialSchedule,
        userTeam,
        teams,
        fixedGames,
        options,
        opponentAttempt + 1,
      );
    }
    if (requireComplete) {
      throw new SchedulePlanningError(
        `${incompleteTeam.name} cannot be assigned ${REGULAR_SEASON_GAMES} distinct opponents.`,
      );
    }
  }

  const fixedWeekGames = games.filter(game => game.weekPlayed > 0);
  const unscheduledGames = games.filter(game => !game.weekPlayed || game.weekPlayed === 0);
  const baseTeamWeeks = new Map<number, Set<number>>(
    teams.map(team => [team.id, new Set<number>()])
  );
  const baseWeekLoad = new Map<number, number>();
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week += 1) {
    baseWeekLoad.set(week, 0);
  }

  fixedWeekGames.forEach(game => {
    baseTeamWeeks.get(game.teamA.id)?.add(game.weekPlayed);
    baseTeamWeeks.get(game.teamB.id)?.add(game.weekPlayed);
    baseWeekLoad.set(game.weekPlayed, (baseWeekLoad.get(game.weekPlayed) ?? 0) + 1);
  });

  let assigned = false;
  const weeks = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, index) => index + 1);
  const pickWeekByLoad = (candidateWeeks: number[], isConference: boolean, weekLoad: Map<number, number>) =>
    candidateWeeks.reduce((best, current) => {
      const bestLoad = weekLoad.get(best) ?? 0;
      const currentLoad = weekLoad.get(current) ?? 0;
      if (currentLoad < bestLoad) return current;
      if (currentLoad > bestLoad) return best;
      if (isConference) return current > best ? current : best;
      return current < best ? current : best;
    });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    unscheduledGames.forEach(game => {
      game.weekPlayed = 0;
    });

    const teamWeeks = new Map<number, Set<number>>(
      Array.from(baseTeamWeeks.entries()).map(([teamId, weeksSet]) => [
        teamId,
        new Set(weeksSet),
      ])
    );
    const weekLoad = new Map(baseWeekLoad);
    const remainingGames = unscheduledGames.slice();
    const remainingSet = new Set(remainingGames.map(game => game));
    const gamesByTeam = new Map<number, FullGame[]>(
      teams.map(team => [team.id, []])
    );
    remainingGames.forEach(game => {
      gamesByTeam.get(game.teamA.id)?.push(game);
      gamesByTeam.get(game.teamB.id)?.push(game);
    });
    const availableWeeksByGame = new Map<FullGame, Set<number>>();
    remainingGames.forEach(game => {
      const available = new Set<number>();
      weeks.forEach(week => {
        if (
          !teamWeeks.get(game.teamA.id)?.has(week) &&
          !teamWeeks.get(game.teamB.id)?.has(week)
        ) {
          available.add(week);
        }
      });
      availableWeeksByGame.set(game, available);
    });

    let failed = false;
    while (remainingGames.length) {
      let choice:
        | {
            game: FullGame;
            available: Set<number>;
            key: number[];
            index: number;
          }
        | undefined;

      remainingGames.forEach((game, index) => {
        const available = availableWeeksByGame.get(game) ?? new Set<number>();
        const isNonConf = !isConferenceGame(game.teamA, game.teamB);
        const nonConfPriority = isNonConf ? 0 : 1;
        const option = {
          game,
          available,
          key: [
            available.size,
            nonConfPriority,
            stableNumber(game.teamA.id, game.teamB.id, year, seed, attempt),
          ],
          index,
        };

        if (!choice) {
          choice = option;
          return;
        }
        for (let keyIndex = 0; keyIndex < option.key.length; keyIndex += 1) {
          if (option.key[keyIndex] !== choice.key[keyIndex]) {
            if (option.key[keyIndex] < choice.key[keyIndex]) {
              choice = option;
            }
            return;
          }
        }
      });

      if (!choice) {
        failed = true;
        break;
      }
      const isConference = isConferenceGame(choice.game.teamA, choice.game.teamB);
      const availableWeeks = Array.from(choice.available);
      const candidateWeeks = availableWeeks;
      if (!candidateWeeks.length) {
        failed = true;
        break;
      }
      const week = pickWeekByLoad(candidateWeeks, isConference, weekLoad);

      choice.game.weekPlayed = week;
      teamWeeks.get(choice.game.teamA.id)?.add(week);
      teamWeeks.get(choice.game.teamB.id)?.add(week);
      weekLoad.set(week, (weekLoad.get(week) ?? 0) + 1);

      remainingGames.splice(choice.index, 1);
      remainingSet.delete(choice.game);

      gamesByTeam.get(choice.game.teamA.id)?.forEach(related => {
        if (remainingSet.has(related)) {
          availableWeeksByGame.get(related)?.delete(week);
        }
      });
      gamesByTeam.get(choice.game.teamB.id)?.forEach(related => {
        if (remainingSet.has(related)) {
          availableWeeksByGame.get(related)?.delete(week);
        }
      });
    }

    if (!failed) {
      assigned = true;
      break;
    }
  }

  if (!assigned) {
    throw new SchedulePlanningError(
      'Unable to assign every game to a conflict-free week.',
    );
  }

  const existingLabelsByWeek = new Map<number, string | undefined>();
  const existingIdsByWeek = new Map<number, string | undefined>();
  schedule.forEach(slot => {
    existingLabelsByWeek.set(slot.weekPlayed, slot.label);
    existingIdsByWeek.set(slot.weekPlayed, slot.id);
    slot.opponent = null;
    slot.label = undefined;
    slot.location = undefined;
    slot.id = '';
  });

  const userGames = games.filter(
    game => game.teamA.id === userTeam.id || game.teamB.id === userTeam.id
  );
  userGames.forEach(game => {
    if (!game.weekPlayed || game.weekPlayed <= 0) return;
    const slot = schedule[game.weekPlayed - 1];
    if (!slot) return;

    const opponent = game.teamA.id === userTeam.id ? game.teamB : game.teamA;
    slot.opponent = buildOpponentCard(opponent);
    const existingLabel = existingLabelsByWeek.get(game.weekPlayed);
    const existingId = existingIdsByWeek.get(game.weekPlayed);
    slot.label = existingLabel ?? game.name ?? buildLabel(userTeam, opponent);
    slot.location =
      game.homeTeam?.id === userTeam.id
        ? 'Home'
        : game.awayTeam?.id === userTeam.id
          ? 'Away'
          : 'Neutral';
    slot.id =
      existingId && existingId.length
        ? existingId
        : `${game.teamA.name}-vs-${game.teamB.name}-week-${game.weekPlayed}`;
  });

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
        `${team.name} can only be assigned ${teamGames.length} of ${REGULAR_SEASON_GAMES} games with this alignment.`,
      );
    }
    const opponents = new Set(
      teamGames.map(game => game.teamA.id === team.id ? game.teamB.id : game.teamA.id),
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
