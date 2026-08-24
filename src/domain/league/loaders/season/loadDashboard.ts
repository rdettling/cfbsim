import type { ScheduleGame, Team } from '../../../../types/domain';
import type { LeagueNavigationData } from '../../../../types/navigation';
import { buildUserScheduleFromGames } from '../../../schedule/projection';
import { loadLeagueOrThrow } from '../../leagueStore';
import {
  getCurrentYearGames,
  getUserTeam,
} from './shared';
import { getNewsByWeek } from '../../../../db/newsRepo';
import { sortNewsItems } from '../../../news/ordering';
import type { NewsItem } from '../../../../types/news';
import { buildConferenceStandings } from '../../utils/standings';

export interface DashboardPageResult extends LeagueNavigationData {
  prev_game: ScheduleGame | null;
  curr_game: ScheduleGame | null;
  confTeams: Team[];
  top_10: Team[];
  topStories: NewsItem[];
}

export const loadDashboard = async (): Promise<DashboardPageResult> => {
  const league = await loadLeagueOrThrow();

  const userTeam = getUserTeam(league);
  const top10 = [...league.teams].sort((a, b) => a.ranking - b.ranking).slice(0, 10);

  const games = await getCurrentYearGames(league);
  const conference = league.conferences.find(
    candidate => candidate.confName === userTeam.conference,
  );
  const confTeams = buildConferenceStandings({
    teams: league.teams.filter(team => team.conference === userTeam.conference),
    games,
    year: league.info.currentYear,
    finalStandings: conference?.finalStandings ?? null,
  }).map(row => ({
    ...row.team,
    confWins: row.conferenceWins,
    confLosses: row.conferenceLosses,
  }));
  const schedule = buildUserScheduleFromGames(
    userTeam,
    league.teams,
    games,
    league.info.lastWeek || 14,
  );
  const currentWeekIndex = Math.max(league.info.currentWeek - 1, 0);
  const prevGame = currentWeekIndex > 0 ? schedule[currentWeekIndex - 1] : null;
  const currGame = schedule[currentWeekIndex] ?? null;

  const lastWeek = Math.max(league.info.currentWeek - 1, 1);
  const weekStories = await getNewsByWeek(league.info.currentYear, lastWeek);
  const preseasonStories = league.info.currentWeek === 1
    ? await getNewsByWeek(league.info.currentYear, 0)
    : [];
  const topStories = sortNewsItems([...weekStories, ...preseasonStories])
    .slice(0, 5);

  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    prev_game: prevGame,
    curr_game: currGame,
    team: userTeam,
    confTeams,
    top_10: top10,
    topStories,
    conferences: league.conferences,
  };
};
