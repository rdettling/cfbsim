import type { LeagueState } from '../../types/league';
import type { ScheduleGame, Team } from '../../types/domain';
import type { GameRecord } from '../../types/db';
import { buildSchedule, applyRivalriesToSchedule } from '../schedule';
import { buildBaseLabel } from '../utils/gameLabels';
import { buildOddsFields, loadOddsContext } from '../odds';
import { clearNonGameArtifacts } from '../../db/simRepo';
import { getRivalriesData } from '../../db/baseData';

export const createNonConGameRecord = async (
  league: LeagueState,
  teamA: Team,
  teamB: Team,
  weekPlayed: number,
  name?: string | null,
  options?: { neutralSite?: boolean; homeTeam?: Team | null; awayTeam?: Team | null }
): Promise<GameRecord> => {
  const oddsContext = await loadOddsContext();

  const neutralSite = options?.neutralSite ?? false;
  const homeTeam = neutralSite ? null : options?.homeTeam ?? teamA;
  const awayTeam = neutralSite ? null : options?.awayTeam ?? teamB;

  const oddsFields = buildOddsFields(teamA, teamB, homeTeam, neutralSite, oddsContext);

  if (!league.idCounters) {
    league.idCounters = { game: 1, drive: 1, play: 1, gameLog: 1, player: 1 };
  }
  const id = league.idCounters.game ?? 1;
  league.idCounters.game = id + 1;

  return {
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
};

export const initializeNonConScheduling = async (league: LeagueState) => {
  const schedule = buildSchedule();
  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  league.pending_rivalries = await applyRivalriesToSchedule(schedule, userTeam, league.teams);
  const gamesToSave = await buildRivalryGameRecords(league);
  return { schedule, gamesToSave };
};

export const resetSeasonData = async (league: LeagueState) => {
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
  });

  await clearNonGameArtifacts();
  league.scheduleBuilt = false;
  league.simInitialized = false;
  if (!league.idCounters) {
    league.idCounters = { game: 1, drive: 1, play: 1, gameLog: 1, player: 1 };
  }

  return initializeNonConScheduling(league);
};

export const buildRivalryGameRecords = async (league: LeagueState): Promise<GameRecord[]> => {
  const rivalries = await getRivalriesData();
  const teamByName = new Map(league.teams.map(team => [team.name, team]));
  const seen = new Set<string>();
  const games: GameRecord[] = [];

  for (const [teamAName, teamBName, week, name] of rivalries.rivalries) {
    if (!week) continue;
    const teamA = teamByName.get(teamAName);
    const teamB = teamByName.get(teamBName);
    if (!teamA || !teamB) continue;

    const key = [teamA.id, teamB.id].sort((a, b) => a - b).join('-') + `-${week}`;
    if (seen.has(key)) continue;
    seen.add(key);

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
      { neutralSite: true }
    );
    games.push(record);
  }

  return games;
};
