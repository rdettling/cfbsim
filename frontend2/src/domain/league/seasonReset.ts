import type { LeagueState } from '../../types/league';
import type { ScheduleGame, Team } from '../../types/domain';
import type { GameRecord } from '../../types/db';
import { buildSchedule, applyRivalriesToSchedule } from '../schedule';
import { buildBaseLabel } from '../gameHelpers';
import { buildOddsFields, loadOddsContext } from '../odds';
import { clearSimArtifacts } from '../../db/simRepo';

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
    scoreA: null,
    scoreB: null,
    headline: null,
    watchability: null,
  };
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

  await clearSimArtifacts();
  league.scheduleBuilt = false;
  league.simInitialized = false;
  league.idCounters = {
    game: 1,
    drive: 1,
    play: 1,
    gameLog: 1,
    player: league.idCounters?.player ?? 1,
  };

  const schedule = buildSchedule();
  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  league.pending_rivalries = await applyRivalriesToSchedule(schedule, userTeam, league.teams);

  const created = await Promise.all(
    schedule
      .filter(slot => slot.opponent)
      .map(slot => {
        const opponent = league.teams.find(team => team.name === slot.opponent?.name);
        if (!opponent) return null;
        userTeam.nonConfGames += 1;
        opponent.nonConfGames += 1;
        return createNonConGameRecord(
          league,
          userTeam,
          opponent,
          slot.weekPlayed,
          slot.label ?? null,
          { neutralSite: true }
        );
      })
  );

  return { schedule, gamesToSave: created.filter(Boolean) as GameRecord[] };
};
