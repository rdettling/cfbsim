import type { GameDetailRecord, GameRecord } from '../../../../types/db';
import type { Team } from '../../../../types/domain';
import type { AdvancedUnitStats } from '../../../../types/stats';
import {
  buildPerformanceIndexes,
  PERFORMANCE_OPPONENT_ADJUSTMENT,
} from './performanceIndex';

type UnitAccumulator = {
  plays: number;
  successes: number;
  standardDownPlays: number;
  standardDownSuccesses: number;
  passingDownPlays: number;
  passingDownSuccesses: number;
  explosivePlays: number;
  successfulYards: number;
  opportunities: number;
  opportunityPoints: number;
  havocPlays: number;
  drives: number;
  startingFieldPosition: number;
  runs: number;
  lineYards: number;
  stuffs: number;
};

type TeamPerformance = {
  teamId: number;
  games: number;
  performanceIndex: number;
  offensePerformance: number;
  defensePerformance: number;
  offense: AdvancedUnitStats;
  defense: AdvancedUnitStats;
};

const emptyUnit = (): UnitAccumulator => ({
  plays: 0,
  successes: 0,
  standardDownPlays: 0,
  standardDownSuccesses: 0,
  passingDownPlays: 0,
  passingDownSuccesses: 0,
  explosivePlays: 0,
  successfulYards: 0,
  opportunities: 0,
  opportunityPoints: 0,
  havocPlays: 0,
  drives: 0,
  startingFieldPosition: 0,
  runs: 0,
  lineYards: 0,
  stuffs: 0,
});

const divide = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : 0;

const isStandardDown = (down: number, yardsLeft: number) =>
  down === 1 ||
  (down === 2 && yardsLeft <= 7) ||
  ((down === 3 || down === 4) && yardsLeft <= 4);

const isSuccessfulPlay = (
  down: number,
  yardsLeft: number,
  yardsGained: number,
  result: GameDetailRecord['drives'][number]['plays'][number]['result'],
) => {
  if (result === 'interception' || result === 'fumble' || result === 'sack') {
    return false;
  }
  const requiredShare = down === 1 ? 0.5 : down === 2 ? 0.7 : 1;
  return yardsGained >= yardsLeft * requiredShare;
};

const isExplosivePlay = (
  play: GameDetailRecord['drives'][number]['plays'][number],
) => play.playType === 'run'
  ? play.yardsGained >= 10
  : play.playType === 'pass' && play.yardsGained >= 20;

const isHavocPlay = (
  play: GameDetailRecord['drives'][number]['plays'][number],
) => play.result === 'sack' ||
  play.result === 'interception' ||
  play.result === 'fumble' ||
  (play.playType === 'run' && play.yardsGained < 0);

const lineYards = (yards: number) => {
  if (yards < 0) return yards * 1.2;
  if (yards <= 4) return yards;
  if (yards <= 10) return 4 + (yards - 4) * 0.5;
  return 7;
};

const projectUnit = (unit: UnitAccumulator): AdvancedUnitStats => ({
  successRate: divide(unit.successes, unit.plays),
  standardDownSuccessRate: divide(
    unit.standardDownSuccesses,
    unit.standardDownPlays,
  ),
  passingDownSuccessRate: divide(
    unit.passingDownSuccesses,
    unit.passingDownPlays,
  ),
  explosivePlayRate: divide(unit.explosivePlays, unit.plays),
  successfulPlayYards: divide(unit.successfulYards, unit.successes),
  pointsPerOpportunity: divide(unit.opportunityPoints, unit.opportunities),
  havocRate: divide(unit.havocPlays, unit.plays),
  averageStartingFieldPosition: divide(
    unit.startingFieldPosition,
    unit.drives,
  ),
  lineYardsPerCarry: divide(unit.lineYards, unit.runs),
  stuffRate: divide(unit.stuffs, unit.runs),
});

export const buildTeamPerformance = (
  teams: Team[],
  games: GameRecord[],
  details: GameDetailRecord[],
  opponentAdjustment = PERFORMANCE_OPPONENT_ADJUSTMENT,
): TeamPerformance[] => {
  const completedGames = games.filter(game => game.winnerId !== null);
  const completedGameIds = new Set(completedGames.map(game => game.id));
  const gamesByTeamId = new Map<number, number>();
  completedGames.forEach(game => {
    gamesByTeamId.set(game.teamAId, (gamesByTeamId.get(game.teamAId) ?? 0) + 1);
    gamesByTeamId.set(game.teamBId, (gamesByTeamId.get(game.teamBId) ?? 0) + 1);
  });
  const accumulators = teams.map(team => ({
    team,
    games: gamesByTeamId.get(team.id) ?? 0,
    offense: emptyUnit(),
    defense: emptyUnit(),
  }));
  const byTeamId = new Map(accumulators.map(entry => [entry.team.id, entry]));

  details.filter(detail => completedGameIds.has(detail.gameId)).forEach(detail => {
    detail.drives.forEach(drive => {
      const offense = byTeamId.get(drive.offenseId)?.offense;
      const defense = byTeamId.get(drive.defenseId)?.defense;
      if (!offense || !defense) return;
      offense.drives += 1;
      defense.drives += 1;
      offense.startingFieldPosition += drive.startingFP;
      defense.startingFieldPosition += drive.startingFP;
      const scrimmagePlays = drive.plays.filter(
        play => play.call.kind === 'scrimmage',
      );
      if (scrimmagePlays.some(play => play.startingFP >= 60)) {
        offense.opportunities += 1;
        defense.opportunities += 1;
        offense.opportunityPoints += drive.points;
        defense.opportunityPoints += drive.points;
      }
      scrimmagePlays.forEach(play => {
        const success = isSuccessfulPlay(
          play.down,
          play.yardsLeft,
          play.yardsGained,
          play.result,
        );
        const standardDown = isStandardDown(play.down, play.yardsLeft);
        const explosive = isExplosivePlay(play);
        const havoc = isHavocPlay(play);
        [offense, defense].forEach(unit => {
          unit.plays += 1;
          if (success) {
            unit.successes += 1;
            unit.successfulYards += play.yardsGained;
          }
          if (standardDown) {
            unit.standardDownPlays += 1;
            if (success) unit.standardDownSuccesses += 1;
          } else {
            unit.passingDownPlays += 1;
            if (success) unit.passingDownSuccesses += 1;
          }
          if (explosive) unit.explosivePlays += 1;
          if (havoc) unit.havocPlays += 1;
          if (play.playType === 'run') {
            unit.runs += 1;
            unit.lineYards += lineYards(play.yardsGained);
            if (play.yardsGained <= 0) unit.stuffs += 1;
          }
        });
      });
    });
  });

  const unitStats = new Map(accumulators.map(entry => [entry.team.id, {
    offense: projectUnit(entry.offense),
    defense: projectUnit(entry.defense),
  }]));
  const performanceIndexes = buildPerformanceIndexes(
    accumulators.map(entry => ({
      teamId: entry.team.id,
      games: entry.games,
      offenseOpportunities: entry.offense.opportunities,
      defenseOpportunities: entry.defense.opportunities,
      ...unitStats.get(entry.team.id)!,
    })),
    completedGames,
    new Map(teams.map(team => [team.id, team.rating])),
    opponentAdjustment,
  );

  return accumulators.map(entry => ({
    teamId: entry.team.id,
    games: entry.games,
    ...performanceIndexes.get(entry.team.id)!,
    ...unitStats.get(entry.team.id)!,
  }));
};

export const buildPerformanceIndexMap = (
  teams: Team[],
  games: GameRecord[],
  details: GameDetailRecord[],
  opponentAdjustment = PERFORMANCE_OPPONENT_ADJUSTMENT,
) => new Map(buildTeamPerformance(
  teams,
  games,
  details,
  opponentAdjustment,
).map(row => [row.teamId, row.performanceIndex]));
