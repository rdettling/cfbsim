import { describe, expect, it } from 'vitest';
import type { AwardStatLineStats } from './awardStatLine';
import { formatAwardStatLine } from './awardStatLine';

const emptyStats = (overrides: Partial<AwardStatLineStats> = {}): AwardStatLineStats => ({
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 0,
  rush_attempts: 0,
  rush_touchdowns: 0,
  receiving_yards: 0,
  receiving_catches: 0,
  receiving_touchdowns: 0,
  fumbles: 0,
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  fumbles_forced: 0,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
  ...overrides,
});

describe('formatAwardStatLine', () => {
  it('includes passing turnovers and a passer\'s rushing production', () => {
    expect(formatAwardStatLine(emptyStats({
      pass_completions: 301,
      pass_attempts: 450,
      pass_yards: 3_623,
      pass_touchdowns: 33,
      pass_interceptions: 7,
      rush_attempts: 84,
      rush_yards: 512,
      rush_touchdowns: 6,
      fumbles: 2,
    }))).toBe(
      '301/450, 3623 pass yds, 33 pass TD, 7 INT · 84 carries, 512 rush yds, 6 rush TD · 2 FUM',
    );
  });

  it('includes complete receiving, defensive, and kicking production', () => {
    expect(formatAwardStatLine(emptyStats({
      receiving_catches: 72,
      receiving_yards: 1_104,
      receiving_touchdowns: 10,
      tackles: 4,
      fumbles_forced: 1,
      field_goals_made: 18,
      field_goals_attempted: 21,
      extra_points_made: 42,
      extra_points_attempted: 43,
    }))).toBe(
      '72 catches, 1104 rec yds, 10 rec TD · 4 tackles, 0 sacks, 0 INT, 1 FF, 0 FR · 18/21 FG, 42/43 XP',
    );
  });

  it('handles players without recorded production', () => {
    expect(formatAwardStatLine(emptyStats())).toBe('No stats yet');
  });
});
