import type { AwardMode } from '../../../types/awards';
import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import { getGameLogsByYear, getGamesByYear } from '../../../db/simRepo';
import { buildAwards } from '../awards';
import { sortAwardDisplayEntries } from '../utils/awardDisplay';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

export const loadAwards = async () => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const envelope = buildLeagueNavigationEnvelope(league);
  const mode: AwardMode | null = league.info.stage === 'season'
    ? 'live'
    : league.info.stage === 'summary'
      ? 'final'
      : null;

  if (mode === null) {
    return {
      ...envelope,
      mode,
      awards: [],
    };
  }

  const [gameLogs, games] = await Promise.all([
    getGameLogsByYear(league.info.currentYear),
    getGamesByYear(league.info.currentYear),
  ]);
  const calculated = buildAwards(league, players, games, gameLogs);

  return {
    ...envelope,
    mode,
    awards: sortAwardDisplayEntries(calculated[mode]),
  };
};
