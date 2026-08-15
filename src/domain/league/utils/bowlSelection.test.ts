import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../test/fixtures';
import type { Team } from '../../../types/domain';
import { buildBowlMatchups, isBowlName, isNy6Bowl } from './bowlSelection';

const buildTeams = (count: number): Team[] =>
  Array.from({ length: count }, (_, index) => buildTestTeam({
    id: index + 1,
    name: `Team ${index + 1}`,
    ranking: index + 1,
    conference: 'Independent',
    confName: 'Independent',
    totalWins: 8,
    totalLosses: 4,
  }));

const buildForFormat = (playoffTeams: 2 | 4 | 12) => buildBowlMatchups({
  teams: buildTeams(50),
  playoffTeamIds: new Set(),
  year: 2025,
  playoffTeams,
  requireEligibility: true,
});

describe('bowl selection policy', () => {
  it('classifies known bowls and NY6 bowls case-insensitively', () => {
    expect(isBowlName('rose bowl')).toBe(true);
    expect(isBowlName('ReliaQuest Bowl')).toBe(true);
    expect(isBowlName('Unknown Bowl')).toBe(false);
    expect(isBowlName(null)).toBe(false);
    expect(isNy6Bowl('ROSE BOWL')).toBe(true);
    expect(isNy6Bowl('ReliaQuest Bowl')).toBe(false);
  });

  it('makes all NY6 bowls available for the two-team format', () => {
    const ny6Names = buildForFormat(2).filter(matchup => isNy6Bowl(matchup.name));

    expect(ny6Names.map(matchup => matchup.name)).toEqual([
      'Rose Bowl',
      'Sugar Bowl',
      'Orange Bowl',
      'Cotton Bowl',
      'Fiesta Bowl',
      'Peach Bowl',
    ]);
  });

  it('removes the rotating semifinal bowls from the four-team format', () => {
    const ny6Names = buildForFormat(4).filter(matchup => isNy6Bowl(matchup.name));

    expect(ny6Names.map(matchup => matchup.name)).toEqual([
      'Orange Bowl',
      'Cotton Bowl',
      'Fiesta Bowl',
      'Peach Bowl',
    ]);
  });

  it('reserves every NY6 bowl for the twelve-team playoff', () => {
    expect(buildForFormat(12).some(matchup => isNy6Bowl(matchup.name))).toBe(false);
  });

  it('applies eligibility only when requested', () => {
    const teams = buildTeams(2);
    teams[1].totalWins = 5;
    const build = (requireEligibility: boolean) => buildBowlMatchups({
      teams,
      playoffTeamIds: new Set(),
      year: 2024,
      playoffTeams: 2,
      requireEligibility,
    });

    expect(build(true)).toHaveLength(0);
    expect(build(false)[0]).toMatchObject({
      name: 'Rose Bowl',
      teamA: { id: 1 },
      teamB: { id: 2 },
    });
  });

  it('honors conference tie-ins before filling from the at-large pool', () => {
    const teams = buildTeams(4);
    teams[2] = buildTestTeam({
      id: 3,
      name: 'Big Ten Team',
      ranking: 30,
      conference: 'Big Ten',
      confName: 'Big Ten',
      totalWins: 8,
    });
    teams[3] = buildTestTeam({
      id: 4,
      name: 'Pac-12 Team',
      ranking: 40,
      conference: 'Pac-12',
      confName: 'Pac-12',
      totalWins: 8,
    });

    const roseBowl = buildBowlMatchups({
      teams,
      playoffTeamIds: new Set(),
      year: 2024,
      playoffTeams: 4,
      requireEligibility: true,
    }).find(matchup => matchup.name === 'Rose Bowl');

    expect(roseBowl?.teamA.name).toBe('Big Ten Team');
    expect(roseBowl?.teamB.name).toBe('Pac-12 Team');
  });

  it('never assigns a team to more than one bowl', () => {
    const matchups = buildForFormat(2);
    const teamIds = matchups.flatMap(matchup => [matchup.teamA.id, matchup.teamB.id]);

    expect(new Set(teamIds).size).toBe(teamIds.length);
  });
});
