import type { LeagueState } from '../../types/league';

type IdCounterKey = keyof LeagueState['idCounters'];

export const nextId = (league: LeagueState, key: IdCounterKey) => {
  const value = league.idCounters[key];
  league.idCounters[key] = value + 1;
  return value;
};
