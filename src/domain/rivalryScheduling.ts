import type {
  RivalryDefinition,
  RivalryConstraint,
  RivalryPlanWarning,
  RivalryResolution,
  Team,
} from '../types/domain';
import type { LeagueState } from '../types/league';
import type { FullGame, ScheduleConstraint } from '../types/scheduleTypes';
import {
  assertCompleteSchedule,
  fillUserSchedule,
  isScheduleFailure,
  VALIDATION_SCHEDULE_SEED,
} from './schedule/planner';
import { buildSchedule } from './schedule/projection';

export type RivalriesData = {
  rivalries: RivalryDefinition[];
};

export const rivalryKey = (teamA: string, teamB: string) =>
  [teamA, teamB].sort((left, right) => left.localeCompare(right)).join('::');

export const withoutDeclinedRivalries = (
  rivalries: RivalriesData,
  declinedRivalries: readonly string[],
): RivalriesData => {
  if (!declinedRivalries.length) return rivalries;
  const declined = new Set(declinedRivalries);
  return {
    rivalries: rivalries.rivalries.filter(
      rivalry => !declined.has(rivalryKey(rivalry.teamA, rivalry.teamB)),
    ),
  };
};

export const rivalryWarningKey = (warning: RivalryPlanWarning) =>
  `${warning.code}:${rivalryKey(warning.teamA, warning.teamB)}`;

export const opponentKey = (teamAId: number, teamBId: number) =>
  teamAId < teamBId
    ? `${teamAId}:${teamBId}`
    : `${teamBId}:${teamAId}`;

const isConferenceGame = (teamA: Team, teamB: Team) =>
  teamA.conference !== 'Independent' &&
  teamA.conference === teamB.conference;

const buildFullGame = (
  rivalry: RivalryConstraint,
  teamsById: Map<number, Team>,
  league?: Pick<LeagueState, 'info' | 'rivalryHostSeeds'>,
): FullGame => {
  const teamA = teamsById.get(rivalry.teamAId)!;
  const teamB = teamsById.get(rivalry.teamBId)!;
  if (rivalry.neutralSite) {
    return {
      teamA,
      teamB,
      weekPlayed: rivalry.week ?? 0,
      homeTeam: null,
      awayTeam: null,
      venue: rivalry.venue,
      name: rivalry.name,
    };
  }
  const seedHome = league?.rivalryHostSeeds[rivalry.key] ?? rivalry.teamA;
  const flipped = league
    ? Math.max(0, league.info.currentYear - league.info.startYear) % 2 === 1
    : false;
  const homeName = flipped
    ? seedHome === rivalry.teamA ? rivalry.teamB : rivalry.teamA
    : seedHome;
  return {
    teamA,
    teamB,
    weekPlayed: rivalry.week ?? 0,
    homeTeam: homeName === rivalry.teamA ? teamA : teamB,
    awayTeam: homeName === rivalry.teamA ? teamB : teamA,
    venue: null,
    name: rivalry.name,
  };
};

export const initializeRivalryHostSeeds = (
  league: Pick<LeagueState, 'teams' | 'rivalryHostSeeds'>,
  rivalries: RivalriesData,
  random: () => number = Math.random,
) => {
  const teamNames = new Set(league.teams.map(team => team.name));
  rivalries.rivalries.forEach(({ teamA, teamB, neutralSite }) => {
    if (neutralSite || !teamNames.has(teamA) || !teamNames.has(teamB)) return;
    const key = rivalryKey(teamA, teamB);
    if (!league.rivalryHostSeeds[key]) {
      league.rivalryHostSeeds[key] = random() < 0.5 ? teamA : teamB;
    }
  });
};

const canCompleteWith = (
  teams: Team[],
  existingGames: ScheduleConstraint[],
  accepted: RivalryConstraint[],
  year: number,
) => {
  const cloned = structuredClone(teams);
  const byId = new Map(cloned.map(team => [team.id, team]));
  const fixed: FullGame[] = existingGames.map(game => ({
    teamA: byId.get(game.teamAId)!,
    teamB: byId.get(game.teamBId)!,
    weekPlayed: game.weekPlayed,
    homeTeam: game.homeTeamId ? byId.get(game.homeTeamId)! : null,
    awayTeam: game.awayTeamId ? byId.get(game.awayTeamId)! : null,
    venue: null,
    name: game.name,
  }));
  fixed.push(...accepted.map(rivalry => buildFullGame(rivalry, byId)));
  try {
    const games = fillUserSchedule(
      buildSchedule(),
      cloned[0],
      cloned,
      fixed,
      {
        year,
        seed: VALIDATION_SCHEDULE_SEED,
        requireComplete: true,
      },
    );
    assertCompleteSchedule(cloned, games);
    return true;
  } catch (error) {
    if (isScheduleFailure(error)) return false;
    throw error;
  }
};

const omittedWarning = (rivalry: RivalryConstraint): RivalryPlanWarning => ({
  code: 'omitted_rivalry',
  teamA: rivalry.teamA,
  teamB: rivalry.teamB,
  name: rivalry.name,
  message: rivalry.week
    ? `${rivalry.teamA}–${rivalry.teamB} cannot be guaranteed in Week ${rivalry.week} with this alignment and will be omitted unless manually scheduled.`
    : `${rivalry.teamA}–${rivalry.teamB} cannot be guaranteed with this alignment and will be omitted unless manually scheduled.`,
});

export const resolveRivalries = ({
  teams,
  rivalries,
  existingGames,
  year,
}: {
  teams: Team[];
  rivalries: RivalriesData;
  existingGames: ScheduleConstraint[];
  year: number;
}): RivalryResolution => {
  const teamsByName = new Map(teams.map(team => [team.name, team]));
  const fulfilled = new Set(
    existingGames.map(game => opponentKey(game.teamAId, game.teamBId)),
  );
  const counts = new Map<number, { conference: number; nonConference: number }>(
    teams.map(team => [team.id, { conference: 0, nonConference: 0 }]),
  );
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const occupiedWeeks = new Map<number, Set<number>>(
    teams.map(team => [team.id, new Set<number>()]),
  );
  existingGames.forEach(game => {
    const teamA = teamsById.get(game.teamAId);
    const teamB = teamsById.get(game.teamBId);
    if (!teamA || !teamB) return;
    const category = isConferenceGame(teamA, teamB)
      ? 'conference'
      : 'nonConference';
    counts.get(teamA.id)![category] += 1;
    counts.get(teamB.id)![category] += 1;
    if (game.weekPlayed > 0) {
      occupiedWeeks.get(teamA.id)!.add(game.weekPlayed);
      occupiedWeeks.get(teamB.id)!.add(game.weekPlayed);
    }
  });

  const remaining = rivalries.rivalries.flatMap(
    ({ teamA: teamAName, teamB: teamBName, week, name, neutralSite, venue }) => {
      const teamA = teamsByName.get(teamAName);
      const teamB = teamsByName.get(teamBName);
      if (
        !teamA ||
        !teamB ||
        fulfilled.has(opponentKey(teamA.id, teamB.id))
      ) {
        return [];
      }
      return [{
        key: rivalryKey(teamAName, teamBName),
        teamAId: teamA.id,
        teamBId: teamB.id,
        teamA: teamAName,
        teamB: teamBName,
        name: name ?? null,
        neutralSite,
        venue,
        week,
      }];
    },
  );
  const accepted: RivalryConstraint[] = [];
  const omitted: RivalryPlanWarning[] = [];

  const capacity = (team: Team, opponent: Team) => {
    const category = isConferenceGame(team, opponent)
      ? 'conference'
      : 'nonConference';
    const limit = category === 'conference' ? team.confLimit : team.nonConfLimit;
    return limit - counts.get(team.id)![category];
  };

  while (remaining.length) {
    remaining.sort((left, right) => {
      const leftA = teamsByName.get(left.teamA)!;
      const leftB = teamsByName.get(left.teamB)!;
      const rightA = teamsByName.get(right.teamA)!;
      const rightB = teamsByName.get(right.teamB)!;
      return (
        Number(left.week === null) - Number(right.week === null) ||
        Math.min(capacity(leftA, leftB), capacity(leftB, leftA)) -
          Math.min(capacity(rightA, rightB), capacity(rightB, rightA)) ||
        left.key.localeCompare(right.key)
      );
    });
    const rivalry = remaining.shift()!;
    const teamA = teamsByName.get(rivalry.teamA)!;
    const teamB = teamsByName.get(rivalry.teamB)!;
    if (
      capacity(teamA, teamB) > 0 &&
      capacity(teamB, teamA) > 0 &&
      (
        rivalry.week === null ||
        (
          !occupiedWeeks.get(teamA.id)!.has(rivalry.week) &&
          !occupiedWeeks.get(teamB.id)!.has(rivalry.week)
        )
      )
    ) {
      accepted.push(rivalry);
      const category = isConferenceGame(teamA, teamB)
        ? 'conference'
        : 'nonConference';
      counts.get(teamA.id)![category] += 1;
      counts.get(teamB.id)![category] += 1;
      if (rivalry.week !== null) {
        occupiedWeeks.get(teamA.id)!.add(rivalry.week);
        occupiedWeeks.get(teamB.id)!.add(rivalry.week);
      }
    } else {
      omitted.push(omittedWarning(rivalry));
    }
  }
  let feasible = canCompleteWith(teams, existingGames, accepted, year);
  while (accepted.length && !feasible) {
    const rivalry = accepted.pop()!;
    omitted.push(omittedWarning(rivalry));
    feasible = canCompleteWith(teams, existingGames, accepted, year);
  }
  omitted.sort((left, right) =>
    rivalryKey(left.teamA, left.teamB).localeCompare(
      rivalryKey(right.teamA, right.teamB),
    ),
  );
  return { accepted, omitted, feasible };
};

export const buildAcceptedRivalryGames = (
  resolution: RivalryResolution,
  teams: Team[],
  league?: Pick<LeagueState, 'info' | 'rivalryHostSeeds'>,
) => {
  const byId = new Map(teams.map(team => [team.id, team]));
  return resolution.accepted.map(rivalry => buildFullGame(rivalry, byId, league));
};

export const resolveRivalrySite = (
  league: Pick<LeagueState, 'info' | 'rivalryHostSeeds'>,
  teamA: Team,
  teamB: Team,
  neutralSite: boolean,
  venue: string | null,
) => {
  if (neutralSite) {
    return { homeTeam: null, awayTeam: null, neutralSite: true, venue };
  }
  const key = rivalryKey(teamA.name, teamB.name);
  const seedHome = league.rivalryHostSeeds[key] ?? teamA.name;
  const flipped =
    Math.max(0, league.info.currentYear - league.info.startYear) % 2 === 1;
  const homeName = flipped
    ? seedHome === teamA.name ? teamB.name : teamA.name
    : seedHome;
  return {
    homeTeam: homeName === teamA.name ? teamA : teamB,
    awayTeam: homeName === teamA.name ? teamB : teamA,
    neutralSite: false,
    venue: null,
  };
};
