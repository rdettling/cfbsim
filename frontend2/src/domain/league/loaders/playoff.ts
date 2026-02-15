import type { Team } from '../../../types/domain';
import type { GameRecord } from '../../../types/db';
import type { LeagueState } from '../../../types/league';
import { getAllGames, getGameById } from '../../../db/simRepo';
import { loadLeagueOrThrow } from '../leagueStore';
import { DEFAULT_SETTINGS } from '../../../types/league';
import { REGULAR_SEASON_WEEKS } from '../postseason';

type PlayoffTeamEntry = {
  name: string;
  seed: number;
  ranking: number;
  conference: string;
  record: string;
  is_autobid: boolean;
};

type BubbleTeamEntry = {
  name: string;
  ranking: number;
  conference: string;
  record: string;
};

type ConferenceChampionEntry = {
  name: string;
  ranking: number;
  conference: string;
  record: string;
  seed: number | null;
};

const formatRecord = (team: Team) =>
  `${team.totalWins}-${team.totalLosses} (${team.confWins}-${team.confLosses})`;

const sortConferenceTeams = (teams: Team[]) =>
  teams.slice().sort((a, b) => {
    const aGames = a.confWins + a.confLosses;
    const bGames = b.confWins + b.confLosses;
    const aPct = aGames ? a.confWins / aGames : 0;
    const bPct = bGames ? b.confWins / bGames : 0;
    if (bPct !== aPct) return bPct - aPct;
    if (b.confWins !== a.confWins) return b.confWins - a.confWins;
    if (a.confLosses !== b.confLosses) return a.confLosses - b.confLosses;
    if (a.ranking !== b.ranking) return a.ranking - b.ranking;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return a.totalLosses - b.totalLosses;
  });

const getConferenceChampion = async (
  league: LeagueState,
  conferenceName: string
) => {
  const conference = league.conferences.find(conf => conf.confName === conferenceName);
  if (!conference || conference.confName === 'Independent') return null;

  if (conference.championship) {
    const game = await getGameById(conference.championship);
    if (game?.winnerId) {
      return league.teams.find(team => team.id === game.winnerId) ?? null;
    }
  }

  const conferenceTeams = league.teams.filter(team => team.conference === conferenceName);
  const sorted = sortConferenceTeams(conferenceTeams);
  return sorted[0] ?? null;
};

const getPlayoffTeamOrder = async (league: LeagueState) => {
  const playoffAutobids = league.settings?.playoff_autobids ?? DEFAULT_SETTINGS.playoff_autobids ?? 0;
  const playoffConfChampTop4 =
    league.settings?.playoff_conf_champ_top_4 ?? DEFAULT_SETTINGS.playoff_conf_champ_top_4 ?? false;

  const conferenceNames = league.conferences
    .map(conf => conf.confName)
    .filter(confName => confName !== 'Independent');

  const champions: Team[] = [];
  for (const confName of conferenceNames) {
    const champion = await getConferenceChampion(league, confName);
    if (champion) champions.push(champion);
  }

  champions.sort((a, b) => a.ranking - b.ranking);

  const autobids = champions.slice(0, playoffAutobids);
  const autobidIds = new Set(autobids.map(team => team.id));
  const wildCards = league.teams
    .filter(team => !autobidIds.has(team.id))
    .sort((a, b) => a.ranking - b.ranking);

  const cutoff = 8 - (playoffAutobids - 4);
  const nonPlayoffTeams = wildCards.slice(cutoff);
  const wildCardPool = wildCards.slice(0, cutoff);

  let byes: Team[] = [];
  let remainingAutobids: Team[] = [];
  let remainingWildCards: Team[] = [];

  if (playoffConfChampTop4) {
    byes = autobids.slice(0, 4);
    remainingAutobids = autobids.slice(4);
    remainingWildCards = wildCardPool.slice();
  } else {
    const allCandidates = [...autobids, ...wildCardPool].sort((a, b) => a.ranking - b.ranking);
    byes = allCandidates.slice(0, 4);
    const byeIds = new Set(byes.map(team => team.id));
    remainingAutobids = autobids.filter(team => !byeIds.has(team.id));
    remainingWildCards = wildCardPool.filter(team => !byeIds.has(team.id));
  }

  const seededRest = [...remainingWildCards, ...remainingAutobids].sort((a, b) => a.ranking - b.ranking);
  return { order: [...byes, ...seededRest, ...nonPlayoffTeams], autobidIds };
};

const buildGameResult = (
  game: GameRecord | null,
  team1Name: string,
  team2Name: string,
  getSeed: (name: string) => number | null,
  teamsById: Map<number, Team>,
  isProjection: boolean
) => {
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
    ? game.winnerId === teamA.id
      ? teamA.name
      : teamB.name
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

const buildBracket = async (
  league: LeagueState,
  playoffTeams: Team[],
  isProjection: boolean
) => {
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const gameOrNull = async (id?: number) => (id ? (await getGameById(id)) ?? null : null);
  const getSeed = (name: string) => {
    const index = playoffTeams.findIndex(team => team.name === name);
    return index >= 0 ? index + 1 : null;
  };

  const format = league.settings?.playoff_teams ?? DEFAULT_SETTINGS.playoff_teams;
  const playoffState = league.playoff ?? { seeds: [] };

  if (format === 2) {
    const natty = await gameOrNull(playoffState.natty);
    const team1 = playoffTeams[0]?.name ?? 'TBD';
    const team2 = playoffTeams[1]?.name ?? 'TBD';
    return { championship: buildGameResult(natty, team1, team2, getSeed, teamsById, isProjection) };
  }

  if (format === 4) {
    const leftSemi = await gameOrNull(playoffState.left_semi);
    const rightSemi = await gameOrNull(playoffState.right_semi);
    const natty = await gameOrNull(playoffState.natty);

    const team1Semi1 = playoffTeams[0]?.name ?? 'TBD';
    const team2Semi1 = playoffTeams[3]?.name ?? 'TBD';
    const team1Semi2 = playoffTeams[1]?.name ?? 'TBD';
    const team2Semi2 = playoffTeams[2]?.name ?? 'TBD';

    const team1Champ = leftSemi?.winnerId ? teamsById.get(leftSemi.winnerId)?.name ?? 'TBD' : 'TBD';
    const team2Champ = rightSemi?.winnerId ? teamsById.get(rightSemi.winnerId)?.name ?? 'TBD' : 'TBD';

    return {
      semifinals: [
        buildGameResult(leftSemi, team1Semi1, team2Semi1, getSeed, teamsById, isProjection),
        buildGameResult(rightSemi, team1Semi2, team2Semi2, getSeed, teamsById, isProjection),
      ],
      championship: buildGameResult(natty, team1Champ, team2Champ, getSeed, teamsById, isProjection),
    };
  }

  // 12-team playoff
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

  const team1LeftR1_1 = playoffTeams[7]?.name ?? 'TBD';
  const team2LeftR1_1 = playoffTeams[8]?.name ?? 'TBD';
  const team1LeftR1_2 = playoffTeams[4]?.name ?? 'TBD';
  const team2LeftR1_2 = playoffTeams[11]?.name ?? 'TBD';
  const team1RightR1_1 = playoffTeams[6]?.name ?? 'TBD';
  const team2RightR1_1 = playoffTeams[9]?.name ?? 'TBD';
  const team1RightR1_2 = playoffTeams[5]?.name ?? 'TBD';
  const team2RightR1_2 = playoffTeams[10]?.name ?? 'TBD';

  const team1LeftQuarter1 = playoffTeams[0]?.name ?? 'TBD';
  const team2LeftQuarter1 = leftR1_1?.winnerId ? teamsById.get(leftR1_1.winnerId)?.name ?? 'TBD' : 'Winner of left_r1_1';
  const team1LeftQuarter2 = playoffTeams[3]?.name ?? 'TBD';
  const team2LeftQuarter2 = leftR1_2?.winnerId ? teamsById.get(leftR1_2.winnerId)?.name ?? 'TBD' : 'Winner of left_r1_2';
  const team1RightQuarter1 = playoffTeams[1]?.name ?? 'TBD';
  const team2RightQuarter1 = rightR1_1?.winnerId ? teamsById.get(rightR1_1.winnerId)?.name ?? 'TBD' : 'Winner of right_r1_1';
  const team1RightQuarter2 = playoffTeams[2]?.name ?? 'TBD';
  const team2RightQuarter2 = rightR1_2?.winnerId ? teamsById.get(rightR1_2.winnerId)?.name ?? 'TBD' : 'Winner of right_r1_2';

  const team1LeftSemi = leftQuarter1?.winnerId ? teamsById.get(leftQuarter1.winnerId)?.name ?? 'TBD' : 'Winner of left_quarter_1';
  const team2LeftSemi = leftQuarter2?.winnerId ? teamsById.get(leftQuarter2.winnerId)?.name ?? 'TBD' : 'Winner of left_quarter_2';
  const team1RightSemi = rightQuarter1?.winnerId ? teamsById.get(rightQuarter1.winnerId)?.name ?? 'TBD' : 'Winner of right_quarter_1';
  const team2RightSemi = rightQuarter2?.winnerId ? teamsById.get(rightQuarter2.winnerId)?.name ?? 'TBD' : 'Winner of right_quarter_2';

  const team1Champ = leftSemi?.winnerId ? teamsById.get(leftSemi.winnerId)?.name ?? 'TBD' : 'Winner of left_semi';
  const team2Champ = rightSemi?.winnerId ? teamsById.get(rightSemi.winnerId)?.name ?? 'TBD' : 'Winner of right_semi';

  return {
    left_bracket: {
      first_round: [
        {
          id: 'left_r1_1',
          ...buildGameResult(leftR1_1, team1LeftR1_1, team2LeftR1_1, getSeed, teamsById, isProjection),
          next_game: 'left_quarter_1',
        },
        {
          id: 'left_r1_2',
          ...buildGameResult(leftR1_2, team1LeftR1_2, team2LeftR1_2, getSeed, teamsById, isProjection),
          next_game: 'left_quarter_2',
        },
      ],
      quarterfinals: [
        {
          id: 'left_quarter_1',
          ...buildGameResult(leftQuarter1, team1LeftQuarter1, team2LeftQuarter1, getSeed, teamsById, isProjection),
          next_game: 'left_semi',
        },
        {
          id: 'left_quarter_2',
          ...buildGameResult(leftQuarter2, team1LeftQuarter2, team2LeftQuarter2, getSeed, teamsById, isProjection),
          next_game: 'left_semi',
        },
      ],
      semifinal: {
        id: 'left_semi',
        ...buildGameResult(leftSemi, team1LeftSemi, team2LeftSemi, getSeed, teamsById, isProjection),
        next_game: 'championship',
      },
    },
    right_bracket: {
      first_round: [
        {
          id: 'right_r1_1',
          ...buildGameResult(rightR1_1, team1RightR1_1, team2RightR1_1, getSeed, teamsById, isProjection),
          next_game: 'right_quarter_1',
        },
        {
          id: 'right_r1_2',
          ...buildGameResult(rightR1_2, team1RightR1_2, team2RightR1_2, getSeed, teamsById, isProjection),
          next_game: 'right_quarter_2',
        },
      ],
      quarterfinals: [
        {
          id: 'right_quarter_1',
          ...buildGameResult(rightQuarter1, team1RightQuarter1, team2RightQuarter1, getSeed, teamsById, isProjection),
          next_game: 'right_semi',
        },
        {
          id: 'right_quarter_2',
          ...buildGameResult(rightQuarter2, team1RightQuarter2, team2RightQuarter2, getSeed, teamsById, isProjection),
          next_game: 'right_semi',
        },
      ],
      semifinal: {
        id: 'right_semi',
        ...buildGameResult(rightSemi, team1RightSemi, team2RightSemi, getSeed, teamsById, isProjection),
        next_game: 'championship',
      },
    },
    championship: {
      id: 'championship',
      ...buildGameResult(natty, team1Champ, team2Champ, getSeed, teamsById, isProjection),
    },
  };
};

export const loadPlayoff = async () => {
  const league = await loadLeagueOrThrow();
  const format = league.settings?.playoff_teams ?? DEFAULT_SETTINGS.playoff_teams;
  const isProjection = league.info.currentWeek < REGULAR_SEASON_WEEKS;

  const conferenceNames = league.conferences
    .map(conf => conf.confName)
    .filter(confName => confName !== 'Independent');
  const champions: Team[] = [];
  for (const confName of conferenceNames) {
    const champion = await getConferenceChampion(league, confName);
    if (champion) champions.push(champion);
  }
  champions.sort((a, b) => a.ranking - b.ranking);

  let playoffTeams: Team[] = [];
  let autobidIds = new Set<number>();

  if (format === 2) {
    playoffTeams = league.teams.slice().sort((a, b) => a.ranking - b.ranking).slice(0, 2);
  } else if (format === 4) {
    playoffTeams = league.teams.slice().sort((a, b) => a.ranking - b.ranking).slice(0, 4);
  } else {
    const ordered = await getPlayoffTeamOrder(league);
    playoffTeams = ordered.order.slice(0, 12);
    autobidIds = ordered.autobidIds;
  }

  const bubbleStart = format === 2 ? 2 : format === 4 ? 4 : 12;
  const bubbleTeams = league.teams
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .slice(bubbleStart, bubbleStart + 5);

  const playoff_teams: PlayoffTeamEntry[] = playoffTeams.map((team, index) => ({
    name: team.name,
    seed: index + 1,
    ranking: team.ranking,
    conference: team.conference ?? 'Independent',
    record: formatRecord(team),
    is_autobid: autobidIds.has(team.id),
  }));

  const bubble_teams: BubbleTeamEntry[] = bubbleTeams.map(team => ({
    name: team.name,
    ranking: team.ranking,
    conference: team.conference ?? 'Independent',
    record: formatRecord(team),
  }));

  const conference_champions: ConferenceChampionEntry[] = champions.map(team => ({
    name: team.name,
    ranking: team.ranking,
    conference: team.conference ?? 'Independent',
    record: formatRecord(team),
    seed: playoff_teams.find(entry => entry.name === team.name)?.seed ?? null,
  }));

  const bracket = await buildBracket(league, playoffTeams, isProjection);

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    playoff: {
      teams: format,
      autobids: league.settings?.playoff_autobids ?? DEFAULT_SETTINGS.playoff_autobids ?? 0,
      conf_champ_top_4:
        league.settings?.playoff_conf_champ_top_4 ?? DEFAULT_SETTINGS.playoff_conf_champ_top_4 ?? false,
    },
    playoff_teams,
    bubble_teams,
    conference_champions,
    bracket,
    is_projection: isProjection,
  };
};
