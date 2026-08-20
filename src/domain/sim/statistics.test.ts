import { describe, expect, it, vi } from 'vitest';
import { buildTestPlayTiming, buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import type { PlayRecord, PlayResult, PlayType } from '../../types/db';
import type { SimGame } from '../../types/sim';
import { emptyPlayParticipants, selectPlayParticipants } from './participants';
import { formatPlayText } from './plays';
import { buildStartersCacheFromPlayers, createGameLogsFromPlays } from './statistics';

const teamA = buildTestTeam({ id: 1, name: 'Alpha' });
const teamB = buildTestTeam({ id: 2, name: 'Beta' });

const players = [teamA, teamB].flatMap((team, teamIndex) =>
  ['qb', 'rb', 'wr', 'te', 'k', 'p', 'dl', 'lb', 'cb', 's'].map((pos, index) =>
    buildTestPlayer({
      id: teamIndex * 100 + index + 1,
      teamId: team.id,
      pos,
      first: team.name,
      last: pos.toUpperCase(),
      starter: true,
    }),
  ),
);

const game = { id: 5, teamA, teamB } as SimGame;

const linkedPlay = (
  id: number,
  playType: PlayType,
  result: PlayResult,
  yardsGained: number,
  starters: ReturnType<typeof buildStartersCacheFromPlayers>,
): PlayRecord => {
  const play: PlayRecord = {
    id,
    gameId: game.id,
    driveId: 1,
    offenseId: teamA.id,
    defenseId: teamB.id,
    startingFP: 40,
    down: playType === 'punt' || playType === 'field goal' ? 4 : 1,
    yardsLeft: 10,
    playType,
    yardsGained,
    result,
    text: '',
    header: '',
    scoreA: 0,
    scoreB: 0,
    call: result === 'spike'
      ? { kind: 'clock_management', action: 'spike' }
      : result === 'kneel'
        ? { kind: 'clock_management', action: 'kneel' }
        : playType === 'run'
      ? { kind: 'scrimmage', offense: 'inside_run', defense: 'base' }
      : playType === 'pass'
        ? { kind: 'scrimmage', offense: 'intermediate_pass', defense: 'base' }
        : { kind: 'special_teams', concept: playType === 'punt' ? 'punt' : 'field_goal' },
    participants: emptyPlayParticipants(),
    timing: buildTestPlayTiming(),
  };
  play.participants = selectPlayParticipants(play, starters, teamA, teamB);
  formatPlayText(play, starters);
  return play;
};

describe('participant-linked game logs', () => {
  it('folds persisted roles into coherent offensive, defensive, and kicking stats', () => {
    const starters = buildStartersCacheFromPlayers(players);
    const extraPoint = linkedPlay(12, 'field goal', 'made field goal', 0, starters);
    extraPoint.playType = 'extra point';
    extraPoint.result = 'made extra point';
    extraPoint.call = { kind: 'try', attempt: 'extra_point' };
    extraPoint.timing = { kind: 'try', context: 'regulation', quarter: 1, secondsLeft: 400 };
    extraPoint.participants = selectPlayParticipants(extraPoint, starters, teamA, teamB);
    formatPlayText(extraPoint, starters);
    const twoPoint = linkedPlay(13, 'pass', 'pass', 3, starters);
    twoPoint.startingFP = 97;
    twoPoint.yardsLeft = 3;
    twoPoint.result = 'made two point pass';
    twoPoint.call = {
      kind: 'try',
      attempt: 'two_point',
      offense: 'quick_pass',
      defense: 'base',
    };
    twoPoint.timing = { kind: 'try', context: 'regulation', quarter: 1, secondsLeft: 400 };
    twoPoint.participants = selectPlayParticipants(twoPoint, starters, teamA, teamB);
    formatPlayText(twoPoint, starters);
    const plays = [
      linkedPlay(1, 'run', 'run', 5, starters),
      linkedPlay(2, 'run', 'fumble', 0, starters),
      linkedPlay(3, 'pass', 'pass', 12, starters),
      linkedPlay(4, 'pass', 'touchdown', 20, starters),
      linkedPlay(5, 'pass', 'incomplete pass', 0, starters),
      linkedPlay(6, 'pass', 'sack', -7, starters),
      linkedPlay(7, 'pass', 'interception', 0, starters),
      linkedPlay(8, 'field goal', 'made field goal', 0, starters),
      linkedPlay(9, 'punt', 'punt', 0, starters),
      linkedPlay(10, 'pass', 'spike', 0, starters),
      linkedPlay(11, 'run', 'kneel', -1, starters),
      extraPoint,
      twoPoint,
    ];
    const random = vi.spyOn(Math, 'random');

    const logs = createGameLogsFromPlays(game, plays, starters);

    const total = (key: keyof (typeof logs)[number]) => logs.reduce(
      (sum, log) => sum + (typeof log[key] === 'number' ? log[key] : 0),
      0,
    );
    expect(total('pass_attempts')).toBe(6);
    expect(total('pass_completions')).toBe(2);
    expect(total('pass_yards')).toBe(32);
    expect(total('pass_touchdowns')).toBe(1);
    expect(total('pass_interceptions')).toBe(1);
    expect(total('rush_attempts')).toBe(3);
    expect(total('rush_yards')).toBe(4);
    expect(total('fumbles')).toBe(1);
    expect(total('receiving_catches')).toBe(2);
    expect(total('receiving_yards')).toBe(32);
    expect(total('receiving_touchdowns')).toBe(1);
    expect(total('tackles')).toBe(3);
    expect(total('sacks')).toBe(1);
    expect(total('interceptions')).toBe(1);
    expect(total('fumbles_forced')).toBe(1);
    expect(total('fumbles_recovered')).toBe(1);
    expect(total('field_goals_attempted')).toBe(1);
    expect(total('field_goals_made')).toBe(1);
    expect(total('extra_points_attempted')).toBe(1);
    expect(total('extra_points_made')).toBe(1);
    expect(logs.some(log => log.playerId === 6)).toBe(true);
    expect(random).not.toHaveBeenCalled();
  });
});
