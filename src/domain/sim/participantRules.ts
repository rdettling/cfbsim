import type { PlayCall, PlayParticipants } from '../../types/db';

export type ParticipantRole = keyof PlayParticipants;

export const PARTICIPANT_ROLES: ParticipantRole[] = [
  'passerId',
  'rusherId',
  'targetId',
  'tacklerId',
  'sackerId',
  'interceptorId',
  'forcedFumbleById',
  'fumbleRecoveryById',
  'kickerId',
  'punterId',
];

export const PARTICIPANT_ROLE_RULES: Record<
  ParticipantRole,
  { side: 'offense' | 'defense'; positions: string[] }
> = {
  passerId: { side: 'offense', positions: ['qb'] },
  rusherId: { side: 'offense', positions: ['rb', 'qb'] },
  targetId: { side: 'offense', positions: ['wr', 'te', 'rb'] },
  tacklerId: { side: 'defense', positions: ['dl', 'lb', 'cb', 's'] },
  sackerId: { side: 'defense', positions: ['dl', 'lb', 'cb', 's'] },
  interceptorId: { side: 'defense', positions: ['dl', 'lb', 'cb', 's'] },
  forcedFumbleById: { side: 'defense', positions: ['dl', 'lb', 'cb', 's'] },
  fumbleRecoveryById: { side: 'defense', positions: ['dl', 'lb', 'cb', 's'] },
  kickerId: { side: 'offense', positions: ['k'] },
  punterId: { side: 'offense', positions: ['p'] },
};

export const participantPositionsForPlay = (
  call: PlayCall,
  role: ParticipantRole,
) => {
  if (role === 'rusherId' && call.kind === 'scrimmage') {
    return call.offense === 'option' ? ['qb'] : ['rb'];
  }
  if (role === 'rusherId' && call.kind === 'try' && call.attempt === 'two_point') {
    return call.offense === 'option' ? ['qb'] : ['rb'];
  }
  if (call.kind === 'clock_management'
    && (role === 'passerId' || role === 'rusherId')) return ['qb'];
  if (role === 'targetId'
    && (call.kind === 'scrimmage' || (call.kind === 'try' && call.attempt === 'two_point'))) {
    if (call.offense === 'screen') return ['rb'];
    if (call.offense === 'deep_pass' || call.offense === 'play_action') {
      return ['wr', 'te'];
    }
  }
  return PARTICIPANT_ROLE_RULES[role].positions;
};

export const requiredParticipantRoles = (
  play: Pick<import('../../types/db').PlayRecord, 'playType' | 'result' | 'call'>,
): Set<ParticipantRole> => {
  const { playType, result } = play;
  if (play.call.kind === 'clock_management') {
    return new Set(play.call.action === 'spike' ? ['passerId'] : ['rusherId']);
  }
  if (play.call.kind === 'try') {
    if (play.call.attempt === 'extra_point') return new Set(['kickerId']);
    if (playType === 'run') {
      const roles: ParticipantRole[] = ['rusherId'];
      if (result === 'failed two point run' || result === 'failed two point fumble') {
        roles.push('tacklerId');
      }
      if (result === 'failed two point fumble') {
        roles.push('forcedFumbleById', 'fumbleRecoveryById');
      }
      return new Set(roles);
    }
    const roles: ParticipantRole[] = ['passerId'];
    if (result === 'failed two point sack') roles.push('sackerId');
    else roles.push('targetId');
    if (result === 'failed two point interception') roles.push('interceptorId');
    if (result === 'failed two point pass') roles.push('tacklerId');
    return new Set(roles);
  }
  if (playType === 'run') {
    const roles: ParticipantRole[] = ['rusherId'];
    if (result !== 'touchdown') roles.push('tacklerId');
    if (result === 'fumble') {
      roles.push('forcedFumbleById', 'fumbleRecoveryById');
    }
    return new Set(roles);
  }
  if (playType === 'pass') {
    const roles: ParticipantRole[] = ['passerId'];
    if (result === 'sack') roles.push('sackerId');
    else roles.push('targetId');
    if (result === 'interception') roles.push('interceptorId');
    if (result === 'pass') roles.push('tacklerId');
    return new Set(roles);
  }
  if (playType === 'field goal') return new Set(['kickerId']);
  if (playType === 'punt') return new Set(['punterId']);
  return new Set();
};
