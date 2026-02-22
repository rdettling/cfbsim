import type { LeagueState } from '../../types/league';
import type { Conference, Team } from '../../types/domain';
import type { YearData, TeamsData, ConferencesData } from '../../types/baseData';
import { DEFAULT_SETTINGS, ensureSettings } from '../../types/league';
import { getYearsIndex, getYearData, getTeamsData, getConferencesData } from '../../db/baseData';
import { getLastWeekByPlayoffTeams } from './postseason';

const getClosestYearForData = (years: string[], targetYear: number, startYear?: number) => {
  const numericYears = years
    .map(entry => Number(entry))
    .filter(year => !Number.isNaN(year))
    .sort((a, b) => a - b);

  if (!numericYears.length) return targetYear;

  const lowerBound = startYear ?? numericYears[0];
  const candidates = numericYears.filter(year => year <= targetYear && year >= lowerBound);
  if (candidates.length) return candidates[candidates.length - 1];

  const fallback = numericYears.filter(year => year <= targetYear);
  if (fallback.length) return fallback[fallback.length - 1];

  return numericYears[0];
};

const applyRealignment = (
  league: LeagueState,
  yearData: YearData,
  teamsData: TeamsData,
  conferencesData: ConferencesData
) => {
  if (league.settings && league.settings.auto_realignment === false) return;

  const teamsByName = new Map(league.teams.map(team => [team.name, team]));
  const conferencesByName = new Map(league.conferences.map(conf => [conf.confName, conf]));
  const assignedTeams = new Set<string>();

  let nextTeamId = league.teams.reduce((max, team) => Math.max(max, team.id), 0) + 1;
  let nextConfId = league.conferences.reduce((max, conf) => Math.max(max, conf.id), 0) + 1;

  const ensureTeam = (teamName: string, prestige: number, confName: string, confGames: number) => {
    const existing = teamsByName.get(teamName);
    const meta = teamsData.teams?.[teamName];
    if (existing) {
      existing.conference = confName;
      existing.confName = confName;
      existing.confLimit = confGames;
      existing.nonConfLimit = 12 - confGames;
      if (meta) {
        existing.city = meta.city;
        existing.state = meta.state;
        existing.stadium = meta.stadium;
      }
      return existing;
    }

    if (!meta) return null;

    const team: Team = {
      id: nextTeamId,
      name: teamName,
      abbreviation: meta.abbreviation,
      confGames: 0,
      confLimit: confGames,
      nonConfGames: 0,
      nonConfLimit: 12 - confGames,
      prestige,
      prestige_change: 0,
      ceiling: meta.ceiling,
      floor: meta.floor,
      mascot: meta.mascot,
      city: meta.city,
      state: meta.state,
      stadium: meta.stadium,
      ranking: league.teams.length + 1,
      offense: 90,
      defense: 90,
      colorPrimary: meta.colorPrimary,
      colorSecondary: meta.colorSecondary,
      conference: confName,
      confName,
      confWins: 0,
      confLosses: 0,
      nonConfWins: 0,
      nonConfLosses: 0,
      rating: 90,
      totalWins: 0,
      totalLosses: 0,
      gamesPlayed: 0,
      record: '0-0 (0-0)',
      movement: 0,
      poll_score: 0,
      strength_of_record: 0,
      last_game: null,
      next_game: null,
    };

    nextTeamId += 1;
    league.teams.push(team);
    teamsByName.set(teamName, team);
    return team;
  };

  const conferences: Conference[] = [];

  Object.entries(yearData.conferences ?? {}).forEach(([confName, confData]) => {
    const confTeams: Team[] = [];
    Object.entries(confData.teams ?? {}).forEach(([teamName, prestige]) => {
      const team = ensureTeam(teamName, Number(prestige), confName, confData.games);
      if (!team) return;
      confTeams.push(team);
      assignedTeams.add(teamName);
    });

    const existing = conferencesByName.get(confName);
    conferences.push({
      id: existing?.id ?? nextConfId++,
      confName,
      confFullName: conferencesData[confName] ?? confName,
      confGames: confData.games,
      info: existing?.info ?? '',
      championship: null,
      teams: confTeams,
    });
  });

  const independents = yearData.Independent ?? {};
  if (Object.keys(independents).length) {
    const confName = 'Independent';
    const confTeams: Team[] = [];
    Object.entries(independents).forEach(([teamName, prestige]) => {
      const team = ensureTeam(teamName, Number(prestige), confName, 0);
      if (!team) return;
      confTeams.push(team);
      assignedTeams.add(teamName);
    });

    const existing = conferencesByName.get(confName);
    conferences.push({
      id: existing?.id ?? nextConfId++,
      confName,
      confFullName: conferencesData[confName] ?? confName,
      confGames: 0,
      info: existing?.info ?? '',
      championship: null,
      teams: confTeams,
    });
  }

  const unassignedTeams = league.teams.filter(team => !assignedTeams.has(team.name));
  if (unassignedTeams.length) {
    const grouped: Record<string, Team[]> = {};
    unassignedTeams.forEach(team => {
      const confName = team.conference || 'Independent';
      if (!grouped[confName]) grouped[confName] = [];
      grouped[confName].push(team);
    });

    Object.entries(grouped).forEach(([confName, confTeams]) => {
      const existing = conferences.find(conf => conf.confName === confName);
      if (existing) {
        existing.teams.push(...confTeams);
        return;
      }
      const fallback = conferencesByName.get(confName);
      conferences.push({
        id: fallback?.id ?? nextConfId++,
        confName,
        confFullName: conferencesData[confName] ?? confName,
        confGames: fallback?.confGames ?? 0,
        info: fallback?.info ?? '',
        championship: null,
        teams: confTeams,
      });
    });
  }

  league.conferences = conferences;
};

const refreshPlayoffFormat = (league: LeagueState, yearData: YearData, updateFormat: boolean) => {
  if (!league.settings) {
    league.settings = { ...DEFAULT_SETTINGS };
  }

  if (updateFormat) {
    const playoffConfig = yearData.playoff ?? { teams: league.settings.playoff_teams };
    let nextTeams = playoffConfig.teams ?? league.settings.playoff_teams;
    let nextAutobids = playoffConfig.conf_champ_autobids ?? 0;
    let nextTop4 = playoffConfig.conf_champ_top_4 ?? false;

    if (nextTeams === 2 || nextTeams === 4) {
      nextAutobids = 0;
      nextTop4 = false;
    }

    league.settings.playoff_teams = nextTeams;
    league.settings.playoff_autobids = nextAutobids;
    league.settings.playoff_conf_champ_top_4 = nextTop4;
  }

  league.info.lastWeek = getLastWeekByPlayoffTeams(league.settings.playoff_teams);
  league.playoff = { seeds: [] };
};

export const applyRealignmentAndPlayoff = async (league: LeagueState) => {
  ensureSettings(league);

  league.info.currentYear += 1;
  league.info.currentWeek = 1;

  const yearsIndex = await getYearsIndex();
  const dataYear = getClosestYearForData(
    yearsIndex.years,
    league.info.currentYear,
    league.info.startYear
  );

  const [yearData, teamsData, conferencesData] = await Promise.all([
    getYearData(String(dataYear)),
    getTeamsData(),
    getConferencesData(),
  ]);

  const typedYearData = yearData as YearData;
  const typedTeamsData = teamsData as TeamsData;
  const typedConferencesData = conferencesData as ConferencesData;

  applyRealignment(league, typedYearData, typedTeamsData, typedConferencesData);

  const updateFormat = league.settings?.auto_update_postseason_format ?? true;
  refreshPlayoffFormat(league, typedYearData, updateFormat);
};

type FreshmanPlayer = {
  id: number;
  first: string;
  last: string;
  pos: string;
  rating: number;
  stars: number;
};

export const calculateRecruitingRankings = (
  freshmenByTeam: Record<string, { team: Team; players: FreshmanPlayer[] }>,
  qualityFocus = 0.92
) => {
  const teamRankings: Array<{
    team_name: string;
    team: Team;
    players: FreshmanPlayer[];
    total_points: number;
    avg_stars: number;
    player_count: number;
    five_stars: number;
    four_stars: number;
    three_stars: number;
    two_stars: number;
    one_stars: number;
    weighted_score: number;
  }> = [];

  Object.entries(freshmenByTeam).forEach(([teamName, teamData]) => {
    const players = teamData.players;
    if (!players.length) return;

    const total_points = players.reduce((sum, player) => sum + player.rating, 0);
    const avg_stars = players.reduce((sum, player) => sum + player.stars, 0) / players.length;
    const player_count = players.length;

    const five_stars = players.filter(player => player.stars === 5).length;
    const four_stars = players.filter(player => player.stars === 4).length;
    const three_stars = players.filter(player => player.stars === 3).length;
    const two_stars = players.filter(player => player.stars === 2).length;
    const one_stars = players.filter(player => player.stars === 1).length;

    const quantityWeight = 1.0 - qualityFocus;
    const weighted_score = (qualityFocus * avg_stars) + (quantityWeight * player_count);

    teamRankings.push({
      team_name: teamName,
      team: teamData.team,
      players,
      total_points,
      avg_stars: Math.round(avg_stars * 100) / 100,
      player_count,
      five_stars,
      four_stars,
      three_stars,
      two_stars,
      one_stars,
      weighted_score: Math.round(weighted_score * 10) / 10,
    });
  });

  teamRankings.sort((a, b) => {
    if (b.weighted_score !== a.weighted_score) return b.weighted_score - a.weighted_score;
    return b.total_points - a.total_points;
  });

  if (teamRankings.length) {
    const maxScore = teamRankings[0].weighted_score;
    const minScore = teamRankings[teamRankings.length - 1].weighted_score;
    const range = maxScore - minScore;
    teamRankings.forEach(entry => {
      const scaled = range > 0 ? ((entry.weighted_score - minScore) / range) * 100 : 100;
      entry.weighted_score = Math.round(scaled * 10) / 10;
    });
  }

  return teamRankings;
};
