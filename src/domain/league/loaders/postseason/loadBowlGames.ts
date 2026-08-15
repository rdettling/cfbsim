import { getAllGames } from '../../../../db/simRepo';
import type { BowlGameEntry } from '../../../../types/postseason';
import { REGULAR_SEASON_WEEKS } from '../../postseason';
import {
  buildBowlMatchups,
  isBowlName,
  isNy6Bowl,
} from '../../utils/bowlSelection';
import { formatPostseasonRecord, loadPostseasonContext } from './context';

const sortBowls = (left: BowlGameEntry, right: BowlGameEntry) => {
  if (left.is_ny6 !== right.is_ny6) return left.is_ny6 ? -1 : 1;
  return left.name.localeCompare(right.name);
};

export const loadBowlGames = async () => {
  const context = await loadPostseasonContext();
  const teamsById = new Map(context.league.teams.map(team => [team.id, team]));
  const championIds = new Set(context.champions.map(team => team.id));
  const championNames = new Set(context.champions.map(team => team.name));
  const allGames = await getAllGames();
  const bowl_games: BowlGameEntry[] = allGames
    .filter(game => game.year === context.league.info.currentYear)
    .filter(game => isBowlName(game.name))
    .sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''))
    .map(game => {
      const teamA = teamsById.get(game.teamAId);
      const teamB = teamsById.get(game.teamBId);
      return {
        id: game.id,
        name: game.name ?? 'Bowl',
        week: game.weekPlayed,
        teamA: teamA?.name ?? 'TBD',
        teamB: teamB?.name ?? 'TBD',
        teamA_conf: teamA?.conference ?? 'Independent',
        teamB_conf: teamB?.conference ?? 'Independent',
        teamA_is_champ: teamA ? championIds.has(teamA.id) : false,
        teamB_is_champ: teamB ? championIds.has(teamB.id) : false,
        rankA: teamA?.ranking ?? 0,
        rankB: teamB?.ranking ?? 0,
        recordA: teamA ? formatPostseasonRecord(teamA) : '0-0 (0-0)',
        recordB: teamB ? formatPostseasonRecord(teamB) : '0-0 (0-0)',
        scoreA: game.winnerId ? game.scoreA : null,
        scoreB: game.winnerId ? game.scoreB : null,
        winner: game.winnerId
          ? game.winnerId === game.teamAId ? teamA?.name ?? null : teamB?.name ?? null
          : null,
        is_ny6: isNy6Bowl(game.name),
        is_projection: false,
      };
    });

  const projectedMatchups = buildBowlMatchups({
    teams: context.league.teams,
    playoffTeamIds: new Set(context.playoffTeams.map(team => team.id)),
    year: context.league.info.currentYear,
    playoffTeams: context.format,
    requireEligibility: !context.isProjection,
  });
  const bowl_projections: BowlGameEntry[] = projectedMatchups.map((matchup, index) => ({
    id: -1 - index,
    name: matchup.name,
    week: REGULAR_SEASON_WEEKS + 2,
    teamA: matchup.teamA.name,
    teamB: matchup.teamB.name,
    teamA_conf: matchup.teamA.conference ?? 'Independent',
    teamB_conf: matchup.teamB.conference ?? 'Independent',
    teamA_is_champ: championNames.has(matchup.teamA.name),
    teamB_is_champ: championNames.has(matchup.teamB.name),
    rankA: matchup.teamA.ranking,
    rankB: matchup.teamB.ranking,
    recordA: formatPostseasonRecord(matchup.teamA),
    recordB: formatPostseasonRecord(matchup.teamB),
    scoreA: null,
    scoreB: null,
    winner: null,
    is_ny6: isNy6Bowl(matchup.name),
    is_projection: true,
  }));

  return {
    ...context.page,
    bowl_games: bowl_games.sort(sortBowls),
    bowl_projections: bowl_projections.sort(sortBowls),
  };
};
