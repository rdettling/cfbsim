import type { PlayParticipants, PlayRecord, PlayerRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type { StartersCache } from '../../types/sim';
import { createSeededRandom } from '../utils/random';
import { isPassConcept } from './concepts';
import { validatePlayParticipants } from './participantValidation';

export const emptyPlayParticipants = (): PlayParticipants => ({
  passerId: null,
  rusherId: null,
  targetId: null,
  tacklerId: null,
  sackerId: null,
  interceptorId: null,
  forcedFumbleById: null,
  fumbleRecoveryById: null,
  kickerId: null,
  punterId: null,
});

const playersAt = (starters: StartersCache, team: Team, positions: string[]) =>
  positions
    .flatMap(position => starters.byTeamPos.get(`${team.id}:${position}`) ?? [])
    .sort((left, right) => left.id - right.id);

const selectRequired = (
  playId: number,
  role: keyof PlayParticipants,
  players: PlayerRecord[],
  positionBias: Record<string, number> = {},
  ratingExponent = 1,
  ratingOffset = 5,
) => {
  if (!players.length) {
    throw new Error(`Play ${playId} has no eligible starter for ${role}.`);
  }
  const random = createSeededRandom(playId).fork(role);
  const selected = random.weightedChoice(players.map(player => ({
    item: player,
    weight: ((Math.max(player.rating, 0) + ratingOffset) ** ratingExponent)
      * (positionBias[player.pos.toLowerCase()] ?? 1),
  })));
  if (!selected) throw new Error(`Play ${playId} could not select ${role}.`);
  return selected.id;
};

const selectOffensiveStarter = (
  play: PlayRecord,
  role: keyof PlayParticipants,
  starters: StartersCache,
  offense: Team,
  positions: string[],
  bias: Record<string, number> = {},
  ratingExponent = 1,
  ratingOffset = 5,
) => selectRequired(
  play.id,
  role,
  playersAt(starters, offense, positions),
  bias,
  ratingExponent,
  ratingOffset,
);

const selectDefender = (
  play: PlayRecord,
  role: keyof PlayParticipants,
  starters: StartersCache,
  defense: Team,
  bias: Record<string, number>,
) => selectRequired(
  play.id,
  role,
  playersAt(starters, defense, ['dl', 'lb', 'cb', 's']),
  bias,
);

const TACKLER_BIAS = { dl: 1.2, lb: 1.1, cb: 0.8, s: 0.9 };
const SACKER_BIAS = { dl: 1.4, lb: 1.1 };
const INTERCEPTOR_BIAS = { cb: 1.3, s: 1.3, lb: 0.8 };
const DEFENSIVE_BIASES = {
  loaded_box: {
    tackle: { dl: 1.5, lb: 1.4, cb: 0.6, s: 0.65 },
    sack: { dl: 1.45, lb: 1.2, cb: 0.7, s: 0.6 },
    interception: { cb: 1.2, s: 1.2, lb: 0.9, dl: 0.5 },
  },
  coverage: {
    tackle: { dl: 0.75, lb: 0.85, cb: 1.2, s: 1.25 },
    sack: { dl: 1.2, lb: 1, cb: 0.8, s: 0.7 },
    interception: { cb: 1.5, s: 1.5, lb: 0.6, dl: 0.25 },
  },
  pressure: {
    tackle: { dl: 1.35, lb: 1.25, cb: 0.75, s: 0.7 },
    sack: { dl: 1.6, lb: 1.4, cb: 0.35, s: 0.3 },
    interception: { cb: 1.3, s: 1.2, lb: 0.85, dl: 0.4 },
  },
} as const;

const defensiveBias = (
  play: PlayRecord,
  role: 'tackle' | 'sack' | 'interception',
  fallback: Record<string, number>,
) => {
  const intent = play.call.kind === 'scrimmage'
    ? play.call.defense
    : play.call.kind === 'try' && play.call.attempt === 'two_point'
      ? play.call.defense
      : 'base';
  return intent !== 'base' ? DEFENSIVE_BIASES[intent][role] : fallback;
};
const TARGET_PROFILES = {
  quick_pass: {
    positions: ['wr', 'te', 'rb'],
    bias: { wr: 1.1, te: 1.25, rb: 1.1 },
  },
  intermediate_pass: {
    positions: ['wr', 'te', 'rb'],
    bias: { wr: 1.4, te: 1, rb: 0.6 },
  },
  deep_pass: { positions: ['wr', 'te'], bias: { wr: 1.8, te: 0.8 } },
  screen: { positions: ['rb'], bias: { rb: 1 } },
  play_action: { positions: ['wr', 'te'], bias: { wr: 1.1, te: 1.5 } },
} as const;

export const selectPlayParticipants = (
  play: PlayRecord,
  starters: StartersCache,
  offense: Team,
  defense: Team,
): PlayParticipants => {
  const participants = emptyPlayParticipants();
  const finish = () => {
    play.participants = participants;
    const errors = validatePlayParticipants(play, starters, offense, defense);
    if (errors.length) {
      throw new Error(`Play ${play.id} has invalid participants: ${errors.join(', ')}.`);
    }
    return participants;
  };

  if (play.call.kind === 'clock_management') {
    if (play.call.action === 'spike') {
      participants.passerId = selectOffensiveStarter(
        play,
        'passerId',
        starters,
        offense,
        ['qb'],
      );
    } else {
      participants.rusherId = selectOffensiveStarter(
        play,
        'rusherId',
        starters,
        offense,
        ['qb'],
      );
    }
    return finish();
  }

  if (play.call.kind === 'try' && play.call.attempt === 'extra_point') {
    participants.kickerId = selectOffensiveStarter(
      play,
      'kickerId',
      starters,
      offense,
      ['k'],
    );
    return finish();
  }

  if (play.playType === 'run') {
    participants.rusherId = selectOffensiveStarter(
      play,
      'rusherId',
      starters,
      offense,
      (play.call.kind === 'scrimmage'
        || (play.call.kind === 'try' && play.call.attempt === 'two_point'))
        && play.call.offense === 'option' ? ['qb'] : ['rb'],
      (play.call.kind === 'scrimmage'
        || (play.call.kind === 'try' && play.call.attempt === 'two_point'))
        && play.call.offense === 'option'
        ? { qb: 1 }
        : { rb: 1.2 },
    );
    if (play.result !== 'touchdown'
      && play.result !== 'made two point run') {
      participants.tacklerId = selectDefender(
        play,
        'tacklerId',
        starters,
        defense,
        defensiveBias(play, 'tackle', TACKLER_BIAS),
      );
    }
    if (play.result === 'fumble' || play.result === 'failed two point fumble') {
      participants.forcedFumbleById = participants.tacklerId;
      participants.fumbleRecoveryById = selectDefender(
        play,
        'fumbleRecoveryById',
        starters,
        defense,
        defensiveBias(play, 'tackle', TACKLER_BIAS),
      );
    }
    return finish();
  }

  if (play.playType === 'pass') {
    participants.passerId = selectOffensiveStarter(
      play,
      'passerId',
      starters,
      offense,
      ['qb'],
    );
    if (play.result === 'sack' || play.result === 'failed two point sack') {
      participants.sackerId = selectDefender(
        play,
        'sackerId',
        starters,
        defense,
        defensiveBias(play, 'sack', SACKER_BIAS),
      );
      return finish();
    }
    if ((play.call.kind !== 'scrimmage'
      && !(play.call.kind === 'try' && play.call.attempt === 'two_point'))
      || !isPassConcept(play.call.offense)) {
      throw new Error(`Play ${play.id} has no passing concept.`);
    }
    const targetProfile = TARGET_PROFILES[play.call.offense];
    participants.targetId = selectOffensiveStarter(
      play,
      'targetId',
      starters,
      offense,
      [...targetProfile.positions],
      targetProfile.bias,
      4,
      0,
    );
    if (play.result === 'interception' || play.result === 'failed two point interception') {
      participants.interceptorId = selectDefender(
        play,
        'interceptorId',
        starters,
        defense,
        defensiveBias(play, 'interception', INTERCEPTOR_BIAS),
      );
    } else if (play.result === 'pass' || play.result === 'failed two point pass') {
      participants.tacklerId = selectDefender(
        play,
        'tacklerId',
        starters,
        defense,
        defensiveBias(play, 'tackle', TACKLER_BIAS),
      );
    }
    return finish();
  }

  if (play.playType === 'field goal') {
    participants.kickerId = selectOffensiveStarter(
      play,
      'kickerId',
      starters,
      offense,
      ['k'],
    );
    return finish();
  }

  if (play.playType === 'punt') {
    participants.punterId = selectOffensiveStarter(
      play,
      'punterId',
      starters,
      offense,
      ['p'],
    );
    return finish();
  }

  throw new Error(`Play ${play.id} has unsupported play type ${play.playType}.`);
};
