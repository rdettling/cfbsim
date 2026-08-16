import type {
  Conference,
  ConferencePlanIssue,
  ConferencePlanValidationResult,
  CustomConferencePlan,
  PreviewData,
  ResolvedConferenceAlignment,
  Team,
} from '../types/domain';
import { getRivalriesData } from '../db/baseData';
import { buildTeamsAndConferences } from './baseData';
import {
  assertCompleteSchedule,
  fillUserSchedule,
} from './schedule/planner';
import {
  REGULAR_SEASON_GAMES,
  VALIDATION_SCHEDULE_SEED,
} from './schedule/constants';
import { isScheduleFailure } from './schedule/errors';
import { buildSchedule } from './schedule/projection';
import {
  buildAcceptedRivalryGames,
  resolveRivalries,
} from './rivalryScheduling';


const issue = (
  code: ConferencePlanIssue['code'],
  message: string,
  context: Pick<ConferencePlanIssue, 'conferenceName' | 'teamName'> = {},
): ConferencePlanIssue => ({ code, message, ...context });

export const buildHistoricalConferencePlan = (
  teams: Array<Pick<Team, 'name' | 'conference'>>,
  conferences: Array<Pick<Conference, 'confName' | 'confGames'>>,
): CustomConferencePlan => ({
  assignments: Object.fromEntries(
    teams.map(team => [
      team.name,
      team.conference === 'Independent' ? null : team.conference,
    ]),
  ),
  conferenceGames: Object.fromEntries(
    conferences
      .filter(conference => conference.confName !== 'Independent')
      .map(conference => [conference.confName, { mode: 'automatic' as const }]),
  ),
});

export const buildPreviewConferencePlan = (
  preview: PreviewData,
): CustomConferencePlan => ({
  assignments: Object.fromEntries(
    preview.teams.map(team => [team.name, team.conferenceName]),
  ),
  conferenceGames: Object.fromEntries(
    preview.conferences.map(conference => [
      conference.name,
      { mode: 'automatic' as const },
    ]),
  ),
});

export const resolvePreviewConferencePlan = (
  preview: PreviewData,
  plan: CustomConferencePlan,
) =>
  resolveConferencePlan(
    preview.teams,
    preview.conferences.map(conference => ({
      confName: conference.name,
      confGames: conference.games,
    })),
    plan,
  );

export const resolveConferencePlan = (
  teams: Array<Pick<Team, 'name'>>,
  conferences: Array<Pick<Conference, 'confName' | 'confGames'>>,
  plan: CustomConferencePlan,
): ResolvedConferenceAlignment => {
  const issues: ConferencePlanIssue[] = [];
  const teamNames = new Set(teams.map(team => team.name));
  const historicalGames = new Map(
    conferences
      .filter(conference => conference.confName !== 'Independent')
      .map(conference => [conference.confName, conference.confGames]),
  );
  const conferenceNames = new Set(historicalGames.keys());

  for (const teamName of teamNames) {
    if (!(teamName in plan.assignments)) {
      issues.push(
        issue('missing_team', `${teamName} must be assigned to a conference or Independents.`, {
          teamName,
        }),
      );
    }
  }
  for (const [teamName, conferenceName] of Object.entries(plan.assignments)) {
    if (!teamNames.has(teamName)) {
      issues.push(issue('unknown_team', `${teamName} is not available in this starting season.`, {
        teamName,
      }));
      continue;
    }
    if (conferenceName !== null && !conferenceNames.has(conferenceName)) {
      issues.push(
        issue(
          'unknown_conference',
          `${conferenceName} is not available in this starting season.`,
          { teamName, conferenceName },
        ),
      );
    }
  }
  for (const conferenceName of conferenceNames) {
    if (!(conferenceName in plan.conferenceGames)) {
      issues.push(
        issue(
          'missing_game_setting',
          `${conferenceName} needs a conference-game setting.`,
          { conferenceName },
        ),
      );
    }
  }
  for (const conferenceName of Object.keys(plan.conferenceGames)) {
    if (!conferenceNames.has(conferenceName)) {
      issues.push(
        issue(
          'unknown_game_setting',
          `${conferenceName} is not available in this starting season.`,
          { conferenceName },
        ),
      );
    }
  }

  const members = new Map<string, string[]>(
    Array.from(conferenceNames, conferenceName => [conferenceName, []]),
  );
  for (const team of teams) {
    const assignment = plan.assignments[team.name];
    if (typeof assignment === 'string' && members.has(assignment)) {
      members.get(assignment)?.push(team.name);
    }
  }

  const conferenceGames: Record<string, number> = {};
  const activeConferences: string[] = [];
  for (const conferenceName of conferenceNames) {
    const size = members.get(conferenceName)?.length ?? 0;
    if (size === 0) continue;
    activeConferences.push(conferenceName);
    if (size === 1) {
      issues.push(
        issue(
          'singleton_conference',
          `${conferenceName} must have at least two teams or be empty.`,
          { conferenceName, teamName: members.get(conferenceName)?.[0] },
        ),
      );
      continue;
    }

    const outsideOpponents = teams.length - size;
    const minimum = Math.max(1, REGULAR_SEASON_GAMES - outsideOpponents);
    const maximum = Math.min(REGULAR_SEASON_GAMES, size - 1);
    if (minimum > maximum) {
      issues.push(
        issue(
          'impossible_schedule',
          `${conferenceName} cannot provide 12 distinct opponents for each team.`,
          { conferenceName },
        ),
      );
      continue;
    }

    const setting = plan.conferenceGames[conferenceName];
    if (!setting) continue;
    const historical = historicalGames.get(conferenceName) ?? minimum;
    let target =
      setting.mode === 'automatic'
        ? Math.min(maximum, Math.max(minimum, historical))
        : setting.target;
    const reducedMinimum = Math.max(
      minimum,
      REGULAR_SEASON_GAMES + 1 - outsideOpponents,
    );
    if (
      setting.mode === 'automatic' &&
      (size * target) % 2 === 1 &&
      target < reducedMinimum &&
      target < maximum
    ) {
      target += 1;
    }

    if (
      Number.isInteger(target) &&
      target >= minimum &&
      target <= maximum &&
      (size * target) % 2 === 1 &&
      target < reducedMinimum
    ) {
      issues.push(
        issue(
          'invalid_game_target',
          `${conferenceName} needs at least ${reducedMinimum} conference games to balance every team to 12 total games.`,
          { conferenceName },
        ),
      );
      continue;
    }
    if (!Number.isInteger(target) || target < minimum || target > maximum) {
      issues.push(
        issue(
          'invalid_game_target',
          `${conferenceName} must use between ${minimum} and ${maximum} conference games.`,
          { conferenceName },
        ),
      );
      continue;
    }
    conferenceGames[conferenceName] = target;
  }

  activeConferences.sort((left, right) => left.localeCompare(right));
  return {
    assignments: Object.fromEntries(
      teams.map(team => [team.name, plan.assignments[team.name] ?? null]),
    ),
    conferenceGames,
    activeConferences,
    issues,
  };
};

export const applyResolvedConferenceAlignment = (
  teams: Team[],
  conferences: Conference[],
  resolved: ResolvedConferenceAlignment,
) => {
  if (resolved.issues.length) {
    throw new Error(resolved.issues[0].message);
  }

  const teamsByConference = new Map<string, Team[]>();
  for (const team of teams) {
    const assignment = resolved.assignments[team.name];
    const conferenceName = assignment ?? 'Independent';
    const conferenceGames = assignment
      ? resolved.conferenceGames[assignment]
      : 0;
    team.conference = conferenceName;
    team.confName = conferenceName;
    team.confLimit = conferenceGames;
    team.nonConfLimit = REGULAR_SEASON_GAMES - conferenceGames;
    const members = teamsByConference.get(conferenceName) ?? [];
    members.push(team);
    teamsByConference.set(conferenceName, members);
  }

  const rebuilt = conferences
    .filter(conference =>
      conference.confName === 'Independent'
        ? teamsByConference.has('Independent')
        : resolved.activeConferences.includes(conference.confName),
    )
    .map(conference => {
      const conferenceGames =
        conference.confName === 'Independent'
          ? 0
          : resolved.conferenceGames[conference.confName];
      return {
        ...conference,
        confGames: conferenceGames,
        championship: null,
        teams: teamsByConference.get(conference.confName) ?? [],
      };
    });

  if (teamsByConference.has('Independent') && !rebuilt.some(
    conference => conference.confName === 'Independent',
  )) {
    const nextId = conferences.reduce(
      (maximum, conference) => Math.max(maximum, conference.id),
      0,
    ) + 1;
    rebuilt.push({
      id: nextId,
      confName: 'Independent',
      confFullName: 'Independent',
      confGames: 0,
      info: '',
      championship: null,
      teams: teamsByConference.get('Independent') ?? [],
    });
  }

  conferences.splice(0, conferences.length, ...rebuilt);
};

export const validateNewLeagueConferencePlan = async (
  year: string,
  plan: CustomConferencePlan,
): Promise<ConferencePlanValidationResult> => {
  const [{ teams, conferences }, rivalries] = await Promise.all([
    buildTeamsAndConferences(year),
    getRivalriesData(),
  ]);
  const resolved = resolveConferencePlan(teams, conferences, plan);
  if (resolved.issues.length) {
    return { issues: resolved.issues, warnings: [] };
  }
  applyResolvedConferenceAlignment(teams, conferences, resolved);

  try {
    const rivalryResolution = resolveRivalries({
      teams,
      rivalries,
      existingGames: [],
      year: Number(year),
    });
    const games = fillUserSchedule(
      buildSchedule(),
      teams[0],
      teams,
      buildAcceptedRivalryGames(rivalryResolution, teams),
      {
        year: Number(year),
        seed: VALIDATION_SCHEDULE_SEED,
        requireComplete: true,
      },
    );
    assertCompleteSchedule(teams, games);
    return { issues: [], warnings: rivalryResolution.omitted };
  } catch (error) {
    if (!isScheduleFailure(error)) throw error;
    return {
      issues: [
        issue(
          'impossible_schedule',
          error instanceof Error
            ? error.message
            : 'The custom alignment cannot produce a complete schedule.',
        ),
      ],
      warnings: [],
    };
  }
};
