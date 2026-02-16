import type { LeagueState } from '../../types/league';

type IdCounterKey = keyof NonNullable<LeagueState['idCounters']>;

export const normalizeCounters = (league: LeagueState) => {
  if (!league.idCounters) {
    league.idCounters = { game: 1, drive: 1, play: 1, gameLog: 1, player: 1 };
  }
  return league.idCounters;
};

export const nextId = (league: LeagueState, key: IdCounterKey) => {
  const counters = normalizeCounters(league);
  const value = counters[key] ?? 1;
  counters[key] = value + 1;
  return value;
};
