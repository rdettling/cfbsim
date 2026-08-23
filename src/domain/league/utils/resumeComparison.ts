import type { Team } from '../../../types/domain';
import type { GameRecord } from '../../../types/db';
import type {
  LeagueState,
  ResumeComparisonSnapshot,
  ResumeSnapshotResult,
  ResumeSnapshotTeam,
} from '../../../types/league';
import {
  getWinProbForRatings,
  HOME_FIELD_ADVANTAGE,
  type OddsContext,
} from '../../odds';
import { CONFERENCE_CHAMPIONSHIP_WEEK } from '../postseason';
import { REGULAR_SEASON_WEEKS } from '../../schedule/constants';
import type { PlayoffSelection } from './playoffSelection';
import { formatRecord } from '../../sim/teamRecords';

type ResumeComparisonInput = {
  league: LeagueState;
  games: GameRecord[];
  selection: PlayoffSelection;
  championIds: Set<number>;
  oddsContext: OddsContext;
};

const buildWinsOverExpectationRanks = (teams: Team[]) => {
  const ranks = new Map<number, number>();
  teams
    .slice()
    .sort((a, b) => {
      const difference = b.wins_over_expectation_per_game - a.wins_over_expectation_per_game;
      return difference || a.id - b.id;
    })
    .forEach((team, index) => ranks.set(team.id, index + 1));
  return ranks;
};

export const calculateStrengthOfScheduleRanks = (
  teams: Team[],
  games: GameRecord[],
  year: number,
  oddsContext: OddsContext,
) => {
  const ratedTeams = teams
    .slice()
    .sort((a, b) => (b.rating - a.rating) || (a.id - b.id))
    .slice(0, Math.min(25, teams.length));
  const averageTop25Rating = ratedTeams.reduce((sum, team) => sum + team.rating, 0)
    / Math.max(1, ratedTeams.length);
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const probabilitiesByTeam = new Map<number, number[]>();
  teams.forEach(team => probabilitiesByTeam.set(team.id, []));

  games
    .filter(game => game.year === year && game.weekPlayed <= REGULAR_SEASON_WEEKS)
    .forEach(game => {
      const teamA = teamsById.get(game.teamAId);
      const teamB = teamsById.get(game.teamBId);
      if (!teamA || !teamB) return;

      const probabilityFor = (team: Team, opponent: Team) => {
        let hypotheticalRating = averageTop25Rating;
        let opponentRating = opponent.rating;
        if (!game.neutralSite) {
          if (game.homeTeamId === team.id) hypotheticalRating += HOME_FIELD_ADVANTAGE;
          if (game.homeTeamId === opponent.id) opponentRating += HOME_FIELD_ADVANTAGE;
        }
        return getWinProbForRatings(hypotheticalRating, opponentRating, oddsContext);
      };

      probabilitiesByTeam.get(teamA.id)!.push(probabilityFor(teamA, teamB));
      probabilitiesByTeam.get(teamB.id)!.push(probabilityFor(teamB, teamA));
    });

  const expectedWins = new Map<number, number | null>();
  teams.forEach(team => {
    const probabilities = probabilitiesByTeam.get(team.id) ?? [];
    expectedWins.set(
      team.id,
      probabilities.length
        ? (probabilities.reduce((sum, probability) => sum + probability, 0) / probabilities.length) * 12
        : null,
    );
  });

  const ranks = new Map<number, number | null>(teams.map(team => [team.id, null]));
  teams
    .filter(team => expectedWins.get(team.id) !== null)
    .sort((a, b) => {
      const difference = Number(expectedWins.get(a.id)) - Number(expectedWins.get(b.id));
      return difference || a.id - b.id;
    })
    .forEach((team, index) => ranks.set(team.id, index + 1));

  return { averageTop25Rating, expectedWins, ranks };
};

export const buildResumeComparisonTeams = ({
  league,
  games,
  selection,
  championIds,
  oddsContext,
}: ResumeComparisonInput): ResumeSnapshotTeam[] => {
  const currentYearGames = games.filter(game => game.year === league.info.currentYear);
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const selectedTeams = selection.order.slice(0, league.settings.playoffTeams);
  const selectionById = new Map(selectedTeams.map((team, index) => [team.id, index + 1]));
  const winsOverExpectationRanks = buildWinsOverExpectationRanks(league.teams);
  const sosRanks = calculateStrengthOfScheduleRanks(
    league.teams,
    currentYearGames,
    league.info.currentYear,
    oddsContext,
  ).ranks;
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

      if (loser.ranking <= 25) winnerResults.top25Wins += 1;
      if (winner.ranking <= 25) loserResults.top25Losses += 1;
      if (!winnerResults.bestWin || loser.ranking < winnerResults.bestWin.ranking) {
        winnerResults.bestWin = loser;
      }
      if (!loserResults.worstLoss || winner.ranking > loserResults.worstLoss.ranking) {
        loserResults.worstLoss = winner;
      }
    });

  const toResult = (opponent: Team | null): ResumeSnapshotResult | null => opponent
    ? {
        opponentId: opponent.id,
        opponent: opponent.name,
        opponentRanking: opponent.ranking,
      }
    : null;

  return league.teams
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .map(team => {
      const results = getResults(team.id);
      const seed = selectionById.get(team.id) ?? null;
      return {
        teamId: team.id,
        name: team.name,
        ranking: team.ranking,
        conference: team.conference ?? 'Independent',
        record: formatRecord(team),
        pollScore: team.poll_score,
        winsOverExpectationRank: winsOverExpectationRanks.get(team.id) ?? team.ranking,
        sosRank: sosRanks.get(team.id) ?? null,
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
