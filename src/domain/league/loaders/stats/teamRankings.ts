import { loadLeague } from '../../../../db/leagueRepo';
import { getAllGames, getAllPlays } from '../../../../db/simRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import type { TeamRankingsPageResult } from '../../../../types/stats';
import {
  buildTeamAggregateTables,
  calculateTeamAggregateAverages,
  projectArchivedTeamAggregateTables,
} from '../../utils/stats/teamAggregates';
import { resolveStatisticsSeason } from './seasonContext';

export const loadTeamRankings = async (
  year?: number,
): Promise<TeamRankingsPageResult> => {
  const league = await loadLeague();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  const memories = await getAllSeasonMemories();
  const season = resolveStatisticsSeason(league.info.currentYear, memories, year);
  const { offense, defense } = season.memory
    ? projectArchivedTeamAggregateTables(league.teams, season.memory.teamSnapshots)
    : await Promise.all([getAllGames(), getAllPlays()]).then(([games, plays]) =>
        buildTeamAggregateTables(
          league.teams,
          games,
          plays,
          league.info.currentYear,
        ),
      );

  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    years: season.years,
    selectedYear: season.selectedYear,
    offense,
    defense,
    offense_averages: calculateTeamAggregateAverages(offense),
    defense_averages: calculateTeamAggregateAverages(defense),
  };
};
