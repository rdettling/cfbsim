import type { Team } from '../../types/domain';
import type { PlayRecord, PlayerRecord } from '../../types/db';
import type { StartersCache } from '../../types/sim';

export const startingYardsLeft = (fieldPosition: number) => (
  fieldPosition >= 90 ? 100 - fieldPosition : 10
);

export const setPlayHeader = (play: PlayRecord, offense: Team, defense: Team) => {
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

export const weightedChoice = <T,>(items: Array<{ item: T; weight: number }>) => {
  const total = items.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)]?.item ?? null;
  let threshold = Math.random() * total;
  for (const entry of items) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry.item;
  }
  return items[items.length - 1]?.item ?? null;
};

export const chooseReceiver = (candidates: PlayerRecord[], ratingExponent = 4) => {
  if (!candidates.length) return null;
  const posBias: Record<string, number> = { wr: 1.4, te: 1.0, rb: 0.6 };
  const weighted = candidates.map(candidate => ({
    item: candidate,
    weight: (candidate.rating ** ratingExponent) * (posBias[candidate.pos.toLowerCase()] ?? 1),
  }));
  return weightedChoice(weighted);
};

export const formatPlayText = (
  play: PlayRecord,
  offense: Team,
  defense: Team,
  starters: StartersCache
) => {
  const rb = starters.byTeamPos.get(`${offense.id}:rb`) ?? [];
  const qb = starters.byTeamPos.get(`${offense.id}:qb`) ?? [];
  const wr = starters.byTeamPos.get(`${offense.id}:wr`) ?? [];
  const te = starters.byTeamPos.get(`${offense.id}:te`) ?? [];
  const k = starters.byTeamPos.get(`${offense.id}:k`) ?? [];
  const p = starters.byTeamPos.get(`${offense.id}:p`) ?? [];

  if (play.playType === 'run') {
    const runner = rb[Math.floor(Math.random() * rb.length)];
    if (!runner) {
      play.text = 'Run play';
      return;
    }
    if (play.result === 'fumble') {
      play.text = `${runner.first} ${runner.last} fumbled`;
    } else if (play.result === 'touchdown') {
      play.text = `${runner.first} ${runner.last} ran ${play.yardsGained} yards for a touchdown`;
    } else {
      play.text = `${runner.first} ${runner.last} ran for ${play.yardsGained} yards`;
    }
  } else if (play.playType === 'pass') {
    const qbStarter = qb[0];
    if (!qbStarter) {
      play.text = 'Pass play';
      return;
    }
    if (play.result === 'sack') {
      play.text = `${qbStarter.first} ${qbStarter.last} was sacked for a loss of ${Math.abs(play.yardsGained)} yards`;
    } else if (play.result === 'interception') {
      play.text = `${qbStarter.first} ${qbStarter.last}'s pass was intercepted`;
    } else if (play.result === 'incomplete pass') {
      play.text = `${qbStarter.first} ${qbStarter.last}'s pass was incomplete`;
    } else {
      const receiver = chooseReceiver([...wr, ...te, ...rb]);
      if (!receiver) {
        play.text = `${qbStarter.first} ${qbStarter.last} completed a pass for ${play.yardsGained} yards`;
      } else if (play.result === 'touchdown') {
        play.text = `${qbStarter.first} ${qbStarter.last} pass complete to ${receiver.first} ${receiver.last} for ${play.yardsGained} yards for a touchdown`;
      } else {
        play.text = `${qbStarter.first} ${qbStarter.last} pass complete to ${receiver.first} ${receiver.last} for ${play.yardsGained} yards`;
      }
    }
  } else if (play.playType === 'field goal') {
    const kicker = k[0];
    const distance = 100 - play.startingFP + 17;
    if (!kicker) {
      play.text = `Field goal attempt from ${distance} yards`;
      return;
    }
    if (play.result === 'made field goal') {
      play.text = `${kicker.first} ${kicker.last}'s ${distance} yard field goal is good`;
    } else {
      play.text = `${kicker.first} ${kicker.last}'s ${distance} yard field goal is no good`;
    }
  } else if (play.playType === 'punt') {
    const punter = p[0];
    play.text = punter ? `${punter.first} ${punter.last} punted` : 'Punt';
  }
};
