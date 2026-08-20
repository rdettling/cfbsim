import type { GameLogRecord, PlayParticipants, PlayRecord } from '../../../src/types/db';
import type { SimGame, StartersCache } from '../../../src/types/sim';
import { PLAYER_SEASON_STAT_KEYS } from '../../../src/domain/league/gameDetails';
import { PARTICIPANT_ROLES, requiredParticipantRoles } from '../../../src/domain/sim/participantRules';
import { validatePlayParticipants } from '../../../src/domain/sim/participantValidation';

const zeroStats = (playerId: number, gameId: number): GameLogRecord => ({
  playerId,
  gameId,
  ...Object.fromEntries(PLAYER_SEASON_STAT_KEYS.map(key => [key, 0])),
}) as GameLogRecord;

const incrementExpectedStats = (
  play: PlayRecord,
  expected: Map<number, GameLogRecord>,
) => {
  const log = (role: keyof PlayParticipants) => {
    const playerId = play.participants[role];
    if (playerId === null) throw new Error(`Play ${play.id} is missing ${role}.`);
    const value = expected.get(playerId);
    if (!value) throw new Error(`Play ${play.id} has unlogged ${role} ${playerId}.`);
    return value;
  };
  const optionalLog = (role: keyof PlayParticipants) => {
    const playerId = play.participants[role];
    return playerId === null ? null : expected.get(playerId) ?? null;
  };

  if (play.call.kind === 'try') {
    if (play.call.attempt === 'extra_point') {
      const kicker = log('kickerId');
      kicker.extra_points_attempted += 1;
      if (play.result === 'made extra point') kicker.extra_points_made += 1;
    }
    return;
  }

  if (play.playType === 'run') {
    const runner = log('rusherId');
    runner.rush_attempts += 1;
    runner.rush_yards += play.yardsGained;
    if (play.result === 'touchdown') runner.rush_touchdowns += 1;
    if (play.result === 'fumble') runner.fumbles += 1;
    const tackler = optionalLog('tacklerId');
    if (tackler) tackler.tackles += 1;
    if (play.result === 'fumble') {
      log('forcedFumbleById').fumbles_forced += 1;
      log('fumbleRecoveryById').fumbles_recovered += 1;
    }
    return;
  }

  if (play.playType === 'pass') {
    const passer = log('passerId');
    passer.pass_attempts += 1;
    if (play.result === 'sack') log('sackerId').sacks += 1;
    else if (play.result === 'interception') {
      passer.pass_interceptions += 1;
      log('interceptorId').interceptions += 1;
    } else if (play.result === 'pass' || play.result === 'touchdown') {
      const target = log('targetId');
      passer.pass_completions += 1;
      passer.pass_yards += play.yardsGained;
      target.receiving_catches += 1;
      target.receiving_yards += play.yardsGained;
      if (play.result === 'touchdown') {
        passer.pass_touchdowns += 1;
        target.receiving_touchdowns += 1;
      }
      const tackler = optionalLog('tacklerId');
      if (tackler) tackler.tackles += 1;
    }
    return;
  }

  if (play.playType === 'field goal') {
    const kicker = log('kickerId');
    kicker.field_goals_attempted += 1;
    if (play.result === 'made field goal') kicker.field_goals_made += 1;
  }
};

export const auditParticipantLinks = (
  game: SimGame,
  plays: PlayRecord[],
  logs: GameLogRecord[],
  starters: StartersCache,
) => {
  const violations: string[] = [];
  const add = (message: string) => {
    if (!violations.includes(message)) violations.push(message);
  };
  const loggedPositions = new Set(['qb', 'rb', 'wr', 'te', 'k', 'p', 'dl', 'lb', 'cb', 's']);
  const expected = new Map(
    [...starters.byId.values()]
      .filter(player =>
        (player.teamId === game.teamA.id || player.teamId === game.teamB.id)
        && player.starter
        && loggedPositions.has(player.pos),
      )
      .map(player => [player.id, zeroStats(player.id, game.id)]),
  );

  for (const play of plays) {
    const offense = play.offenseId === game.teamA.id ? game.teamA : game.teamB;
    const defense = play.defenseId === game.teamA.id ? game.teamA : game.teamB;
    const roleErrors = validatePlayParticipants(play, starters, offense, defense);
    if (roleErrors.length) add('Simulation produced invalid participant roles.');
    const required = requiredParticipantRoles(play);
    for (const role of PARTICIPANT_ROLES) {
      if (!required.has(role)) continue;
      const playerId = play.participants[role];
      const player = playerId === null ? null : starters.byId.get(playerId);
      if (!player || !play.text.includes(`${player.first} ${player.last}`)) {
        add('Simulation produced participant text that does not match its role IDs.');
      }
    }
    try {
      incrementExpectedStats(play, expected);
    } catch {
      add('Simulation could not derive participant-linked player statistics.');
    }
  }

  const actual = new Map(logs.map(log => [log.playerId, log]));
  if (actual.size !== expected.size) add('Simulation produced an incoherent player-log roster.');
  for (const [playerId, expectedLog] of expected) {
    const actualLog = actual.get(playerId);
    if (
      !actualLog
      || PLAYER_SEASON_STAT_KEYS.some(key => actualLog[key] !== expectedLog[key])
    ) {
      add('Simulation produced player logs that do not match play participants.');
      break;
    }
  }
  return violations;
};
