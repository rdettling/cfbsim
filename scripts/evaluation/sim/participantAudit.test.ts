import { describe, expect, it } from 'vitest';
import {
  buildTestPlayTiming,
  buildTestPlayer,
  buildTestTeam,
} from '../../../src/test/fixtures';
import type { PlayRecord } from '../../../src/types/db';
import type { SimGame } from '../../../src/types/sim';
import { emptyPlayParticipants, selectPlayParticipants } from '../../../src/domain/sim/participants';
import { formatPlayText } from '../../../src/domain/sim/plays';
import {
  buildStartersCacheFromPlayers,
  createGameLogsFromPlays,
} from '../../../src/domain/sim/statistics';
import { auditParticipantLinks } from './participantAudit';

describe('participant audit', () => {
  it('detects text and log corruption independently of production statistics tests', () => {
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
    const starters = buildStartersCacheFromPlayers(players);
    const play: PlayRecord = {
      id: 1,
      gameId: game.id,
      driveId: 1,
      offenseId: teamA.id,
      defenseId: teamB.id,
      startingFP: 40,
      down: 1,
      yardsLeft: 10,
      playType: 'run',
      yardsGained: 5,
      result: 'run',
      text: '',
      header: '',
      scoreA: 0,
      scoreB: 0,
      call: { kind: 'scrimmage', offense: 'inside_run', defense: 'base' },
      participants: emptyPlayParticipants(),
      timing: buildTestPlayTiming(),
    };
    play.participants = selectPlayParticipants(play, starters, teamA, teamB);
    formatPlayText(play, starters);
    const logs = createGameLogsFromPlays(game, [play], starters);

    expect(auditParticipantLinks(game, [play], logs, starters)).toEqual([]);
    const originalText = play.text;
    play.text = 'Anonymous run';
    expect(auditParticipantLinks(game, [play], logs, starters)).toContain(
      'Simulation produced participant text that does not match its role IDs.',
    );
    play.text = originalText;
    logs[0].rush_attempts += 1;
    expect(auditParticipantLinks(game, [play], logs, starters)).toContain(
      'Simulation produced player logs that do not match play participants.',
    );
  });
});
