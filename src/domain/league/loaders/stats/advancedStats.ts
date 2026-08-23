import { loadLeagueOrThrow } from '../../leagueStore';
import { getAllGames, getGameDetailsByYear } from '../../../../db/simRepo';
import type { AdvancedStatsPageResult } from '../../../../types/stats';
import { buildAdvancedTeamStats } from '../../utils/stats/advancedStats';
import { buildLeagueNavigationEnvelope } from '../navigationEnvelope';

export const loadAdvancedStats = async (): Promise<AdvancedStatsPageResult> => {
  const league = await loadLeagueOrThrow();
  const year = league.info.currentYear;
  const [games, details] = await Promise.all([
    getAllGames(),
    getGameDetailsByYear(year),
  ]);
  const overrideContext = league.info.stage === 'summary'
    ? 'championship_placement'
    : league.info.stage === 'season' &&
        league.playoff.seeds.length === league.settings.playoffTeams
      ? 'playoff_selection'
      : null;
  return {
    ...buildLeagueNavigationEnvelope(league),
    rows: buildAdvancedTeamStats(
      league.teams,
      games.filter(game => game.year === year),
      details,
      overrideContext,
    ),
  };
};
