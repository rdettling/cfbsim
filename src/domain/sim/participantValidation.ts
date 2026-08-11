import type { PlayRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type { StartersCache } from '../../types/sim';
import {
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_RULES,
  participantPositionsForPlay,
  requiredParticipantRoles,
} from './participantRules';
import { validatePlayCall } from './concepts';

export const validatePlayParticipants = (
  play: PlayRecord,
  starters: StartersCache,
  offense: Team,
  defense: Team,
) => {
  const errors: string[] = [];
  errors.push(...validatePlayCall(play.call, play.down, play.playType));
  const required = requiredParticipantRoles(play);
  for (const role of PARTICIPANT_ROLES) {
    const playerId = play.participants[role];
    if (required.has(role) && playerId === null) {
      errors.push(`missing ${role}`);
      continue;
    }
    if (!required.has(role) && playerId !== null) {
      errors.push(`unexpected ${role}`);
      continue;
    }
    if (playerId === null) continue;
    const player = starters.byId.get(playerId);
    if (!player) {
      errors.push(`dangling ${role}`);
      continue;
    }
    if (!player.starter) errors.push(`non-starter ${role}`);
    const rule = PARTICIPANT_ROLE_RULES[role];
    const expectedTeamId = rule.side === 'offense' ? offense.id : defense.id;
    if (player.teamId !== expectedTeamId) errors.push(`wrong-team ${role}`);
    if (!participantPositionsForPlay(play.call, role).includes(player.pos)) {
      errors.push(`ineligible-position ${role}`);
    }
  }
  if (
    (play.result === 'fumble' || play.result === 'failed two point fumble')
    && play.participants.tacklerId !== play.participants.forcedFumbleById
  ) errors.push('fumble tackler and forcer differ');
  return errors;
};
