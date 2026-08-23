import type { Info, PlayoffTeamCount, Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { GameRecord } from '../../types/db';
import { BOWL_WEEK } from '../league/postseason';
import {
  comparePollOrder,
  getEvidenceScore,
  getResumeScore,
  getTeamScore,
  getWeeklyPollScore,
} from './rankingScores';

const getRankingFreezeWeeks = (playoffTeams: PlayoffTeamCount) =>
  playoffTeams === 4
    ? [BOWL_WEEK]
    : playoffTeams === 12
      ? [BOWL_WEEK, BOWL_WEEK + 1, BOWL_WEEK + 2]
      : [];

const performanceFor = (
  performanceIndexes: ReadonlyMap<number, number>,
  teamId: number,
) => {
  const performanceIndex = performanceIndexes.get(teamId);
  if (performanceIndex === undefined) {
    throw new Error(`Performance Index is missing for team ${teamId}.`);
  }
  return performanceIndex;
};

type RankingScoreComponents = {
  resumeScore: number;
  performanceIndex: number;
  evidenceScore: number;
};

const rankingScoreComponents = (
  team: Team,
  performanceIndexes: ReadonlyMap<number, number>,
) => {
  const resumeScore = getResumeScore(team);
  const performanceIndex = performanceFor(performanceIndexes, team.id);
  return {
    resumeScore,
    performanceIndex,
    evidenceScore: getEvidenceScore({ resumeScore, performanceIndex }),
  };
};

const sortByPollScore = (
  teams: Team[],
  scoreComponents: ReadonlyMap<number, RankingScoreComponents>,
) =>
  [...teams].sort((a, b) => {
    const left = scoreComponents.get(a.id)!;
    const right = scoreComponents.get(b.id)!;
    return comparePollOrder({
      teamId: a.id,
      pollScore: a.poll_score,
      ...left,
    }, {
      teamId: b.id,
      pollScore: b.poll_score,
      ...right,
    });
  });

export interface RankingUpdate {
  teamId: number;
  previousRank: number;
  currentRank: number;
  record: string;
  pollScore: number;
}

export const updateRankings = (
  info: Info,
  teams: Team[],
  settings: LeagueState['settings'],
  performanceIndexes: ReadonlyMap<number, number>,
) => {
  const playoffTeams = settings.playoffTeams;
  const skipWeeks = getRankingFreezeWeeks(playoffTeams);
  if (skipWeeks.includes(info.currentWeek)) {
    return [];
  }

  const scoreComponents = new Map(teams.map(team => [
    team.id,
    rankingScoreComponents(team, performanceIndexes),
  ]));

  teams.forEach(team => {
    const previousRank = team.ranking;
    team.last_rank = previousRank;
    team.poll_score = getWeeklyPollScore({
      evidenceScore: scoreComponents.get(team.id)!.evidenceScore,
      teamScore: getTeamScore(team.rating),
      gamesPlayed: team.gamesPlayed,
    });
  });

  const sorted = sortByPollScore(teams, scoreComponents);
  sorted.forEach((team, index) => {
    team.ranking = index + 1;
  });
  return teams.map(team => ({
    teamId: team.id,
    previousRank: team.last_rank ?? team.ranking,
    currentRank: team.ranking,
    record: team.record,
    pollScore: team.poll_score,
  }));
};

export const finalizePostseasonRankings = (
  teams: Team[],
  natty: GameRecord | null,
  performanceIndexes: ReadonlyMap<number, number>,
) => {
  const scoreComponents = new Map(teams.map(team => [
    team.id,
    rankingScoreComponents(team, performanceIndexes),
  ]));
  teams.forEach(team => {
    team.poll_score = scoreComponents.get(team.id)!.evidenceScore;
  });

  const sorted = sortByPollScore(teams, scoreComponents);

  if (natty?.winnerId && natty.teamAId && natty.teamBId) {
    const winnerId = natty.winnerId;
    const loserId = natty.teamAId === winnerId ? natty.teamBId : natty.teamAId;
    const champ = teams.find(team => team.id === winnerId) ?? null;
    const runnerUp = teams.find(team => team.id === loserId) ?? null;
    const rest = sorted.filter(team => team.id !== winnerId && team.id !== loserId);
    const ordered = [champ, runnerUp].filter(Boolean) as Team[];
    ordered.push(...rest);
    ordered.forEach((team, index) => {
      team.ranking = index + 1;
    });
    return;
  }

  sorted.forEach((team, index) => {
    team.ranking = index + 1;
  });
};
