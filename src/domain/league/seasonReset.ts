import type { LeagueState } from '../../types/league';
import type { RivalryConstraint, Team } from '../../types/domain';
import type { GameRecord } from '../../types/db';
import { buildUserScheduleFromGames } from '../schedule/projection';
import { buildBaseLabel } from '../utils/gameLabels';
import {
  buildOddsFields,
  loadOddsContext,
  type OddsContext,
} from '../odds';
import { buildWatchability } from '../sim/games';
import { getRivalriesData } from '../../db/baseData';
import type { RandomSource } from '../utils/random';
import {
  initializeRivalryHostSeeds,
  resolveRivalries,
  resolveRivalrySite,
  type RivalriesData,
} from '../rivalryScheduling';
export type { RivalriesData } from '../rivalryScheduling';

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
    venue?: string | null;
    rivalryKey?: string | null;
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
    venue: options?.venue ?? null,
    winnerId: null,
    baseLabel: buildBaseLabel(teamA, teamB, name ?? null),
    name: name ?? null,
    gameType: 'regular_season',
    rivalryKey: options?.rivalryKey ?? null,
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
    watchability: 0,
  };
  record.watchability = buildWatchability(record, league.teams.length);
  return record;
};

export const initializeNonConScheduling = async (
  league: LeagueState,
  data?: SeasonResetData,
) => {
  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const rivalries = data?.rivalries ?? await getRivalriesData();
  initializeRivalryHostSeeds(
    league,
    rivalries,
    data?.random ? () => data.random!.next() : Math.random,
  );
  const rivalryResolution = resolveRivalries({
    teams: league.teams,
    rivalries,
    existingGames: [],
    year: league.info.currentYear,
  });
  league.pending_rivalries = rivalryResolution.accepted
    .filter(rivalry =>
      rivalry.week === null &&
      (rivalry.teamA === userTeam.name || rivalry.teamB === userTeam.name),
    )
    .map((rivalry, index) => ({
      id: index + 1,
      teamA: rivalry.teamA,
      teamB: rivalry.teamB,
      name: rivalry.name,
      homeTeam: null,
      awayTeam: null,
      neutralSite: rivalry.neutralSite,
      venue: rivalry.venue,
    }));
  const gamesToSave = await buildRivalryGameRecords(
    league,
    rivalryResolution.accepted,
    data,
  );
  const schedule = buildUserScheduleFromGames(userTeam, league.teams, gamesToSave);
  return { schedule, gamesToSave, rivalryResolution };
};

export const prepareSeasonReset = async (
  league: LeagueState,
  data?: SeasonResetData,
) => {
  league.resumeSnapshot = null;
  league.conferences.forEach(conference => {
    conference.championship = null;
    conference.finalStandings = null;
  });
  league.info.lastRankingsWeek = 0;
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
  league.declinedRivalries = [];
  return initializeNonConScheduling(league, data);
};

export const buildRivalryGameRecords = async (
  league: LeagueState,
  accepted: RivalryConstraint[],
  data?: SeasonResetData,
): Promise<GameRecord[]> => {
  const teamByName = new Map(league.teams.map(team => [team.name, team]));
  const games: GameRecord[] = [];

  for (const {
    teamA: teamAName,
    teamB: teamBName,
    week,
    name,
    neutralSite,
    venue,
    key,
  } of accepted) {
    if (!week) continue;
    const teamA = teamByName.get(teamAName);
    const teamB = teamByName.get(teamBName);
    if (!teamA || !teamB) continue;
    const site = resolveRivalrySite(league, teamA, teamB, neutralSite, venue);

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
      { ...site, odds: data?.odds, rivalryKey: key },
    );
    games.push(record);
  }

  return games;
};
