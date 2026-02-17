import type { ScheduleGame, Team } from '../types/domain';
import type { FullGame } from '../types/schedule';
import type { NonConData } from '../types/league';
import { getRivalriesData } from '../db/baseData';
import type { GameRecord } from '../types/db';

const REGULAR_SEASON_WEEKS = 14;
const REGULAR_SEASON_GAMES = 12;

export const buildSchedule = (weeks = REGULAR_SEASON_WEEKS): ScheduleGame[] =>
  Array.from({ length: weeks }, (_, index) => ({
    weekPlayed: index + 1,
    opponent: null,
    result: '',
    score: '',
    spread: '',
    moneyline: '',
    id: '',
  }));

export const buildUserScheduleFromGames = (
  userTeam: Team,
  teams: Team[],
  games: GameRecord[],
  weeks = REGULAR_SEASON_WEEKS
): ScheduleGame[] => {
  const schedule = buildSchedule(weeks);
  const teamsById = new Map(teams.map(team => [team.id, team]));

  games.forEach(game => {
    if (!game.weekPlayed || game.weekPlayed < 1 || game.weekPlayed > weeks) return;
    if (game.teamAId !== userTeam.id && game.teamBId !== userTeam.id) return;

    const slot = schedule[game.weekPlayed - 1];
    if (!slot) return;

    const opponentId = game.teamAId === userTeam.id ? game.teamBId : game.teamAId;
    const opponent = teamsById.get(opponentId);
    if (!opponent) return;

    const isTeamA = game.teamAId === userTeam.id;
    const scoreA = game.scoreA ?? 0;
    const scoreB = game.scoreB ?? 0;
    if (game.winnerId) {
      const userScore = isTeamA ? scoreA : scoreB;
      const oppScore = isTeamA ? scoreB : scoreA;
      slot.score = `${userScore}-${oppScore}`;
      slot.result = game.winnerId === userTeam.id ? 'W' : 'L';
    }
    slot.spread = isTeamA ? game.spreadA : game.spreadB;
    slot.moneyline = isTeamA ? game.moneylineA : game.moneylineB;

    slot.opponent = {
      name: opponent.name,
      rating: opponent.rating,
      ranking: opponent.ranking,
      record: opponent.record,
    };

    const label = game.name ?? game.baseLabel ?? buildLabel(userTeam, opponent);
    slot.label = label;
    slot.location = game.neutralSite
      ? 'Neutral'
      : game.homeTeamId === userTeam.id
        ? 'Home'
        : game.awayTeamId === userTeam.id
          ? 'Away'
          : undefined;
    slot.id = `${game.id}`;
  });

  return schedule;
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
      name: game.name ?? null,
    }));

export const buildFullScheduleFromExisting = (
  userTeam: Team,
  teams: Team[],
  existingGames: GameRecord[]
) => {
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const schedule = buildUserScheduleFromGames(userTeam, teams, existingGames);
  const fixedGames = buildFixedGamesFromRecords(existingGames, teamsById);
  const fullGames = fillUserSchedule(schedule, userTeam, teams, fixedGames);
  const fixedKeys = new Set(fixedGames.map(game => scheduleKey(game.teamA.id, game.teamB.id, game.weekPlayed)));
  const newGames = fullGames.filter(
    game => !fixedKeys.has(scheduleKey(game.teamA.id, game.teamB.id, game.weekPlayed))
  );
  return { schedule, fixedGames, fullGames, newGames };
};

export const applyRivalriesToSchedule = async (
  schedule: ScheduleGame[],
  userTeam: Team,
  teams: Team[]
): Promise<NonConData['pending_rivalries']> => {
  const rivalries = await getRivalriesData();
  let pendingId = 1;
  const pending: NonConData['pending_rivalries'] = [];

  const teamByName = new Map(teams.map(team => [team.name, team]));

  rivalries.rivalries.forEach(([teamA, teamB, week, name]) => {
    if (teamA !== userTeam.name && teamB !== userTeam.name) return;
    const opponentName = teamA === userTeam.name ? teamB : teamA;
    const opponent = teamByName.get(opponentName);
    if (!opponent) return;

    if (week) {
      const slot = schedule[week - 1];
      if (!slot.opponent) {
        slot.opponent = {
          name: opponent.name,
          rating: opponent.rating,
          ranking: opponent.ranking,
          record: opponent.record,
        };
        slot.label = name ?? 'Rivalry';
        slot.id = `${userTeam.name}-vs-${opponent.name}-week-${week}`;
      }
      return;
    }

    pending.push({
      id: pendingId,
      teamA,
      teamB,
      name: name ?? null,
      homeTeam: null,
      awayTeam: null,
    });
    pendingId += 1;
  });

  return pending;
};

const chooseHomeAway = (
  team: Team,
  opponent: Team,
  homeCounts: Map<number, number>,
  awayCounts: Map<number, number>
) => {
  const targetHome = Math.floor(REGULAR_SEASON_GAMES / 2);
  const teamHome = homeCounts.get(team.id) ?? 0;
  const opponentHome = homeCounts.get(opponent.id) ?? 0;

  const teamNeedsHome = teamHome < targetHome;
  const opponentNeedsHome = opponentHome < targetHome;

  if (teamNeedsHome && !opponentNeedsHome) return { homeTeam: team, awayTeam: opponent };
  if (opponentNeedsHome && !teamNeedsHome) return { homeTeam: opponent, awayTeam: team };

  if (teamHome === opponentHome) {
    return Math.random() < 0.5
      ? { homeTeam: team, awayTeam: opponent }
      : { homeTeam: opponent, awayTeam: team };
  }

  return teamHome < opponentHome
    ? { homeTeam: team, awayTeam: opponent }
    : { homeTeam: opponent, awayTeam: team };
};

const isConferenceGame = (team: Team, opponent: Team) =>
  team.conference === opponent.conference && team.conference !== 'Independent';

const scheduleGame = (
  games: FullGame[],
  team: Team,
  opponent: Team,
  weekPlayed: number,
  homeTeam: Team,
  awayTeam: Team,
  name?: string | null
) => {
  games.push({
    teamA: team,
    teamB: opponent,
    weekPlayed,
    homeTeam,
    awayTeam,
    name: name ?? null,
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

const resetTeamScheduleCounts = (teams: Team[]) => {
  teams.forEach(team => {
    team.confGames = 0;
    team.nonConfGames = 0;
  });
};

export const fillUserSchedule = (
  schedule: ScheduleGame[],
  userTeam: Team,
  teams: Team[],
  fixedGames: FullGame[] = []
): FullGame[] => {
  resetTeamScheduleCounts(teams);
  const teamByName = new Map(teams.map(team => [team.name, team]));
  const scheduledOpponents = new Map<number, Set<number>>(
    teams.map(team => [team.id, new Set<number>()])
  );
  const homeCounts = new Map<number, number>(teams.map(team => [team.id, 0]));
  const awayCounts = new Map<number, number>(teams.map(team => [team.id, 0]));
  const games: FullGame[] = [];

  fixedGames.forEach(game => {
    scheduleGame(
      games,
      game.teamA,
      game.teamB,
      game.weekPlayed,
      game.homeTeam ?? game.teamA,
      game.awayTeam ?? game.teamB,
      game.name ?? null
    );
    scheduledOpponents.get(game.teamA.id)?.add(game.teamB.id);
    scheduledOpponents.get(game.teamB.id)?.add(game.teamA.id);
    if (game.homeTeam) {
      homeCounts.set(game.homeTeam.id, (homeCounts.get(game.homeTeam.id) ?? 0) + 1);
    }
    if (game.awayTeam) {
      awayCounts.set(game.awayTeam.id, (awayCounts.get(game.awayTeam.id) ?? 0) + 1);
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
      const pick = chooseHomeAway(userTeam, opponent, homeCounts, awayCounts);
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
    awayCounts.set(awayTeam.id, (awayCounts.get(awayTeam.id) ?? 0) + 1);
  });

  const conferences = Array.from(new Set(teams.map(team => team.conference))).filter(
    (conf): conf is string => Boolean(conf) && conf !== 'Independent'
  );

  conferences.forEach(confName => {
    const confTeamsBase = teams.filter(team => team.conference === confName);
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
          a.buffer - b.buffer || a.team.confGames - b.team.confGames
      );
      const { team, potential } = stats[0];
      confTeamsList = confTeamsList.filter(entry => entry.id !== team.id);

      const sortedPotential = potential.slice().sort((a, b) => {
        const aPotential = getPotential(a);
        const bPotential = getPotential(b);
        const aBuffer = getBuffer(a, aPotential);
        const bBuffer = getBuffer(b, bPotential);
        return aBuffer - bBuffer || a.confGames - b.confGames;
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
          awayCounts
        );
        scheduleGame(games, team, opponent, 0, homeTeam, awayTeam, null);
        scheduledOpponents.get(team.id)?.add(opponent.id);
        scheduledOpponents.get(opponent.id)?.add(team.id);
        homeCounts.set(homeTeam.id, (homeCounts.get(homeTeam.id) ?? 0) + 1);
        awayCounts.set(awayTeam.id, (awayCounts.get(awayTeam.id) ?? 0) + 1);
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
        a.buffer - b.buffer || a.team.nonConfGames - b.team.nonConfGames
    );
    const { team, potential } = stats[0];
    teamsList = teamsList.filter(entry => entry.id !== team.id);

    const sortedPotential = potential.slice().sort((a, b) => {
      const aPotential = getNonConfPotential(a);
      const bPotential = getNonConfPotential(b);
      const aBuffer = getNonConfBuffer(a, aPotential);
      const bBuffer = getNonConfBuffer(b, bPotential);
      return aBuffer - bBuffer || a.nonConfGames - b.nonConfGames;
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
        awayCounts
      );
      scheduleGame(games, team, opponent, 0, homeTeam, awayTeam, null);
      scheduledOpponents.get(team.id)?.add(opponent.id);
      scheduledOpponents.get(opponent.id)?.add(team.id);
      homeCounts.set(homeTeam.id, (homeCounts.get(homeTeam.id) ?? 0) + 1);
      awayCounts.set(awayTeam.id, (awayCounts.get(awayTeam.id) ?? 0) + 1);
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
      const options = remainingGames.map(game => {
        const available = availableWeeksByGame.get(game) ?? new Set<number>();
        const isNonConf = !isConferenceGame(game.teamA, game.teamB);
        const nonConfPriority = isNonConf ? 0 : 1;
        return {
          game,
          available,
          key: [available.size, nonConfPriority, Math.random()],
        };
      });

      if (options.some(option => option.available.size === 0)) {
        failed = true;
        break;
      }

      options.sort((a, b) => {
        for (let i = 0; i < a.key.length; i += 1) {
          if (a.key[i] !== b.key[i]) {
            return a.key[i] - b.key[i];
          }
        }
        return 0;
      });

      const choice = options[0];
      const availableWeeks = Array.from(choice.available);
      if (!availableWeeks.length) {
        failed = true;
        break;
      }

      const week = isConferenceGame(choice.game.teamA, choice.game.teamB)
        ? availableWeeks.reduce((best, current) => {
            const bestLoad = weekLoad.get(best) ?? 0;
            const currentLoad = weekLoad.get(current) ?? 0;
            if (currentLoad < bestLoad) return current;
            if (currentLoad > bestLoad) return best;
            return current > best ? current : best;
          })
        : availableWeeks.reduce((best, current) => {
            const bestLoad = weekLoad.get(best) ?? 0;
            const currentLoad = weekLoad.get(current) ?? 0;
            if (currentLoad < bestLoad) return current;
            if (currentLoad > bestLoad) return best;
            return current < best ? current : best;
          });

      choice.game.weekPlayed = week;
      teamWeeks.get(choice.game.teamA.id)?.add(week);
      teamWeeks.get(choice.game.teamB.id)?.add(week);
      weekLoad.set(week, (weekLoad.get(week) ?? 0) + 1);

      const index = remainingGames.indexOf(choice.game);
      if (index >= 0) remainingGames.splice(index, 1);
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
    console.warn('Unable to assign weeks without conflicts after retries.');
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

export const listAvailableTeams = (
  schedule: ScheduleGame[],
  userTeam: Team,
  teams: Team[],
  week: number,
  existingGames: GameRecord[] = []
): string[] => {
  const weekIndex = week - 1;
  const weekSlot = schedule[weekIndex];
  if (!weekSlot || weekSlot.opponent) return [];

  const scheduledTeams = new Set<string>();
  schedule.forEach(slot => {
    if (slot.opponent) scheduledTeams.add(slot.opponent.name);
  });
  const teamIdsWithGame = new Set<number>();
  existingGames.forEach(game => {
    if (game.weekPlayed !== week) return;
    teamIdsWithGame.add(game.teamAId);
    teamIdsWithGame.add(game.teamBId);
  });

  return teams
    .filter(team => team.name !== userTeam.name)
    .filter(team => team.nonConfGames < team.nonConfLimit)
    .filter(team => !scheduledTeams.has(team.name))
    .filter(team => !teamIdsWithGame.has(team.id))
    .filter(team => team.conference !== userTeam.conference)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(team => team.name);
};

export const scheduleNonConGame = (
  schedule: ScheduleGame[],
  userTeam: Team,
  opponent: Team,
  week: number
) => {
  const weekIndex = week - 1;
  const slot = schedule[weekIndex];
  if (!slot || slot.opponent) return;

  slot.opponent = {
    name: opponent.name,
    rating: opponent.rating,
    ranking: opponent.ranking,
    record: opponent.record,
  };
  slot.label = userTeam.conference === opponent.conference
    ? `C (${userTeam.conference})`
    : opponent.conference
      ? `NC (${opponent.conference})`
      : 'NC (Ind)';
  slot.location = 'Home';
  slot.id = `${userTeam.name}-vs-${opponent.name}-week-${week}`;

  userTeam.nonConfGames += 1;
  opponent.nonConfGames += 1;
};
