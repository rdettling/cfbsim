import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTestPlayTiming, buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import type {
  PlayRecord,
  PlayerRecord,
  PlayResult,
  PlayType,
} from '../../types/db';
import { PARTICIPANT_ROLES, requiredParticipantRoles } from './participantRules';
import { validatePlayParticipants } from './participantValidation';
import { emptyPlayParticipants, selectPlayParticipants } from './participants';
import { formatPlayText } from './plays';
import { buildStartersCacheFromPlayers } from './statistics';
import { mapPlayRecord } from './ui';

const offense = buildTestTeam({ id: 1, name: 'Offense' });
const defense = buildTestTeam({ id: 2, name: 'Defense' });

const buildPlayers = () => {
  const definitions: Array<[number, number, string, string]> = [
    [1, 1, 'qb', 'Quarterback'],
    [2, 1, 'rb', 'Runner'],
    [3, 1, 'rb', 'Backup Runner'],
    [4, 1, 'wr', 'Receiver'],
    [5, 1, 'te', 'Tight End'],
    [6, 1, 'k', 'Kicker'],
    [7, 1, 'p', 'Punter'],
    [20, 2, 'dl', 'Lineman'],
    [21, 2, 'lb', 'Linebacker'],
    [22, 2, 'cb', 'Corner'],
    [23, 2, 's', 'Safety'],
  ];
  const players = definitions.map(([id, teamId, pos, last]) => buildTestPlayer({
    id,
    teamId,
    pos,
    first: teamId === 1 ? 'Offense' : 'Defense',
    last,
    starter: true,
    rating: 70 + id % 10,
  }));
  players.push(buildTestPlayer({
    id: 99,
    teamId: offense.id,
    pos: 'rb',
    first: 'Bench',
    last: 'Runner',
    starter: false,
    rating: 99,
  }));
  return players;
};

const buildPlay = (
  playType: PlayType,
  result: PlayResult,
  id = 1001,
): PlayRecord => ({
  id,
  gameId: 1,
  driveId: 1,
  offenseId: offense.id,
  defenseId: defense.id,
  startingFP: 40,
  down: playType === 'punt' || playType === 'field goal' ? 4 : 1,
  yardsLeft: 10,
  playType,
  yardsGained: result === 'touchdown' ? 60 : 5,
  result,
  text: '',
  header: '',
  scoreA: 0,
  scoreB: 0,
  call: playType === 'run'
    ? { kind: 'scrimmage', offense: 'inside_run', defense: 'base' }
    : playType === 'pass'
      ? { kind: 'scrimmage', offense: 'intermediate_pass', defense: 'base' }
      : { kind: 'special_teams', concept: playType === 'punt' ? 'punt' : 'field_goal' },
  participants: emptyPlayParticipants(),
  timing: buildTestPlayTiming(),
});

afterEach(() => vi.restoreAllMocks());

describe('participant-linked play resolution', () => {
  it.each([
    ['run', 'run'],
    ['run', 'touchdown'],
    ['run', 'fumble'],
    ['pass', 'pass'],
    ['pass', 'incomplete pass'],
    ['pass', 'sack'],
    ['pass', 'interception'],
    ['pass', 'touchdown'],
    ['field goal', 'made field goal'],
    ['punt', 'punt'],
  ] as const)('links and names every required role for %s / %s', (playType, result) => {
    const starters = buildStartersCacheFromPlayers(buildPlayers());
    const play = buildPlay(playType, result, 1000 + result.length);

    play.participants = selectPlayParticipants(play, starters, offense, defense);
    formatPlayText(play, starters);

    const required = requiredParticipantRoles(play);
    for (const role of PARTICIPANT_ROLES) {
      expect(play.participants[role] !== null).toBe(required.has(role));
      if (!required.has(role)) continue;
      const player = starters.byId.get(play.participants[role]!);
      expect(play.text).toContain(`${player?.first} ${player?.last}`);
    }
    expect(validatePlayParticipants(play, starters, offense, defense)).toEqual([]);
    expect(mapPlayRecord(play).participants).toEqual(play.participants);
    expect(mapPlayRecord(play).call).toEqual(play.call);
    expect(mapPlayRecord(play).timing).toEqual(play.timing);
  });

  it.each([
    ['option', 'run', 'run', 'rusherId', ['qb']],
    ['screen', 'pass', 'incomplete pass', 'targetId', ['rb']],
    ['deep_pass', 'pass', 'incomplete pass', 'targetId', ['wr', 'te']],
    ['play_action', 'pass', 'incomplete pass', 'targetId', ['wr', 'te']],
  ] as const)(
    'uses concept-specific participant eligibility for %s',
    (concept, playType, result, role, positions) => {
      const starters = buildStartersCacheFromPlayers(buildPlayers());
      const play = buildPlay(playType, result);
      play.call = { kind: 'scrimmage', offense: concept, defense: 'base' };

      play.participants = selectPlayParticipants(play, starters, offense, defense);
      formatPlayText(play, starters);

      const player = starters.byId.get(play.participants[role]!);
      expect(positions).toContain(player?.pos as never);
      expect(play.text.toLowerCase()).toContain(
        concept === 'play_action' ? 'play-action' : concept.split('_')[0],
      );
      expect(validatePlayParticipants(play, starters, offense, defense)).toEqual([]);
    },
  );

  it('is order-independent, starter-only, and does not consume Math.random', () => {
    const players = buildPlayers();
    const ordered = buildStartersCacheFromPlayers(players);
    const reversed = buildStartersCacheFromPlayers([...players].reverse());
    const random = vi.spyOn(Math, 'random');
    const first = buildPlay('run', 'run');
    const second = buildPlay('run', 'run');

    first.participants = selectPlayParticipants(first, ordered, offense, defense);
    second.participants = selectPlayParticipants(second, reversed, offense, defense);

    expect(second.participants).toEqual(first.participants);
    expect(first.participants.rusherId).not.toBe(99);
    expect(random).not.toHaveBeenCalled();
  });

  it.each([
    ['spike', 'passerId'],
    ['kneel', 'rusherId'],
  ] as const)('links only the quarterback for a %s', (action, role) => {
    const starters = buildStartersCacheFromPlayers(buildPlayers());
    const play = buildPlay(action === 'spike' ? 'pass' : 'run', action);
    play.call = { kind: 'clock_management', action };
    play.yardsGained = action === 'spike' ? 0 : -1;
    play.participants = selectPlayParticipants(play, starters, offense, defense);
    formatPlayText(play, starters);

    expect(starters.byId.get(play.participants[role]!)?.pos).toBe('qb');
    expect(requiredParticipantRoles(play)).toEqual(new Set([role]));
    expect(validatePlayParticipants(play, starters, offense, defense)).toEqual([]);
    expect(play.text).toContain('Offense Quarterback');
  });

  it.each([
    ['extra point', 'made extra point', { kind: 'try', attempt: 'extra_point' }, ['kickerId']],
    ['run', 'made two point run', {
      kind: 'try', attempt: 'two_point', offense: 'inside_run', defense: 'base',
    }, ['rusherId']],
    ['pass', 'failed two point incomplete', {
      kind: 'try', attempt: 'two_point', offense: 'quick_pass', defense: 'coverage',
    }, ['passerId', 'targetId']],
    ['pass', 'failed two point sack', {
      kind: 'try', attempt: 'two_point', offense: 'deep_pass', defense: 'pressure',
    }, ['passerId', 'sackerId']],
    ['pass', 'failed two point interception', {
      kind: 'try', attempt: 'two_point', offense: 'intermediate_pass', defense: 'coverage',
    }, ['passerId', 'targetId', 'interceptorId']],
  ] as const)('links and names an untimed %s / %s', (playType, result, call, roles) => {
    const starters = buildStartersCacheFromPlayers(buildPlayers());
    const play = buildPlay(playType, result);
    play.startingFP = 97;
    play.yardsLeft = 3;
    play.call = call;
    play.timing = { kind: 'try', context: 'overtime', period: 2 };
    play.participants = selectPlayParticipants(play, starters, offense, defense);
    formatPlayText(play, starters);

    expect([...requiredParticipantRoles(play)]).toEqual(roles);
    for (const role of roles) {
      const player = starters.byId.get(play.participants[role]!);
      expect(play.text).toContain(`${player?.first} ${player?.last}`);
    }
    expect(validatePlayParticipants(play, starters, offense, defense)).toEqual([]);
  });

  it('shifts defensive attribution by persisted intent', () => {
    const starters = buildStartersCacheFromPlayers(buildPlayers());
    let loadedFrontSeven = 0;
    let coverageFrontSeven = 0;
    for (let index = 0; index < 600; index += 1) {
      const loaded = buildPlay('run', 'run', 3000 + index);
      loaded.call = { kind: 'scrimmage', offense: 'inside_run', defense: 'loaded_box' };
      loaded.participants = selectPlayParticipants(loaded, starters, offense, defense);
      const loadedPos = starters.byId.get(loaded.participants.tacklerId!)?.pos;
      if (loadedPos === 'dl' || loadedPos === 'lb') loadedFrontSeven += 1;

      const coverage = buildPlay('run', 'run', 3000 + index);
      coverage.call = { kind: 'scrimmage', offense: 'inside_run', defense: 'coverage' };
      coverage.participants = selectPlayParticipants(coverage, starters, offense, defense);
      const coveragePos = starters.byId.get(coverage.participants.tacklerId!)?.pos;
      if (coveragePos === 'dl' || coveragePos === 'lb') coverageFrontSeven += 1;
    }

    expect(loadedFrontSeven).toBeGreaterThan(coverageFrontSeven);
  });

  it('uses ratings to weight participation without changing eligibility', () => {
    const weightedPlayers = buildPlayers().map(player => {
      if (player.id === 2) return { ...player, rating: 99 };
      if (player.id === 3) return { ...player, rating: 1 };
      return player;
    });
    const starters = buildStartersCacheFromPlayers(weightedPlayers);
    const counts = new Map<number, number>();
    for (let playId = 1; playId <= 500; playId += 1) {
      const play = buildPlay('run', 'touchdown', playId);
      const rusherId = selectPlayParticipants(play, starters, offense, defense).rusherId!;
      counts.set(rusherId, (counts.get(rusherId) ?? 0) + 1);
    }

    expect(counts.get(2)).toBeGreaterThan((counts.get(3) ?? 0) * 5);
  });

  it('names persisted out-of-bounds results in run and pass text', () => {
    const starters = buildStartersCacheFromPlayers(buildPlayers());
    for (const playType of ['run', 'pass'] as const) {
      const play = buildPlay(playType, playType);
      play.timing = buildTestPlayTiming({ outOfBounds: true });
      play.participants = selectPlayParticipants(play, starters, offense, defense);
      formatPlayText(play, starters);
      expect(play.text).toContain('out of bounds');
    }
  });

  it('throws when a required starter role has no candidate', () => {
    const players = buildPlayers().filter(player => player.pos !== 'p');
    const starters = buildStartersCacheFromPlayers(players);
    const play = buildPlay('punt', 'punt');

    expect(() => selectPlayParticipants(play, starters, offense, defense)).toThrow(
      'no eligible starter for punterId',
    );
  });

  it('reports dangling, non-starter, wrong-team, ineligible, and unexpected roles', () => {
    const players: PlayerRecord[] = buildPlayers();
    const starters = buildStartersCacheFromPlayers(players);
    const play = buildPlay('run', 'run');
    play.participants = selectPlayParticipants(play, starters, offense, defense);

    play.participants.rusherId = 99;
    expect(validatePlayParticipants(play, starters, offense, defense)).toContain(
      'non-starter rusherId',
    );
    play.participants.rusherId = 20;
    expect(validatePlayParticipants(play, starters, offense, defense)).toEqual(
      expect.arrayContaining(['wrong-team rusherId', 'ineligible-position rusherId']),
    );
    play.participants.rusherId = 999;
    play.participants.passerId = 1;
    expect(validatePlayParticipants(play, starters, offense, defense)).toEqual(
      expect.arrayContaining(['dangling rusherId', 'unexpected passerId']),
    );
  });
});
