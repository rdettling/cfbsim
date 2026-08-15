import { getGameById } from '../../../../db/simRepo';
import type { GameRecord } from '../../../../types/db';
import type { Team } from '../../../../types/domain';
import type { LeagueState } from '../../../../types/league';
import type { PlayoffBracket, PlayoffMatchup } from '../../../../types/postseason';

const buildGameResult = (
  game: GameRecord | null,
  team1Name: string,
  team2Name: string,
  getSeed: (name: string) => number | null,
  teamsById: Map<number, Team>,
  isProjection: boolean,
): PlayoffMatchup => {
  if (!game || isProjection) {
    return {
      team1: team1Name,
      team2: team2Name,
      seed1: getSeed(team1Name),
      seed2: getSeed(team2Name),
      score1: null,
      score2: null,
      winner: null,
    };
  }

  const teamA = teamsById.get(game.teamAId);
  const teamB = teamsById.get(game.teamBId);
  if (!teamA || !teamB) {
    return {
      team1: team1Name,
      team2: team2Name,
      seed1: getSeed(team1Name),
      seed2: getSeed(team2Name),
      score1: null,
      score2: null,
      winner: null,
    };
  }

  const team1IsA = teamA.name === team1Name;
  const score1 = team1IsA ? game.scoreA : game.scoreB;
  const score2 = team1IsA ? game.scoreB : game.scoreA;
  const winnerName = game.winnerId
    ? game.winnerId === teamA.id ? teamA.name : teamB.name
    : null;

  return {
    game_id: game.id,
    team1: team1IsA ? teamA.name : teamB.name,
    team2: team1IsA ? teamB.name : teamA.name,
    seed1: getSeed(team1IsA ? teamA.name : teamB.name),
    seed2: getSeed(team1IsA ? teamB.name : teamA.name),
    score1: game.winnerId ? score1 : null,
    score2: game.winnerId ? score2 : null,
    winner: winnerName,
  };
};

export const buildBracket = async (
  league: LeagueState,
  playoffTeams: Team[],
  isProjection: boolean,
): Promise<PlayoffBracket> => {
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const gameOrNull = async (id?: number) => (id ? (await getGameById(id)) ?? null : null);
  const getSeed = (name: string) => {
    const index = playoffTeams.findIndex(team => team.name === name);
    return index >= 0 ? index + 1 : null;
  };
  const format = league.settings.playoffTeams;
  const playoffState = league.playoff;

  if (format === 2) {
    const natty = await gameOrNull(playoffState.natty);
    const team1 = playoffTeams[0]?.name ?? 'TBD';
    const team2 = playoffTeams[1]?.name ?? 'TBD';
    return {
      championship: buildGameResult(natty, team1, team2, getSeed, teamsById, isProjection),
    };
  }

  if (format === 4) {
    const leftSemi = await gameOrNull(playoffState.left_semi);
    const rightSemi = await gameOrNull(playoffState.right_semi);
    const natty = await gameOrNull(playoffState.natty);
    const team1Champ = leftSemi?.winnerId
      ? teamsById.get(leftSemi.winnerId)?.name ?? 'TBD'
      : 'TBD';
    const team2Champ = rightSemi?.winnerId
      ? teamsById.get(rightSemi.winnerId)?.name ?? 'TBD'
      : 'TBD';

    return {
      semifinals: [
        buildGameResult(
          leftSemi,
          playoffTeams[0]?.name ?? 'TBD',
          playoffTeams[3]?.name ?? 'TBD',
          getSeed,
          teamsById,
          isProjection,
        ),
        buildGameResult(
          rightSemi,
          playoffTeams[1]?.name ?? 'TBD',
          playoffTeams[2]?.name ?? 'TBD',
          getSeed,
          teamsById,
          isProjection,
        ),
      ],
      championship: buildGameResult(
        natty,
        team1Champ,
        team2Champ,
        getSeed,
        teamsById,
        isProjection,
      ),
    };
  }

  const leftR1_1 = await gameOrNull(playoffState.left_r1_1);
  const leftR1_2 = await gameOrNull(playoffState.left_r1_2);
  const rightR1_1 = await gameOrNull(playoffState.right_r1_1);
  const rightR1_2 = await gameOrNull(playoffState.right_r1_2);
  const leftQuarter1 = await gameOrNull(playoffState.left_quarter_1);
  const leftQuarter2 = await gameOrNull(playoffState.left_quarter_2);
  const rightQuarter1 = await gameOrNull(playoffState.right_quarter_1);
  const rightQuarter2 = await gameOrNull(playoffState.right_quarter_2);
  const leftSemi = await gameOrNull(playoffState.left_semi);
  const rightSemi = await gameOrNull(playoffState.right_semi);
  const natty = await gameOrNull(playoffState.natty);

  const winnerName = (game: GameRecord | null, fallback: string) =>
    game?.winnerId ? teamsById.get(game.winnerId)?.name ?? 'TBD' : fallback;
  const result = (
    game: GameRecord | null,
    team1: string,
    team2: string,
  ) => buildGameResult(game, team1, team2, getSeed, teamsById, isProjection);

  const team1LeftQuarter1 = playoffTeams[0]?.name ?? 'TBD';
  const team2LeftQuarter1 = winnerName(leftR1_1, 'Winner of left_r1_1');
  const team1LeftQuarter2 = playoffTeams[3]?.name ?? 'TBD';
  const team2LeftQuarter2 = winnerName(leftR1_2, 'Winner of left_r1_2');
  const team1RightQuarter1 = playoffTeams[1]?.name ?? 'TBD';
  const team2RightQuarter1 = winnerName(rightR1_1, 'Winner of right_r1_1');
  const team1RightQuarter2 = playoffTeams[2]?.name ?? 'TBD';
  const team2RightQuarter2 = winnerName(rightR1_2, 'Winner of right_r1_2');
  const team1LeftSemi = winnerName(leftQuarter1, 'Winner of left_quarter_1');
  const team2LeftSemi = winnerName(leftQuarter2, 'Winner of left_quarter_2');
  const team1RightSemi = winnerName(rightQuarter1, 'Winner of right_quarter_1');
  const team2RightSemi = winnerName(rightQuarter2, 'Winner of right_quarter_2');

  return {
    left_bracket: {
      first_round: [
        {
          id: 'left_r1_1',
          ...result(leftR1_1, playoffTeams[7]?.name ?? 'TBD', playoffTeams[8]?.name ?? 'TBD'),
          next_game: 'left_quarter_1',
        },
        {
          id: 'left_r1_2',
          ...result(leftR1_2, playoffTeams[4]?.name ?? 'TBD', playoffTeams[11]?.name ?? 'TBD'),
          next_game: 'left_quarter_2',
        },
      ],
      quarterfinals: [
        {
          id: 'left_quarter_1',
          ...result(leftQuarter1, team1LeftQuarter1, team2LeftQuarter1),
          next_game: 'left_semi',
        },
        {
          id: 'left_quarter_2',
          ...result(leftQuarter2, team1LeftQuarter2, team2LeftQuarter2),
          next_game: 'left_semi',
        },
      ],
      semifinal: {
        id: 'left_semi',
        ...result(leftSemi, team1LeftSemi, team2LeftSemi),
        next_game: 'championship',
      },
    },
    right_bracket: {
      first_round: [
        {
          id: 'right_r1_1',
          ...result(rightR1_1, playoffTeams[6]?.name ?? 'TBD', playoffTeams[9]?.name ?? 'TBD'),
          next_game: 'right_quarter_1',
        },
        {
          id: 'right_r1_2',
          ...result(rightR1_2, playoffTeams[5]?.name ?? 'TBD', playoffTeams[10]?.name ?? 'TBD'),
          next_game: 'right_quarter_2',
        },
      ],
      quarterfinals: [
        {
          id: 'right_quarter_1',
          ...result(rightQuarter1, team1RightQuarter1, team2RightQuarter1),
          next_game: 'right_semi',
        },
        {
          id: 'right_quarter_2',
          ...result(rightQuarter2, team1RightQuarter2, team2RightQuarter2),
          next_game: 'right_semi',
        },
      ],
      semifinal: {
        id: 'right_semi',
        ...result(rightSemi, team1RightSemi, team2RightSemi),
        next_game: 'championship',
      },
    },
    championship: {
      id: 'championship',
      ...result(
        natty,
        winnerName(leftSemi, 'Winner of left_semi'),
        winnerName(rightSemi, 'Winner of right_semi'),
      ),
    },
  };
};
