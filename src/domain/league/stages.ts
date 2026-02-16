import type { LeagueState } from '../../types/league';
import type { PlayerRecord } from '../../types/db';
import { applyRealignmentAndPlayoff } from './offseason';
import { applyProgression, runRecruitingCycle, applyRosterCuts, setStarters, recalculateTeamRatings } from '../roster';
import { resetSeasonData } from './seasonReset';

export const advanceToProgression = async (league: LeagueState) => {
  if (league.info.stage !== 'realignment') return false;
  await applyRealignmentAndPlayoff(league);
  league.info.stage = 'progression';
  return true;
};

export const advanceToRecruitingSummary = async (league: LeagueState, players: PlayerRecord[]) => {
  if (league.info.stage !== 'progression') return false;
  applyProgression(players);
  await runRecruitingCycle(league, league.teams, players);
  league.info.stage = 'recruiting_summary';
  return true;
};

export const advanceToRosterCuts = (league: LeagueState) => {
  if (league.info.stage !== 'recruiting_summary') return false;
  league.info.stage = 'roster_cuts';
  return true;
};

export const advanceToPreseason = async (league: LeagueState, players: PlayerRecord[]) => {
  if (league.info.stage !== 'roster_cuts') return { advanced: false, gamesToSave: [] as any[] };
  applyRosterCuts(league.teams, players);
  setStarters(league.teams, players);
  recalculateTeamRatings(league.teams, players);
  const { gamesToSave } = await resetSeasonData(league);
  league.info.stage = 'preseason';
  return { advanced: true, gamesToSave };
};
