import type { Team } from '../../types/domain';
import type { PlayParticipants, PlayRecord } from '../../types/db';
import type { StartersCache } from '../../types/sim';
import { CONCEPT_LABELS } from './concepts';

const PASS_PHRASES = {
  quick_pass: { indefinite: 'a quick pass', possessive: 'quick pass' },
  intermediate_pass: {
    indefinite: 'an intermediate pass',
    possessive: 'intermediate pass',
  },
  deep_pass: { indefinite: 'a deep pass', possessive: 'deep pass' },
  screen: { indefinite: 'a screen pass', possessive: 'screen pass' },
  play_action: {
    indefinite: 'a play-action pass',
    possessive: 'play-action pass',
  },
} as const;

export const startingYardsLeft = (fieldPosition: number) => (
  fieldPosition >= 90 ? 100 - fieldPosition : 10
);

export const setPlayHeader = (play: PlayRecord, offense: Team, defense: Team) => {
  if (play.call.kind === 'try') {
    play.header = play.call.attempt === 'extra_point' ? 'Extra Point' : 'Two-Point Try';
    return;
  }
  let location = '';
  if (play.startingFP < 50) {
    location = `${offense.abbreviation} ${play.startingFP}`;
  } else if (play.startingFP > 50) {
    location = `${defense.abbreviation} ${100 - play.startingFP}`;
  } else {
    location = `${play.startingFP}`;
  }

  const goalToGo = play.startingFP + play.yardsLeft >= 100;
  const downSuffix = play.down === 1 ? 'st' : play.down === 2 ? 'nd' : play.down === 3 ? 'rd' : 'th';
  if (goalToGo) {
    play.header = `${play.down}${downSuffix} and goal at ${location}`;
  } else {
    play.header = `${play.down}${downSuffix} and ${play.yardsLeft} at ${location}`;
  }
};

const participantName = (
  play: PlayRecord,
  starters: StartersCache,
  role: keyof PlayParticipants,
) => {
  const playerId = play.participants[role];
  if (playerId === null) throw new Error(`Play ${play.id} is missing ${role}.`);
  const player = starters.byId.get(playerId);
  if (!player) throw new Error(`Play ${play.id} references missing starter ${playerId}.`);
  return `${player.first} ${player.last}`;
};

export const formatPlayText = (
  play: PlayRecord,
  starters: StartersCache
) => {
  if (play.call.kind === 'try') {
    if (play.call.attempt === 'extra_point') {
      const kicker = participantName(play, starters, 'kickerId');
      play.text = play.result === 'made extra point'
        ? `${kicker}'s extra point is good`
        : `${kicker}'s extra point is no good`;
      return;
    }
    const concept = play.call.offense;
    if (play.playType === 'run') {
      const runner = participantName(play, starters, 'rusherId');
      const runPhrase = concept === 'option'
        ? 'kept the option'
        : concept === 'outside_run'
          ? 'ran outside'
          : 'ran inside';
      if (play.result === 'made two point run') {
        play.text = `${runner} ${runPhrase} for a successful two-point conversion`;
      } else if (play.result === 'failed two point fumble') {
        const forcer = participantName(play, starters, 'forcedFumbleById');
        const recovery = participantName(play, starters, 'fumbleRecoveryById');
        play.text = forcer === recovery
          ? `${runner} fumbled on the two-point try; ${forcer} forced and recovered it`
          : `${runner} fumbled on the two-point try; ${forcer} forced it and ${recovery} recovered`;
      } else {
        const tackler = participantName(play, starters, 'tacklerId');
        play.text = `${runner} ${runPhrase} but was stopped by ${tackler} on the two-point try`;
      }
      return;
    }
    const passer = participantName(play, starters, 'passerId');
    const phrase = PASS_PHRASES[concept as keyof typeof PASS_PHRASES];
    if (play.result === 'failed two point sack') {
      const sacker = participantName(play, starters, 'sackerId');
      play.text = `${passer} was sacked by ${sacker} on the two-point try`;
    } else if (play.result === 'failed two point interception') {
      const target = participantName(play, starters, 'targetId');
      const interceptor = participantName(play, starters, 'interceptorId');
      play.text = `${passer}'s two-point pass intended for ${target} was intercepted by ${interceptor}`;
    } else if (play.result === 'failed two point incomplete') {
      const target = participantName(play, starters, 'targetId');
      play.text = `${passer}'s two-point pass intended for ${target} was incomplete`;
    } else if (play.result === 'made two point pass') {
      const target = participantName(play, starters, 'targetId');
      play.text = `${passer} completed ${phrase.indefinite} to ${target} for a successful two-point conversion`;
    } else {
      const target = participantName(play, starters, 'targetId');
      const tackler = participantName(play, starters, 'tacklerId');
      play.text = `${passer} completed ${phrase.indefinite} to ${target}, but ${tackler} stopped the two-point try`;
    }
    return;
  }
  if (play.call.kind === 'clock_management') {
    if (play.call.action === 'spike') {
      const passer = participantName(play, starters, 'passerId');
      play.text = `${passer} spiked the ball to stop the clock`;
    } else {
      const rusher = participantName(play, starters, 'rusherId');
      play.text = `${rusher} took a knee for a loss of ${Math.abs(play.yardsGained)} yard`;
    }
  } else if (play.playType === 'run') {
    const runner = participantName(play, starters, 'rusherId');
    if (play.call.kind !== 'scrimmage') throw new Error(`Play ${play.id} has no run concept.`);
    const runPhrase = play.call.offense === 'option'
      ? 'kept the option'
      : play.call.offense === 'outside_run'
        ? 'ran outside'
        : 'ran inside';
    if (play.result === 'fumble') {
      const forcer = participantName(play, starters, 'forcedFumbleById');
      const recovery = participantName(play, starters, 'fumbleRecoveryById');
      play.text = forcer === recovery
        ? `${runner} ${runPhrase} and fumbled; ${forcer} forced and recovered the fumble`
        : `${runner} ${runPhrase} and fumbled; ${forcer} forced it and ${recovery} recovered`;
    } else if (play.result === 'touchdown') {
      play.text = `${runner} ${runPhrase} for ${play.yardsGained} yards and a touchdown`;
    } else {
      const tackler = participantName(play, starters, 'tacklerId');
      play.text = play.timing.kind !== 'try' && play.timing.outOfBounds
        ? `${runner} ${runPhrase} for ${play.yardsGained} yards and was forced out of bounds by ${tackler}`
        : `${runner} ${runPhrase} for ${play.yardsGained} yards, tackled by ${tackler}`;
    }
  } else if (play.playType === 'pass') {
    const passer = participantName(play, starters, 'passerId');
    if (play.call.kind !== 'scrimmage') throw new Error(`Play ${play.id} has no pass concept.`);
    const phrase = play.call.offense in PASS_PHRASES
      ? PASS_PHRASES[play.call.offense as keyof typeof PASS_PHRASES]
      : {
          indefinite: CONCEPT_LABELS[play.call.offense].toLowerCase(),
          possessive: CONCEPT_LABELS[play.call.offense].toLowerCase(),
        };
    if (play.result === 'sack') {
      const sacker = participantName(play, starters, 'sackerId');
      play.text = `${passer} was sacked by ${sacker} while attempting ${phrase.indefinite} for a loss of ${Math.abs(play.yardsGained)} yards`;
    } else if (play.result === 'interception') {
      const target = participantName(play, starters, 'targetId');
      const interceptor = participantName(play, starters, 'interceptorId');
      play.text = `${passer}'s ${phrase.possessive} intended for ${target} was intercepted by ${interceptor}`;
    } else if (play.result === 'incomplete pass') {
      const target = participantName(play, starters, 'targetId');
      play.text = `${passer}'s ${phrase.possessive} intended for ${target} was incomplete`;
    } else {
      const target = participantName(play, starters, 'targetId');
      if (play.result === 'touchdown') {
        play.text = `${passer} completed ${phrase.indefinite} to ${target} for ${play.yardsGained} yards and a touchdown`;
      } else {
        const tackler = participantName(play, starters, 'tacklerId');
        play.text = play.timing.kind !== 'try' && play.timing.outOfBounds
          ? `${passer} completed ${phrase.indefinite} to ${target} for ${play.yardsGained} yards; ${tackler} forced ${target} out of bounds`
          : `${passer} completed ${phrase.indefinite} to ${target} for ${play.yardsGained} yards, tackled by ${tackler}`;
      }
    }
  } else if (play.playType === 'field goal') {
    const kicker = participantName(play, starters, 'kickerId');
    const distance = 100 - play.startingFP + 17;
    if (play.result === 'made field goal') {
      play.text = `${kicker}'s ${distance} yard field goal is good`;
    } else {
      play.text = `${kicker}'s ${distance} yard field goal is no good`;
    }
  } else if (play.playType === 'punt') {
    const punter = participantName(play, starters, 'punterId');
    play.text = `${punter} punted`;
  }
};
