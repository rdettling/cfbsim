import type { Team } from '../../../types/domain';
import type { GameDetailRecord, GameRecord } from '../../../types/db';
import type {
  LeagueState,
  ResumeComparisonSnapshot,
  ResumeSnapshotResult,
  ResumeSnapshotTeam,
} from '../../../types/league';
import { CONFERENCE_CHAMPIONSHIP_WEEK } from '../postseason';
import type { PlayoffSelection } from './playoffSelection';
import { formatRecord } from '../../sim/teamRecords';
import { comparePollOrder, getResumeScore } from '../../sim/rankingScores';
import { buildPerformanceIndexMap } from './stats/teamPerformance';

type ResumeComparisonInput = {
  league: LeagueState;
  games: GameRecord[];
  details: GameDetailRecord[];
  selection: PlayoffSelection;
  championIds: Set<number>;
};

const buildScoreRanks = (
  teams: Team[],
  scores: ReadonlyMap<number, number>,
) => new Map(teams
    .slice()
    .sort((a, b) =>
      (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.id - b.id)
    .map((team, index) => [team.id, index + 1]));

export const buildResumeComparisonTeams = ({
  league,
  games,
  details,
  selection,
  championIds,
}: ResumeComparisonInput): ResumeSnapshotTeam[] => {
  const currentYearGames = games.filter(game => game.year === league.info.currentYear);
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const selectedTeams = selection.order.slice(0, league.settings.playoffTeams);
  const selectionById = new Map(selectedTeams.map((team, index) => [team.id, index + 1]));
  const resumeScores = new Map(league.teams.map(team => [team.id, getResumeScore(team)]));
  const performanceIndexes = buildPerformanceIndexMap(
    league.teams,
    currentYearGames,
    details,
  );
  const resumeScoreRanks = buildScoreRanks(league.teams, resumeScores);
  const performanceIndexRanks = buildScoreRanks(league.teams, performanceIndexes);
  const pollScoreRanks = new Map(league.teams
    .slice()
    .sort((left, right) => comparePollOrder({
      teamId: left.id,
      pollScore: left.poll_score,
      resumeScore: resumeScores.get(left.id)!,
      performanceIndex: performanceIndexes.get(left.id)!,
    }, {
      teamId: right.id,
      pollScore: right.poll_score,
      resumeScore: resumeScores.get(right.id)!,
      performanceIndex: performanceIndexes.get(right.id)!,
    }))
    .map((team, index) => [team.id, index + 1]));
  const pollScoreRankFor = (team: Team) => pollScoreRanks.get(team.id)!;
  const resultsByTeam = new Map<number, {
    top25Wins: number;
    top25Losses: number;
    bestWin: Team | null;
    worstLoss: Team | null;
  }>();
  const getResults = (teamId: number) => {
    const existing = resultsByTeam.get(teamId);
    if (existing) return existing;
    const created = { top25Wins: 0, top25Losses: 0, bestWin: null, worstLoss: null };
    resultsByTeam.set(teamId, created);
    return created;
  };

  currentYearGames
    .filter(game => game.winnerId)
    .forEach(game => {
      const teamA = teamsById.get(game.teamAId);
      const teamB = teamsById.get(game.teamBId);
      if (!teamA || !teamB) return;
      const winner = game.winnerId === teamA.id ? teamA : teamB;
      const loser = winner.id === teamA.id ? teamB : teamA;
      const winnerResults = getResults(winner.id);
      const loserResults = getResults(loser.id);

      if (pollScoreRankFor(loser) <= 25) winnerResults.top25Wins += 1;
      if (pollScoreRankFor(winner) <= 25) loserResults.top25Losses += 1;
      if (
        !winnerResults.bestWin ||
        pollScoreRankFor(loser) < pollScoreRankFor(winnerResults.bestWin)
      ) {
        winnerResults.bestWin = loser;
      }
      if (
        !loserResults.worstLoss ||
        pollScoreRankFor(winner) > pollScoreRankFor(loserResults.worstLoss)
      ) {
        loserResults.worstLoss = winner;
      }
    });

  const toResult = (opponent: Team | null): ResumeSnapshotResult | null => opponent
    ? {
        opponentId: opponent.id,
        opponent: opponent.name,
        opponentRanking: pollScoreRankFor(opponent),
      }
    : null;

  return league.teams
    .slice()
    .sort((a, b) => pollScoreRanks.get(a.id)! - pollScoreRanks.get(b.id)!)
    .map(team => {
      const results = getResults(team.id);
      const seed = selectionById.get(team.id) ?? null;
      return {
        teamId: team.id,
        name: team.name,
        ranking: pollScoreRanks.get(team.id)!,
        conference: team.conference ?? 'Independent',
        record: formatRecord(team),
        resumeScoreRank: resumeScoreRanks.get(team.id)!,
        performanceIndexRank: performanceIndexRanks.get(team.id)!,
        top25Record: `${results.top25Wins}-${results.top25Losses}`,
        bestWin: toResult(results.bestWin),
        worstLoss: toResult(results.worstLoss),
        seed,
        isAutobid: selection.autobidIds.has(team.id),
        hasBye: league.settings.playoffTeams === 12 && seed !== null && seed <= 4,
        isChampion: championIds.has(team.id),
      };
    });
};

export const buildResumeComparisonSnapshot = (
  input: ResumeComparisonInput,
): ResumeComparisonSnapshot => ({
  year: input.league.info.currentYear,
  frozenAfterWeek: CONFERENCE_CHAMPIONSHIP_WEEK,
  playoff: {
    teams: input.league.settings.playoffTeams,
    autobids: input.league.settings.playoffAutobids,
    conferenceChampionsReceiveTopSeeds:
      input.league.settings.conferenceChampionsReceiveTopSeeds,
  },
  teams: buildResumeComparisonTeams(input),
});
