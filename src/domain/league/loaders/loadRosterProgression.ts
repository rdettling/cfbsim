import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import type {
  DepartingPlayerPreview,
  ReturningPlayerPreview,
  RosterProgressionSummary,
} from '../../../types/roster';
import { projectPlayerProgression } from '../../roster';
import { POSITION_ORDER } from '../../rosterConfig';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

const EMPTY_SUMMARY: RosterProgressionSummary = {
  returningPlayers: 0,
  departingSeniors: 0,
  averageRatingChange: 0,
  maximumRatingChange: 0,
};

const sortPlayers = <
  T extends { currentRating: number; first: string; last: string },
>(
  left: T,
  right: T,
) =>
  right.currentRating - left.currentRating ||
  `${left.last},${left.first}`.localeCompare(
    `${right.last},${right.first}`,
  );

export const loadRosterProgression = async () => {
  const { league, players } = await loadLeaguePlayersSnapshot();

  const envelope = buildLeagueNavigationEnvelope(league);
  const { team } = envelope;
  if (league.info.stage !== 'progression') {
    return {
      ...envelope,
      returning: [] as ReturningPlayerPreview[],
      departing: [] as DepartingPlayerPreview[],
      positions: [] as string[],
      summary: { ...EMPTY_SUMMARY },
    };
  }

  const teamPlayers = players.filter(
    player => player.teamId === team.id,
  );
  const returning: ReturningPlayerPreview[] = [];
  const departing: DepartingPlayerPreview[] = [];

  teamPlayers.forEach(player => {
    const projection = projectPlayerProgression(player);
    if (!projection) return;

    if (projection.status === 'departing') {
      departing.push({
        id: player.id,
        first: player.first,
        last: player.last,
        position: player.pos,
        currentClass: 'sr',
        currentRating: player.rating,
      });
      return;
    }

    returning.push({
      id: player.id,
      first: player.first,
      last: player.last,
      position: player.pos,
      currentClass: player.year,
      projectedClass: projection.projectedClass,
      currentRating: player.rating,
      projectedRating: projection.projectedRating,
      ratingChange: projection.projectedRating - player.rating,
    });
  });

  returning.sort(sortPlayers);
  departing.sort(sortPlayers);

  const positionSet = new Set(
    [...returning, ...departing].map(player => player.position),
  );
  const positions = [
    ...POSITION_ORDER.filter(position => positionSet.has(position)),
    ...Array.from(positionSet)
      .filter(position => !POSITION_ORDER.includes(position))
      .sort((left, right) => left.localeCompare(right)),
  ];
  const totalRatingChange = returning.reduce(
    (sum, player) => sum + player.ratingChange,
    0,
  );

  return {
    ...envelope,
    returning,
    departing,
    positions,
    summary: {
      returningPlayers: returning.length,
      departingSeniors: departing.length,
      averageRatingChange: returning.length
        ? Math.round(totalRatingChange / returning.length)
        : 0,
      maximumRatingChange: returning.length
        ? Math.max(...returning.map(player => player.ratingChange))
        : 0,
    } satisfies RosterProgressionSummary,
  };
};
