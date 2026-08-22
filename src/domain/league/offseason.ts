import type { LeagueState } from '../../types/league';
import type {
  Conference,
  PlayoffTeamCount,
  Team,
} from '../../types/domain';
import type { SeasonData, TeamsData, ConferencesData } from '../../types/baseData';
import {
  getConferencesData,
  getHistoryData,
  getPrestigeConfig,
  getTeamsData,
} from '../../db/baseData';
import { getLastWeekByPlayoffTeams } from './postseason';
import { calculateStartingPrestiges } from './prestige';
import {
  resolveHistoricalData,
  type ResolvedHistoricalData,
} from './historicalData';

const applyRealignment = (
  league: LeagueState,
  yearData: SeasonData,
  teamsData: TeamsData,
  conferencesData: ConferencesData,
  startingPrestiges: Readonly<Record<string, number>>,
) => {
  if (league.settings.conferencePolicy === 'current') return [];

  const teamsByName = new Map(league.teams.map(team => [team.name, team]));
  const conferencesByName = new Map(league.conferences.map(conf => [conf.confName, conf]));
  const assignedTeams = new Set<string>();
  const addedTeams: Team[] = [];

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

    if (!meta) throw new Error(`Team metadata for ${teamName} is unavailable.`);
    if (!Number.isInteger(prestige)) {
      throw new Error(`Starting Prestige for ${teamName} is unavailable.`);
    }

    const team: Team = {
      id: nextTeamId,
      name: teamName,
      abbreviation: meta.abbreviation,
      confGames: 0,
      confLimit: confGames,
      nonConfGames: 0,
      nonConfLimit: 12 - confGames,
      prestige,
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
      strength_of_record_avg: 0,
      last_rank: null,
      last_game: null,
      next_game: null,
    };

    nextTeamId += 1;
    league.teams.push(team);
    addedTeams.push(team);
    teamsByName.set(teamName, team);
    return team;
  };

  const conferences: Conference[] = [];

  Object.entries(yearData.conferences).forEach(([confName, confData]) => {
    const confTeams: Team[] = [];
    confData.teams.forEach(teamName => {
      const team = ensureTeam(
        teamName,
        startingPrestiges[teamName],
        confName,
        confData.games,
      );
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
      finalStandings: null,
      teams: confTeams,
    });
  });

  const independents = yearData.independents;
  if (independents.length) {
    const confName = 'Independent';
    const confTeams: Team[] = [];
    independents.forEach(teamName => {
      const team = ensureTeam(teamName, startingPrestiges[teamName], confName, 0);
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
      finalStandings: null,
      teams: confTeams,
    });
  }

  const unassignedTeams = league.teams.filter(team => !assignedTeams.has(team.name));
  if (unassignedTeams.length) {
    const grouped: Record<string, Team[]> = {};
    unassignedTeams.forEach(team => {
      const confName = team.conference;
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
        finalStandings: null,
        teams: confTeams,
      });
    });
  }

  league.conferences = conferences;
  return addedTeams;
};

const refreshPlayoffFormat = (league: LeagueState, yearData: SeasonData, updateFormat: boolean) => {
  if (updateFormat) {
    const playoffConfig = yearData.playoff;
    const historicalTeams = playoffConfig.teams;
    const nextTeams: PlayoffTeamCount =
      historicalTeams === 2 ||
      historicalTeams === 4 ||
      historicalTeams === 12
        ? historicalTeams
        : league.settings.playoffTeams;
    let nextAutobids = playoffConfig.conf_champ_autobids;
    let nextTop4 = playoffConfig.conf_champ_top_4;

    if (nextTeams === 2 || nextTeams === 4) {
      nextAutobids = 0;
      nextTop4 = false;
    }

    league.settings.playoffTeams = nextTeams;
    league.settings.playoffAutobids = nextAutobids;
    league.settings.conferenceChampionsReceiveTopSeeds = nextTop4;
  }

  league.info.lastWeek = getLastWeekByPlayoffTeams(league.settings.playoffTeams);
  league.playoff = { seeds: [] };
};

export const applyRealignmentAndPlayoff = async (
  league: LeagueState,
  historicalData?: ResolvedHistoricalData,
) => {
  const targetYear = league.info.currentYear + 1;
  const resolved =
    historicalData ??
    (await resolveHistoricalData(targetYear, league.info.startYear));

  league.info.currentYear = targetYear;
  league.info.currentWeek = 1;

  const [teamsData, conferencesData, historyData, prestigeConfig] = await Promise.all([
    getTeamsData(),
    getConferencesData(),
    getHistoryData(),
    getPrestigeConfig(),
  ]);

  const typedYearData = resolved.yearData;
  const typedTeamsData = teamsData as TeamsData;
  const typedConferencesData = conferencesData as ConferencesData;
  const startingPrestiges = calculateStartingPrestiges({
    year: targetYear,
    teamNames: [
      ...Object.values(typedYearData.conferences)
        .flatMap(conference => conference.teams),
      ...typedYearData.independents,
    ],
    historyData,
    teamsData: typedTeamsData,
    prestigeConfig,
  });

  const addedTeams = applyRealignment(
    league,
    typedYearData,
    typedTeamsData,
    typedConferencesData,
    startingPrestiges,
  );
  league.conferences.forEach(conference => {
    conference.championship = null;
    conference.finalStandings = null;
  });

  const updateFormat = league.settings.postseasonPolicy === 'historical';
  refreshPlayoffFormat(league, typedYearData, updateFormat);
  return addedTeams;
};
