import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { InteractiveDriveState, SimGame } from '../../types/sim';
import {
  buildGameSimStepInstruction,
  resolveGameSimDecisionPrompt,
} from './gameSimDecision';

const teamA = buildTestTeam({ id: 1, name: 'Alpha' });
const teamB = buildTestTeam({ id: 2, name: 'Beta' });

const buildGame = (overrides: Partial<SimGame> = {}) => ({
  id: 7,
  teamA,
  teamB,
  scoreA: 0,
  scoreB: 0,
  overtime: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  clockRunning: false,
  timeoutsRemainingA: 3,
  timeoutsRemainingB: 3,
  ...overrides,
}) as SimGame;

const buildDriveState = (
  overrides: Partial<InteractiveDriveState> = {},
): InteractiveDriveState => ({
  drive: {
    id: 7000,
    gameId: 7,
    driveNum: 0,
    offenseId: teamA.id,
    defenseId: teamB.id,
    startingFP: 25,
    result: '',
    points: 0,
    points_needed: 0,
    scoreAAfter: 0,
    scoreBAfter: 0,
  },
  phase: 'scrimmage',
  tryOrigin: null,
  tryTiming: null,
  fieldPosition: 42,
  down: 2,
  yardsLeft: 6,
  playCount: 1,
  ...overrides,
});

const buildPromptInput = (
  overrides: Partial<Parameters<typeof resolveGameSimDecisionPrompt>[0]> = {},
): Parameters<typeof resolveGameSimDecisionPrompt>[0] => ({
  driveState: buildDriveState(),
  userTeamId: teamA.id,
  currentOffense: teamA,
  currentDefense: teamB,
  simGame: buildGame(),
  inOvertime: false,
  overtimePossession: 0,
  simContext: {
    offense: teamA,
    defense: teamB,
    lead: 0,
  },
  ...overrides,
});

describe('game simulation decision policy', () => {
  it('resolves offensive scrimmage and fourth-down prompts', () => {
    expect(resolveGameSimDecisionPrompt(buildPromptInput())).toMatchObject({
      side: 'offense',
      type: 'scrimmage',
      down: 2,
      yardsLeft: 6,
      fieldPosition: 42,
    });
    expect(resolveGameSimDecisionPrompt(buildPromptInput({
      driveState: buildDriveState({ down: 4 }),
    }))).toMatchObject({ side: 'offense', type: 'fourth_down', down: 4 });
  });

  it('resolves defensive calls only when the offense is going for the play', () => {
    expect(resolveGameSimDecisionPrompt(buildPromptInput({
      userTeamId: teamB.id,
    }))).toMatchObject({ side: 'defense', type: 'scrimmage' });
    expect(resolveGameSimDecisionPrompt(buildPromptInput({
      userTeamId: teamB.id,
      driveState: buildDriveState({ down: 4, yardsLeft: 1, fieldPosition: 55 }),
    }))).toMatchObject({ side: 'defense', down: 4 });
    expect(resolveGameSimDecisionPrompt(buildPromptInput({
      userTeamId: teamB.id,
      driveState: buildDriveState({ down: 4, yardsLeft: 10, fieldPosition: 20 }),
    }))).toBeNull();
  });

  it('suppresses a defensive prompt for an automatic clock action', () => {
    const simGame = buildGame({
      quarter: 4,
      clockSecondsLeft: 20,
      clockRunning: true,
      timeoutsRemainingA: 0,
    });
    expect(resolveGameSimDecisionPrompt(buildPromptInput({
      userTeamId: teamB.id,
      simGame,
      simContext: {
        offense: teamA,
        defense: teamB,
        lead: 0,
      },
    }))).toBeNull();
  });

  it('resolves offensive and defensive try prompts', () => {
    expect(resolveGameSimDecisionPrompt(buildPromptInput({
      driveState: buildDriveState({ phase: 'try', tryOrigin: 'touchdown' }),
    }))).toMatchObject({ side: 'offense', type: 'try', allowExtraPoint: true });

    const overtimeGame = buildGame({ overtime: 3 });
    expect(resolveGameSimDecisionPrompt(buildPromptInput({
      userTeamId: teamB.id,
      driveState: buildDriveState({ phase: 'try', tryOrigin: 'overtime_shootout' }),
      simGame: overtimeGame,
      inOvertime: true,
      overtimePossession: 0,
      simContext: null,
    }))).toMatchObject({ side: 'defense', type: 'try', allowExtraPoint: false });
  });

  it('returns no prompt without a user-controlled side', () => {
    expect(resolveGameSimDecisionPrompt(buildPromptInput({ userTeamId: null }))).toBeNull();
  });
});

describe('game simulation step instructions', () => {
  const input = (
    overrides: Partial<Parameters<typeof buildGameSimStepInstruction>[0]> = {},
  ): Parameters<typeof buildGameSimStepInstruction>[0] => ({
    call: { kind: 'offense', concept: 'quick_pass' },
    drivePhase: 'scrimmage',
    userTeamId: teamA.id,
    offenseId: teamA.id,
    defenseId: teamB.id,
    selectedTempo: 'hurry_up',
    timeoutAfterPlay: true,
    useArmedTimeout: true,
    ...overrides,
  });

  it('applies the user offense tempo and armed timeout', () => {
    expect(buildGameSimStepInstruction(input())).toEqual({
      call: { kind: 'offense', concept: 'quick_pass' },
      tempo: 'hurry_up',
      timeoutAfter: { offense: 'use', defense: 'auto' },
    });
  });

  it('applies defensive timeout intent without changing offensive tempo', () => {
    expect(buildGameSimStepInstruction(input({ userTeamId: teamB.id }))).toEqual({
      call: { kind: 'offense', concept: 'quick_pass' },
      tempo: 'auto',
      timeoutAfter: { offense: 'auto', defense: 'use' },
    });
  });

  it('holds both timeout sides for tries and automatic advancement', () => {
    expect(buildGameSimStepInstruction(input({ drivePhase: 'try' }))).toMatchObject({
      tempo: 'auto',
      timeoutAfter: { offense: 'hold', defense: 'hold' },
    });
    expect(buildGameSimStepInstruction(input({
      userTeamId: null,
      selectedTempo: 'auto',
      timeoutAfterPlay: false,
    }))).toMatchObject({
      tempo: 'auto',
      timeoutAfter: { offense: 'auto', defense: 'auto' },
    });
    expect(buildGameSimStepInstruction(input({ useArmedTimeout: false }))).toMatchObject({
      tempo: 'hurry_up',
      timeoutAfter: { offense: 'hold', defense: 'auto' },
    });
  });
});
