import type {
  GameDetailRecord,
  GameRecord,
  PlayerRecord,
} from '../../types/db';
import type { Team } from '../../types/domain';
import {
  deriveEditorialIdentity,
  FEATURED_PERFORMANCE_THRESHOLDS,
  type FeaturedPerformanceQualifier,
  type UpsetEvidence,
} from './policy';

export interface FeaturedPerformance {
  playerId: number;
  teamId: number;
  playerName: string;
  position: string;
  summary: string;
  score: number;
  qualifyingFacts: FeaturedPerformanceQualifier[];
}

export interface ScoringEvent {
  driveNum: number;
  teamId: number;
  points: number;
  quarter: number;
  secondsLeft: number;
  scoreA: number;
  scoreB: number;
  leadTaking: boolean;
}

export interface GameStoryFacts {
  game: GameRecord;
  winner: Team;
  loser: Team;
  winnerScore: number;
  loserScore: number;
  margin: number;
  winnerRank: number;
  loserRank: number;
  winnerEditorialRank: number | null;
  loserEditorialRank: number | null;
  winnerWinProbability: number;
  upsetEvidence: UpsetEvidence;
  scoringEvents: ScoringEvent[];
  leadChanges: number;
  largestWinnerDeficit: number;
  fourthQuarterComeback: boolean;
  lateWinningScore: ScoringEvent | null;
  turnoversForcedByWinner: number;
  turnoversCommittedByWinner: number;
  shutout: boolean;
  defensiveDominance: boolean;
  featuredPerformance: FeaturedPerformance | null;
  priorMeetings: number;
  winnerSeriesStreak: number;
  revenge: boolean;
  postseasonRematch: boolean;
}

const scorePerformance = (
  player: PlayerRecord,
  stats: GameDetailRecord['playerStats'][number],
): FeaturedPerformance | null => {
  const name = `${player.first} ${player.last}`;
  const candidates: FeaturedPerformance[] = [];
  const base = {
    playerId: player.id,
    teamId: player.teamId,
    playerName: name,
    position: player.pos,
  };
  const threshold = FEATURED_PERFORMANCE_THRESHOLDS;
  const qualifiers = (
    ...values: Array<FeaturedPerformanceQualifier | null>
  ): FeaturedPerformanceQualifier[] =>
    values.filter((value): value is FeaturedPerformanceQualifier => value !== null);
  if (stats.pass_yards >= threshold.passingYards || stats.pass_touchdowns >= threshold.passingTouchdowns) {
    const touchdowns = stats.pass_touchdowns > 0
      ? ` and ${stats.pass_touchdowns} passing ${stats.pass_touchdowns === 1 ? 'touchdown' : 'touchdowns'}`
      : '';
    candidates.push({
      ...base,
      summary: `${stats.pass_yards} passing yards${touchdowns}`,
      score: stats.pass_yards + stats.pass_touchdowns * 70 - stats.pass_interceptions * 20,
      qualifyingFacts: qualifiers(
        stats.pass_yards >= threshold.passingYards ? 'passing_yards_350' : null,
        stats.pass_touchdowns >= threshold.passingTouchdowns ? 'passing_touchdowns_4' : null,
      ),
    });
  }
  if (stats.rush_yards >= threshold.rushingYards || stats.rush_touchdowns >= threshold.rushingTouchdowns) {
    const touchdowns = stats.rush_touchdowns > 0
      ? ` and ${stats.rush_touchdowns} rushing ${stats.rush_touchdowns === 1 ? 'touchdown' : 'touchdowns'}`
      : '';
    candidates.push({
      ...base,
      summary: `${stats.rush_yards} rushing yards${touchdowns}`,
      score: stats.rush_yards + stats.rush_touchdowns * 90,
      qualifyingFacts: qualifiers(
        stats.rush_yards >= threshold.rushingYards ? 'rushing_yards_175' : null,
        stats.rush_touchdowns >= threshold.rushingTouchdowns ? 'rushing_touchdowns_3' : null,
      ),
    });
  }
  if (stats.receiving_yards >= threshold.receivingYards || stats.receiving_touchdowns >= threshold.receivingTouchdowns) {
    const touchdowns = stats.receiving_touchdowns > 0
      ? ` and ${stats.receiving_touchdowns} ${stats.receiving_touchdowns === 1 ? 'touchdown' : 'touchdowns'}`
      : '';
    candidates.push({
      ...base,
      summary: `${stats.receiving_catches} catches for ${stats.receiving_yards} yards${touchdowns}`,
      score: stats.receiving_yards + stats.receiving_touchdowns * 90,
      qualifyingFacts: qualifiers(
        stats.receiving_yards >= threshold.receivingYards ? 'receiving_yards_175' : null,
        stats.receiving_touchdowns >= threshold.receivingTouchdowns ? 'receiving_touchdowns_3' : null,
      ),
    });
  }
  if (
    stats.interceptions >= threshold.interceptions ||
    stats.sacks >= threshold.sacks ||
    stats.tackles >= threshold.tackles
  ) {
    const parts = [
      stats.tackles ? `${stats.tackles} ${stats.tackles === 1 ? 'tackle' : 'tackles'}` : '',
      stats.sacks ? `${stats.sacks} ${stats.sacks === 1 ? 'sack' : 'sacks'}` : '',
      stats.interceptions ? `${stats.interceptions} ${stats.interceptions === 1 ? 'interception' : 'interceptions'}` : '',
    ].filter(Boolean);
    candidates.push({
      ...base,
      summary: parts.join(', '),
      score: stats.tackles * 8 + stats.sacks * 45 + stats.interceptions * 65,
      qualifyingFacts: qualifiers(
        stats.tackles >= threshold.tackles ? 'tackles_15' : null,
        stats.sacks >= threshold.sacks ? 'sacks_3' : null,
        stats.interceptions >= threshold.interceptions ? 'interceptions_2' : null,
      ),
    });
  }
  if (stats.field_goals_made >= threshold.fieldGoalsMade) {
    candidates.push({
      ...base,
      summary: `${stats.field_goals_made} made field goals`,
      score: stats.field_goals_made * 60,
      qualifyingFacts: ['field_goals_made_4'],
    });
  }
  return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
};

const buildScoringEvents = (
  game: GameRecord,
  detail: GameDetailRecord,
): ScoringEvent[] => {
  let scoreA = 0;
  let scoreB = 0;
  return [...detail.drives]
    .sort((left, right) => left.driveNum - right.driveNum)
    .flatMap(drive => {
      const pointsA = drive.scoreAAfter - scoreA;
      const pointsB = drive.scoreBAfter - scoreB;
      const beforeDifference = scoreA - scoreB;
      scoreA = drive.scoreAAfter;
      scoreB = drive.scoreBAfter;
      if (pointsA <= 0 && pointsB <= 0) return [];
      const lastPlay = drive.plays[drive.plays.length - 1];
      const teamId = pointsA > 0 ? game.teamAId : game.teamBId;
      const afterDifference = scoreA - scoreB;
      const leadTaking = teamId === game.teamAId
        ? beforeDifference <= 0 && afterDifference > 0
        : beforeDifference >= 0 && afterDifference < 0;
      return [{
        driveNum: drive.driveNum,
        teamId,
        points: Math.max(pointsA, pointsB),
        quarter: lastPlay?.timing.kind === 'regulation'
          ? lastPlay.timing.end.quarter
          : lastPlay?.timing.kind === 'try' && lastPlay.timing.context === 'regulation'
            ? lastPlay.timing.quarter
            : 4,
        secondsLeft: lastPlay?.timing.kind === 'regulation'
          ? lastPlay.timing.end.secondsLeft
          : lastPlay?.timing.kind === 'try' && lastPlay.timing.context === 'regulation'
            ? lastPlay.timing.secondsLeft
            : 0,
        scoreA,
        scoreB,
        leadTaking,
      }];
    });
};

const priorSeries = (game: GameRecord, games: GameRecord[]) =>
  games
    .filter(candidate =>
      candidate.winnerId !== null &&
      ((candidate.teamAId === game.teamAId && candidate.teamBId === game.teamBId) ||
        (candidate.teamAId === game.teamBId && candidate.teamBId === game.teamAId)) &&
      (candidate.year < game.year ||
        (candidate.year === game.year &&
          (candidate.weekPlayed < game.weekPlayed ||
            (candidate.weekPlayed === game.weekPlayed && candidate.id < game.id)))),
    )
    .sort((left, right) =>
      left.year - right.year || left.weekPlayed - right.weekPlayed || left.id - right.id,
    );

export const extractGameStoryFacts = ({
  game,
  detail,
  teamsById,
  playersById,
  games,
}: {
  game: GameRecord;
  detail: GameDetailRecord;
  teamsById: Map<number, Team>;
  playersById: Map<number, PlayerRecord>;
  games: GameRecord[];
}): GameStoryFacts => {
  if (game.winnerId === null) throw new Error(`Cannot publish news for unfinished game ${game.id}.`);
  const winner = teamsById.get(game.winnerId);
  const loserId = game.winnerId === game.teamAId ? game.teamBId : game.teamAId;
  const loser = teamsById.get(loserId);
  if (!winner || !loser) throw new Error(`Game ${game.id} references a missing team.`);

  const winnerIsA = winner.id === game.teamAId;
  const winnerScore = (winnerIsA ? game.scoreA : game.scoreB) ?? 0;
  const loserScore = (winnerIsA ? game.scoreB : game.scoreA) ?? 0;
  const winnerRank = winnerIsA ? game.rankATOG : game.rankBTOG;
  const loserRank = winnerIsA ? game.rankBTOG : game.rankATOG;
  const winnerWinProbability = winnerIsA ? game.winProbA : game.winProbB;
  const scoringEvents = buildScoringEvents(game, detail);

  let largestWinnerDeficit = 0;
  let leadChanges = 0;
  let previousLeader = 0;
  for (const event of scoringEvents) {
    const winnerPoints = winnerIsA ? event.scoreA : event.scoreB;
    const loserPoints = winnerIsA ? event.scoreB : event.scoreA;
    largestWinnerDeficit = Math.max(largestWinnerDeficit, loserPoints - winnerPoints);
    const leader = event.scoreA === event.scoreB ? 0 : event.scoreA > event.scoreB ? game.teamAId : game.teamBId;
    if (leader && previousLeader && leader !== previousLeader) leadChanges += 1;
    if (leader) previousLeader = leader;
  }
  const winnerLeadEvents = scoringEvents.filter(
    event => event.teamId === winner.id && event.leadTaking,
  );
  const finalWinnerLead = winnerLeadEvents[winnerLeadEvents.length - 1] ?? null;
  const fourthQuarterComeback = game.overtime === 0 && largestWinnerDeficit >= 7 && Boolean(
    finalWinnerLead && finalWinnerLead.quarter === 4,
  );
  const lateWinningScore = game.overtime === 0 && finalWinnerLead?.quarter === 4 && finalWinnerLead.secondsLeft <= 120
    ? finalWinnerLead
    : null;

  let turnoversForcedByWinner = 0;
  let turnoversCommittedByWinner = 0;
  for (const drive of detail.drives) {
    if (drive.result !== 'interception' && drive.result !== 'fumble') continue;
    if (drive.offenseId === winner.id) turnoversCommittedByWinner += 1;
    else turnoversForcedByWinner += 1;
  }

  const featuredPerformance = detail.playerStats
    .flatMap(stats => {
      const player = playersById.get(stats.playerId);
      if (!player || player.teamId !== winner.id) return [];
      const performance = scorePerformance(player, stats);
      return performance ? [performance] : [];
    })
    .sort((left, right) => right.score - left.score || left.playerId - right.playerId)[0] ?? null;

  const prior = priorSeries(game, games);
  const lastMeeting = prior[prior.length - 1];
  let winnerSeriesStreak = 1;
  for (let index = prior.length - 1; index >= 0; index -= 1) {
    if (prior[index].winnerId !== winner.id) break;
    winnerSeriesStreak += 1;
  }

  const { winnerEditorialRank, loserEditorialRank, upsetEvidence } =
    deriveEditorialIdentity({ winnerRank, loserRank, winnerWinProbability });
  const margin = Math.abs(winnerScore - loserScore);

  return {
    game,
    winner,
    loser,
    winnerScore,
    loserScore,
    margin,
    winnerRank,
    loserRank,
    winnerEditorialRank,
    loserEditorialRank,
    winnerWinProbability,
    upsetEvidence,
    scoringEvents,
    leadChanges,
    largestWinnerDeficit,
    fourthQuarterComeback,
    lateWinningScore,
    turnoversForcedByWinner,
    turnoversCommittedByWinner,
    shutout: loserScore === 0,
    defensiveDominance: loserScore === 0 ||
      (turnoversForcedByWinner >= 3 && loserScore <= 14),
    featuredPerformance,
    priorMeetings: prior.length,
    winnerSeriesStreak,
    revenge: Boolean(lastMeeting && lastMeeting.winnerId === loser.id),
    postseasonRematch: prior.some(candidate => candidate.gameType !== 'regular_season'),
  };
};

export const formatGameClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};
