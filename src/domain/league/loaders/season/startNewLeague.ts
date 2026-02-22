import { clearBaseDataCache, getYearData } from '../../../../db/baseData';
import { saveLeague } from '../../../../db/leagueRepo';
import { clearAllSimData, saveGames } from '../../../../db/simRepo';
import type { YearData } from '../../../../types/baseData';
import type { Info } from '../../../../types/domain';
import type { LeagueState, NonConData } from '../../../../types/league';
import { DEFAULT_SETTINGS } from '../../../../types/league';
import { buildTeamsAndConferences } from '../../../baseData';
import { ensureRosters } from '../../../roster';
import { getLastWeekByPlayoffTeams } from '../../postseason';
import { normalizeLeague } from '../../normalize';
import { initializeNonConScheduling } from '../../seasonReset';
import { primeHistoryData } from './shared';

type PlayoffInitSettings = {
  teams: number;
  autobids?: number;
  conf_champ_top_4?: boolean;
};

export const startNewLeague = async (
  teamName: string,
  year: string,
  playoffSettings?: PlayoffInitSettings
): Promise<NonConData> => {
  await clearAllSimData();
  await clearBaseDataCache();
  const [yearData, teamsAndConferences] = await Promise.all([
    getYearData(year),
    buildTeamsAndConferences(year),
  ]);
  const { teams, conferences } = teamsAndConferences;
  const userTeam = teams.find(team => team.name === teamName) ?? teams[0];
  const startYear = Number(year);
  const typedYearData = yearData as YearData;
  const yearPlayoff = typedYearData.playoff ?? null;
  const resolvedPlayoffTeams =
    playoffSettings?.teams ?? yearPlayoff?.teams ?? DEFAULT_SETTINGS.playoff_teams;
  const resolvedPlayoffAutobids =
    playoffSettings?.autobids ??
    yearPlayoff?.conf_champ_autobids ??
    (resolvedPlayoffTeams === 12 ? DEFAULT_SETTINGS.playoff_autobids : undefined);
  const resolvedPlayoffTop4 =
    playoffSettings?.conf_champ_top_4 ??
    yearPlayoff?.conf_champ_top_4 ??
    (resolvedPlayoffTeams === 12 ? DEFAULT_SETTINGS.playoff_conf_champ_top_4 : false);
  const normalizedPlayoffAutobids =
    resolvedPlayoffTeams === 12 ? resolvedPlayoffAutobids : undefined;
  const normalizedPlayoffTop4 = resolvedPlayoffTeams === 12 ? resolvedPlayoffTop4 : false;

  const info: Info = {
    currentWeek: 1,
    currentYear: startYear,
    startYear,
    stage: 'preseason',
    team: userTeam?.name ?? '',
    lastWeek: getLastWeekByPlayoffTeams(resolvedPlayoffTeams),
    colorPrimary: userTeam?.colorPrimary,
    colorSecondary: userTeam?.colorSecondary,
  };

  const league: LeagueState = {
    info,
    teams,
    conferences,
    pending_rivalries: [],
    rivalryHostSeeds: {},
    scheduleBuilt: false,
    simInitialized: false,
    settings: {
      ...DEFAULT_SETTINGS,
      playoff_teams: resolvedPlayoffTeams,
      playoff_autobids: normalizedPlayoffAutobids,
      playoff_conf_champ_top_4: normalizedPlayoffTop4,
    },
    playoff: { seeds: [] },
    idCounters: {
      game: 1,
      drive: 1,
      play: 1,
      gameLog: 1,
      player: 1,
    },
  };

  normalizeLeague(league);
  await ensureRosters(league);
  await primeHistoryData(startYear);

  const { schedule, gamesToSave } = await initializeNonConScheduling(league);
  if (gamesToSave.length) {
    await saveGames(gamesToSave);
  }

  await saveLeague(league);

  return {
    info: league.info,
    team: userTeam,
    schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};
