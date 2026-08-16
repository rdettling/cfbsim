import type { Team } from '../../types/domain';
import type { FullGame } from '../../types/scheduleTypes';
import { REGULAR_SEASON_WEEKS } from './constants';
import { stableNumber } from './determinism';
import { SchedulePlanningError } from './errors';
import { isConferenceGame } from './matchups';

const pickWeekByLoad = (
  candidateWeeks: number[],
  isConference: boolean,
  weekLoad: Map<number, number>,
) => candidateWeeks.reduce((best, current) => {
  const bestLoad = weekLoad.get(best) ?? 0;
  const currentLoad = weekLoad.get(current) ?? 0;
  if (currentLoad < bestLoad) return current;
  if (currentLoad > bestLoad) return best;
  if (isConference) return current > best ? current : best;
  return current < best ? current : best;
});

export const assignRegularSeasonWeeks = ({
  games,
  teams,
  year,
  seed,
}: {
  games: FullGame[];
  teams: Team[];
  year: number;
  seed: number;
}): FullGame[] => {
  const fixedGames = games.filter(game => game.weekPlayed > 0);
  const unassignedGames = games.filter(game => game.weekPlayed <= 0);
  const baseTeamWeeks = new Map<number, Set<number>>(
    teams.map(team => [team.id, new Set<number>()]),
  );
  const baseWeekLoad = new Map<number, number>();
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week += 1) {
    baseWeekLoad.set(week, 0);
  }
  fixedGames.forEach(game => {
    baseTeamWeeks.get(game.teamA.id)?.add(game.weekPlayed);
    baseTeamWeeks.get(game.teamB.id)?.add(game.weekPlayed);
    baseWeekLoad.set(game.weekPlayed, (baseWeekLoad.get(game.weekPlayed) ?? 0) + 1);
  });

  const weeks = Array.from(
    { length: REGULAR_SEASON_WEEKS },
    (_, index) => index + 1,
  );
  for (let attempt = 0; attempt < 50; attempt += 1) {
    unassignedGames.forEach(game => {
      game.weekPlayed = 0;
    });
    const teamWeeks = new Map<number, Set<number>>(
      Array.from(baseTeamWeeks.entries()).map(([teamId, occupied]) => [
        teamId,
        new Set(occupied),
      ]),
    );
    const weekLoad = new Map(baseWeekLoad);
    const remainingGames = unassignedGames.slice();
    const remainingSet = new Set(remainingGames);
    const gamesByTeam = new Map<number, FullGame[]>(
      teams.map(team => [team.id, []]),
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
        const nonConferencePriority = isConferenceGame(game.teamA, game.teamB)
          ? 1
          : 0;
        const option = {
          game,
          available,
          key: [
            available.size,
            nonConferencePriority,
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
            if (option.key[keyIndex] < choice.key[keyIndex]) choice = option;
            return;
          }
        }
      });

      if (!choice) {
        failed = true;
        break;
      }
      const candidateWeeks = Array.from(choice.available);
      if (!candidateWeeks.length) {
        failed = true;
        break;
      }
      const week = pickWeekByLoad(
        candidateWeeks,
        isConferenceGame(choice.game.teamA, choice.game.teamB),
        weekLoad,
      );

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

    if (!failed) return games;
  }

  throw new SchedulePlanningError(
    'Unable to assign every game to a conflict-free week.',
  );
};
