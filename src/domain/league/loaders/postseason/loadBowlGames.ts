import type { GameRecord } from '../../../../types/db';
import type { PlayoffTeamCount, Team } from '../../../../types/domain';
import type { BowlGameEntry, BowlTeamEntry } from '../../../../types/postseason';
import { buildOddsFields, favoriteSpread, loadOddsContext } from '../../../odds';
import {
  buildBowlMatchups,
  isBowlName,
  isNy6Bowl,
} from '../../utils/bowlSelection';
import { formatPostseasonRecord, loadPostseasonContext } from './context';

const isIncludedGame = (game: GameRecord, playoffTeams: PlayoffTeamCount) =>
  isBowlName(game.name) ||
  (playoffTeams === 2
    ? game.gameType === 'national_championship'
    : playoffTeams === 4 &&
      (game.gameType === 'playoff_semifinal' ||
        game.gameType === 'national_championship'));

const gameDisplayName = (game: GameRecord) => {
  if (game.gameType === 'playoff_semifinal') return 'Playoff Semifinal';
  if (game.gameType === 'national_championship') return 'National Championship';
  return game.name ?? 'Bowl';
};

const bowlTier = (
  name: string | null,
  isPlayoff: boolean,
): BowlGameEntry['tier'] => {
  if (isPlayoff) return 'playoff';
  return isNy6Bowl(name) ? 'ny6' : 'other';
};

const buildTeamEntry = ({
  team,
  isConferenceChampion,
  ranking,
  spread,
  score,
  isWinner,
}: {
  team: Team | undefined;
  isConferenceChampion: boolean;
  ranking: number | null;
  spread: string | null;
  score: number | null;
  isWinner: boolean;
}): BowlTeamEntry => ({
  name: team?.name ?? 'TBD',
  conference: team?.conference ?? 'Independent',
  isConferenceChampion,
  ranking,
  record: team ? formatPostseasonRecord(team) : '0-0 (0-0)',
  spread,
  score,
  isWinner,
});

export const loadBowlGames = async () => {
  const context = await loadPostseasonContext();
  const teamsById = new Map(context.league.teams.map(team => [team.id, team]));
  const championIds = new Set(context.champions.map(team => team.id));
  const actualGames: BowlGameEntry[] = context.games
    .filter(game => game.year === context.league.info.currentYear)
    .filter(game => isIncludedGame(game, context.format))
    .map(game => {
      const teamA = teamsById.get(game.teamAId);
      const teamB = teamsById.get(game.teamBId);
      const isFinal = game.winnerId !== null;
      const isPlayoff = !isBowlName(game.name);
      return {
        gameId: game.id,
        name: gameDisplayName(game),
        status: isFinal ? 'final' : 'scheduled',
        tier: bowlTier(game.name, isPlayoff),
        teams: [
          buildTeamEntry({
            team: teamA,
            isConferenceChampion: teamA ? championIds.has(teamA.id) : false,
            ranking: teamA?.ranking ?? null,
            spread: isFinal ? null : favoriteSpread(game.spreadA),
            score: isFinal ? game.scoreA : null,
            isWinner: game.winnerId === game.teamAId,
          }),
          buildTeamEntry({
            team: teamB,
            isConferenceChampion: teamB ? championIds.has(teamB.id) : false,
            ranking: teamB?.ranking ?? null,
            spread: isFinal ? null : favoriteSpread(game.spreadB),
            score: isFinal ? game.scoreB : null,
            isWinner: game.winnerId === game.teamBId,
          }),
        ],
      };
    });

  if (actualGames.length > 0) {
    return { ...context.navigation, games: actualGames };
  }

  const projectedBowls = buildBowlMatchups({
    teams: context.league.teams,
    playoffTeamIds: new Set(context.playoffTeams.map(team => team.id)),
    year: context.league.info.currentYear,
    playoffTeams: context.format,
    requireEligibility: !context.isProjection,
  });
  const projectedPlayoffGames = context.format === 2
    ? [{
        name: 'National Championship',
        teamA: context.playoffTeams[0],
        teamB: context.playoffTeams[1],
      }]
    : context.format === 4
      ? [
          {
            name: 'Playoff Semifinal',
            teamA: context.playoffTeams[0],
            teamB: context.playoffTeams[3],
          },
          {
            name: 'Playoff Semifinal',
            teamA: context.playoffTeams[1],
            teamB: context.playoffTeams[2],
          },
        ]
      : [];
  const projectedMatchups = [
    ...projectedPlayoffGames
      .filter((matchup): matchup is { name: string; teamA: Team; teamB: Team } =>
        Boolean(matchup.teamA && matchup.teamB))
      .map(matchup => ({ ...matchup, tier: 'playoff' as const })),
    ...projectedBowls.map(matchup => ({
      ...matchup,
      tier: bowlTier(matchup.name, false),
    })),
  ];
  const oddsContext = await loadOddsContext();
  const games: BowlGameEntry[] = projectedMatchups.map(matchup => {
    const projectedOdds = buildOddsFields(
      matchup.teamA,
      matchup.teamB,
      null,
      true,
      oddsContext,
    );
    return {
      gameId: null,
      name: matchup.name,
      status: 'projected',
      tier: matchup.tier,
      teams: [
        buildTeamEntry({
          team: matchup.teamA,
          isConferenceChampion: championIds.has(matchup.teamA.id),
          ranking: matchup.teamA.ranking,
          spread: favoriteSpread(projectedOdds.spreadA),
          score: null,
          isWinner: false,
        }),
        buildTeamEntry({
          team: matchup.teamB,
          isConferenceChampion: championIds.has(matchup.teamB.id),
          ranking: matchup.teamB.ranking,
          spread: favoriteSpread(projectedOdds.spreadB),
          score: null,
          isWinner: false,
        }),
      ],
    };
  });

  return { ...context.navigation, games };
};
