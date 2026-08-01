import { describe, expect, it } from 'vitest';
import type { CustomConferencePlan } from '../types/domain';
import {
  buildHistoricalConferencePlan,
  resolveConferencePlan,
} from './conferencePlan';

const teams = [
  { name: 'Alpha', conference: 'East' },
  { name: 'Bravo', conference: 'East' },
  { name: 'Charlie', conference: 'West' },
  { name: 'Delta', conference: 'West' },
  { name: 'Echo', conference: 'West' },
  { name: 'Foxtrot', conference: 'West' },
];
const conferences = [
  { confName: 'East', confGames: 1 },
  { confName: 'West', confGames: 3 },
];

describe('conference plan resolution', () => {
  it('builds the historical alignment with automatic game settings', () => {
    expect(buildHistoricalConferencePlan(teams, conferences)).toEqual({
      assignments: {
        Alpha: 'East',
        Bravo: 'East',
        Charlie: 'West',
        Delta: 'West',
        Echo: 'West',
        Foxtrot: 'West',
      },
      conferenceGames: {
        East: { mode: 'automatic' },
        West: { mode: 'automatic' },
      },
    });
  });

  it('omits empty conferences and treats null assignments as Independent', () => {
    const plan: CustomConferencePlan = {
      assignments: Object.fromEntries(teams.map(team => [team.name, null])),
      conferenceGames: {
        East: { mode: 'automatic' },
        West: { mode: 'automatic' },
      },
    };
    const result = resolveConferencePlan(teams, conferences, plan);
    expect(result.activeConferences).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('rejects singleton conferences', () => {
    const plan = buildHistoricalConferencePlan(teams, conferences);
    plan.assignments.Bravo = 'West';
    const result = resolveConferencePlan(teams, conferences, plan);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'singleton_conference',
        conferenceName: 'East',
      }),
    );
  });

  it('rejects unknown assignments and incomplete plans', () => {
    const plan = buildHistoricalConferencePlan(teams, conferences);
    delete plan.assignments.Alpha;
    plan.assignments.Ghost = 'Elsewhere';
    delete plan.conferenceGames.West;
    const result = resolveConferencePlan(teams, conferences, plan);
    expect(result.issues.map(entry => entry.code)).toEqual(
      expect.arrayContaining([
        'missing_team',
        'unknown_team',
        'missing_game_setting',
      ]),
    );
  });

  it('keeps invalid manual targets blocking instead of correcting them', () => {
    const viableTeams = Array.from({ length: 13 }, (_, index) => ({
      name: `Team ${index + 1}`,
      conference: index < 6 ? 'East' : 'West',
    }));
    const viableConferences = [
      { confName: 'East', confGames: 5 },
      { confName: 'West', confGames: 6 },
    ];
    const plan = buildHistoricalConferencePlan(viableTeams, viableConferences);
    plan.conferenceGames.East = { mode: 'manual', target: 4 };
    const result = resolveConferencePlan(viableTeams, viableConferences, plan);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'invalid_game_target',
        conferenceName: 'East',
      }),
    );
    expect(result.conferenceGames.East).toBeUndefined();
  });
});
