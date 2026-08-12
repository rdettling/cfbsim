import {
  getHistoricalGamesIndex,
  getHistoricalGamesSeason,
  getHistoryData,
  getSeasonData,
} from '../../../../db/baseData';
import { getAllGames } from '../../../../db/simRepo';
import { getSeasonMemory } from '../../../../db/seasonMemoryRepo';
import type { PlayoffTeamCount } from '../../../../types/domain';
import { SeasonMemoryDataIntegrityError } from '../../../../types/memory';
import type {
  TeamScheduleHeaderMetrics,
  TeamScheduleRow,
} from '../../../../types/scheduleTypes';
import { loadLeagueOrThrow } from '../../leagueStore';
import { getLastWeekByPlayoffTeams } from '../../postseason';
import {
  buildHistoricalScheduleRow,
  buildSimulatedScheduleRow,
  buildTeamScheduleCalendar,
  formatSelectedYearRecord,
  getHistoricalScheduleMetrics,
} from '../../utils/teamSchedule';
import { getUserTeam } from './shared';

export const loadTeamSchedule = async (teamName?: string, yearParam?: number) => {
  const league = await loadLeagueOrThrow();
  const requestedYear = yearParam ?? league.info.currentYear;
  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    getUserTeam(league);

  const [games, historicalIndex, historyData] = await Promise.all([
    getAllGames(),
    getHistoricalGamesIndex(),
    getHistoryData(),
  ]);
  const teamGames = games.filter(
    game => game.teamAId === team.id || game.teamBId === team.id,
  );
  const historyRows = historyData.teams[team.name] ?? [];
  const historyRowsByYear = new Map(historyRows.map(row => [row[0], row]));
  const historicalYears = historicalIndex.years.filter(
    year => year < league.info.startYear && historyRowsByYear.has(year),
  );
  const availableYears = Array.from(new Set([
    ...teamGames.map(game => game.year),
    ...historicalYears,
    league.info.currentYear,
  ])).sort((left, right) => right - left);
  const selectedYear = availableYears.includes(requestedYear)
    ? requestedYear
    : availableYears[0];
  const isHistorical = selectedYear < league.info.startYear &&
    historicalYears.includes(selectedYear);
  const supportedTeamNames = new Set(league.teams.map(entry => entry.name));
  const conferenceNames = new Map(
    Object.entries(historyData.conf_index).map(([name, id]) => [id, name]),
  );

  let schedule: TeamScheduleRow[];
  let selectedTeamMetrics: TeamScheduleHeaderMetrics;

  if (isHistorical) {
    const historyRow = historyRowsByYear.get(selectedYear);
    if (!historyRow) {
      throw new Error(`Historical season ${selectedYear} is missing ${team.name}.`);
    }
    const [season, yearData] = await Promise.all([
      getHistoricalGamesSeason(selectedYear),
      getSeasonData(String(selectedYear)),
    ]);
    const historicalGames = season.games
      .filter(game => game.homeTeam === team.name || game.awayTeam === team.name)
      .map(game => buildHistoricalScheduleRow(game, team.name, supportedTeamNames));
    schedule = buildTeamScheduleCalendar(
      selectedYear,
      getLastWeekByPlayoffTeams(yearData.playoff.teams as PlayoffTeamCount),
      historicalGames,
    );
    selectedTeamMetrics = getHistoricalScheduleMetrics(historyRow, conferenceNames);
  } else {
    const selectedYearGames = teamGames
      .filter(game => game.year === selectedYear && game.weekPlayed > 0)
      .sort((left, right) =>
        left.weekPlayed - right.weekPlayed || left.id - right.id
      );
    const memory = selectedYear === league.info.currentYear
      ? null
      : await getSeasonMemory(selectedYear);
    const snapshots = new Map(
      (selectedYear === league.info.currentYear
        ? league.teams.map(entry => ({
            teamId: entry.id,
            conference: entry.confName ?? entry.conference,
            rating: entry.rating,
            prestige: entry.prestige,
            ranking: entry.ranking,
            record: entry.record,
          }))
        : memory?.teamSnapshots ?? []
      ).map(snapshot => [snapshot.teamId, snapshot]),
    );
    const selectedTeamSnapshot = snapshots.get(team.id);
    if (!selectedTeamSnapshot) {
      throw new SeasonMemoryDataIntegrityError(
        `Season ${selectedYear} is missing the team snapshot for ${team.name}.`,
      );
    }
    const simulatedGames = selectedYearGames.map(game =>
      buildSimulatedScheduleRow({ game, team, teams: league.teams, snapshots })
    );
    const totalWeeks = selectedYear === league.info.currentYear
      ? league.info.lastWeek || 14
      : getLastWeekByPlayoffTeams(memory!.playoffTeams);
    schedule = buildTeamScheduleCalendar(selectedYear, totalWeeks, simulatedGames);
    selectedTeamMetrics = {
      record: formatSelectedYearRecord(selectedYearGames, team.id),
      rating: selectedTeamSnapshot.rating,
      prestige: selectedTeamSnapshot.prestige,
      ranking: selectedTeamSnapshot.ranking,
      conference: selectedTeamSnapshot.conference,
    };
  }

  return {
    info: league.info,
    team,
    schedule,
    teams: [...supportedTeamNames].sort((left, right) => left.localeCompare(right)),
    conferences: league.conferences,
    years: availableYears,
    selected_year: selectedYear,
    selectedTeamMetrics,
  };
};
