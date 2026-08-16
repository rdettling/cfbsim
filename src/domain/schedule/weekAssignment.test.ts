import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { Team } from '../../types/domain';
import type { FullGame } from '../../types/scheduleTypes';
import { SchedulePlanningError } from './errors';
import { assignRegularSeasonWeeks } from './weekAssignment';

const team = (id: number, conference: string) => buildTestTeam({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  conference,
  confName: conference,
});

const game = (teamA: Team, teamB: Team, weekPlayed = 0): FullGame => ({
  teamA,
  teamB,
  weekPlayed,
  homeTeam: teamA,
  awayTeam: teamB,
  venue: null,
  name: null,
  rivalryKey: null,
});

describe('regular-season week assignment', () => {
  it('preserves fixed weeks and prevents a team from playing twice in a week', () => {
    const teams = [
      team(1, 'East'),
      team(2, 'East'),
      team(3, 'West'),
      team(4, 'West'),
    ];
    const fixed = game(teams[0], teams[1], 1);
    const firstOpen = game(teams[0], teams[2]);
    const secondOpen = game(teams[0], teams[3]);

    assignRegularSeasonWeeks({
      games: [fixed, firstOpen, secondOpen],
      teams,
      year: 2025,
      seed: 100,
    });

    expect(fixed.weekPlayed).toBe(1);
    expect(new Set([fixed.weekPlayed, firstOpen.weekPlayed, secondOpen.weekPlayed]).size)
      .toBe(3);
  });

  it('keeps the existing early nonconference and late conference preference', () => {
    const teams = [
      team(1, 'East'),
      team(2, 'East'),
      team(3, 'West'),
      team(4, 'Other'),
    ];
    const conferenceGame = game(teams[0], teams[1]);
    const nonConferenceGame = game(teams[2], teams[3]);

    assignRegularSeasonWeeks({
      games: [conferenceGame, nonConferenceGame],
      teams,
      year: 2025,
      seed: 200,
    });

    expect(nonConferenceGame.weekPlayed).toBe(1);
    expect(conferenceGame.weekPlayed).toBe(14);
  });

  it('is deterministic for identical teams, games, year, and seed', () => {
    const build = () => {
      const teams = Array.from(
        { length: 6 },
        (_, index) => team(index + 1, index < 3 ? 'East' : 'West'),
      );
      return {
        teams,
        games: [
          game(teams[0], teams[1]),
          game(teams[1], teams[2]),
          game(teams[0], teams[3]),
          game(teams[3], teams[4]),
          game(teams[4], teams[5]),
        ],
      };
    };
    const first = build();
    const repeated = build();

    assignRegularSeasonWeeks({ ...first, year: 2025, seed: 300 });
    assignRegularSeasonWeeks({ ...repeated, year: 2025, seed: 300 });

    expect(repeated.games.map(entry => entry.weekPlayed))
      .toEqual(first.games.map(entry => entry.weekPlayed));
  });

  it('throws the scheduling domain error when no week is available', () => {
    const userTeam = team(1, 'East');
    const opponents = Array.from(
      { length: 15 },
      (_, index) => team(index + 2, 'West'),
    );
    const games = opponents.slice(0, 14).map((opponent, index) =>
      game(userTeam, opponent, index + 1)
    );
    games.push(game(userTeam, opponents[14]));

    expect(() => assignRegularSeasonWeeks({
      games,
      teams: [userTeam, ...opponents],
      year: 2025,
      seed: 400,
    })).toThrow(SchedulePlanningError);
  });
});
