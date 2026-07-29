import type { LeagueState } from '../../types/league';
import type { ScheduleGame, Team } from '../../types/domain';
import type { GameRecord } from '../../types/db';
import {
  buildSchedule,
  applyRivalriesToSchedule,
  applyRivalriesDataToSchedule,
} from '../scheduleBuilder';
import { buildBaseLabel } from '../utils/gameLabels';
import {
  buildOddsFields,
  loadOddsContext,
  type OddsContext,
} from '../odds';
import { buildWatchability } from '../sim/games';
import { getRivalriesData } from '../../db/baseData';
import type { RandomSource } from '../recruiting/random';

export interface RivalriesData {
  rivalries: [
    string,
    string,
    number | null,
    string | null,
    boolean?,
  ][];
}

export interface SeasonResetData {
  rivalries: RivalriesData;
  odds: OddsContext;
  random?: RandomSource;
}

export const createNonConGameRecord = async (
  league: LeagueState,
  teamA: Team,
  teamB: Team,
  weekPlayed: number,
  name?: string | null,
  options?: {
    neutralSite?: boolean;
    homeTeam?: Team | null;
    awayTeam?: Team | null;
    odds?: OddsContext;
  },
): Promise<GameRecord> => {
  const oddsContext = options?.odds ?? await loadOddsContext();

  const neutralSite = options?.neutralSite ?? false;
  const homeTeam = neutralSite ? null : options?.homeTeam ?? teamA;
  const awayTeam = neutralSite ? null : options?.awayTeam ?? teamB;

  const oddsFields = buildOddsFields(teamA, teamB, homeTeam, neutralSite, oddsContext);

  const id = league.idCounters.game;
  league.idCounters.game = id + 1;

  const record: GameRecord = {
    id,
    teamAId: teamA.id,
    teamBId: teamB.id,
    homeTeamId: homeTeam?.id ?? null,
    awayTeamId: awayTeam?.id ?? null,
    neutralSite,
    winnerId: null,
    baseLabel: buildBaseLabel(teamA, teamB, name ?? null),
    name: name ?? null,
    ...oddsFields,
    weekPlayed,
    year: league.info.currentYear,
    rankATOG: teamA.ranking,
    rankBTOG: teamB.ranking,
    resultA: null,
    resultB: null,
    overtime: 0,
    quarter: 1,
    clockSecondsLeft: 900,
    scoreA: null,
    scoreB: null,
    headline: null,
    watchability: null,
  };
  record.watchability = buildWatchability(record, league.teams.length);
  return record;
};

export const initializeNonConScheduling = async (
  league: LeagueState,
  data?: SeasonResetData,
) => {
  const schedule = buildSchedule();
  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  league.pending_rivalries = data
    ? applyRivalriesDataToSchedule(
        schedule,
        userTeam,
        league.teams,
        data.rivalries,
      )
    : await applyRivalriesToSchedule(schedule, userTeam, league.teams);
  const gamesToSave = await buildRivalryGameRecords(league, data);
  return { schedule, gamesToSave };
};

export const prepareSeasonReset = async (
  league: LeagueState,
  data?: SeasonResetData,
) => {
  league.teams.forEach(team => {
    team.nonConfGames = 0;
    team.confGames = 0;
    team.nonConfWins = 0;
    team.nonConfLosses = 0;
    team.confWins = 0;
    team.confLosses = 0;
    team.totalWins = 0;
    team.totalLosses = 0;
    team.gamesPlayed = 0;
    team.strength_of_record = 0;
    team.poll_score = 0;
    team.record = '0-0 (0-0)';
    team.movement = 0;
    team.last_game = null;
    team.next_game = null;
    team.strength_of_record_avg = 0;
  });

  league.scheduleBuilt = false;
  league.simInitialized = false;
  return initializeNonConScheduling(league, data);
};

export const buildRivalryGameRecords = async (
  league: LeagueState,
  data?: SeasonResetData,
): Promise<GameRecord[]> => {
  const rivalries = data?.rivalries ?? await getRivalriesData();
  const teamByName = new Map(league.teams.map(team => [team.name, team]));
  const seen = new Set<string>();
  const games: GameRecord[] = [];
  const yearsSinceStart = Math.max(
    0,
    league.info.currentYear - league.info.startYear,
  );

  for (const [teamAName, teamBName, week, name, neutralSite = false] of rivalries.rivalries) {
    if (!week) continue;
    const teamA = teamByName.get(teamAName);
    const teamB = teamByName.get(teamBName);
    if (!teamA || !teamB) continue;

    const key = [teamA.id, teamB.id].sort((a, b) => a - b).join('-') + `-${week}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rivalryKey = [teamAName, teamBName].sort((a, b) => a.localeCompare(b)).join('::');
    const shouldAlternate = !neutralSite;
    if (shouldAlternate && !league.rivalryHostSeeds[rivalryKey]) {
      const draw = data?.random?.fork(`rivalry-host:${rivalryKey}`).next()
        ?? Math.random();
      league.rivalryHostSeeds[rivalryKey] = draw < 0.5 ? teamAName : teamBName;
    }
    const seedHomeName = league.rivalryHostSeeds[rivalryKey] ?? teamAName;
    const flipped = yearsSinceStart % 2 === 1;
    const homeName = flipped
      ? (seedHomeName === teamAName ? teamBName : teamAName)
      : seedHomeName;
    const homeTeam = shouldAlternate
      ? (teamByName.get(homeName) ?? teamA)
      : null;
    const awayTeam = shouldAlternate
      ? (homeName === teamAName ? teamB : teamA)
      : null;

    if (teamA.conference !== 'Independent' && teamA.conference === teamB.conference) {
      teamA.confGames += 1;
      teamB.confGames += 1;
    } else {
      teamA.nonConfGames += 1;
      teamB.nonConfGames += 1;
    }

    const record = await createNonConGameRecord(
      league,
      teamA,
      teamB,
      week,
      name ?? null,
      { neutralSite, homeTeam, awayTeam, odds: data?.odds },
    );
    games.push(record);
  }

  return games;
};
