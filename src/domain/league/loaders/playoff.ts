import type { Team } from '../../../types/domain';
import type { GameRecord } from '../../../types/db';
import type { LeagueState } from '../../../types/league';
import { getAllGames, getGameById } from '../../../db/simRepo';
import { loadLeagueOrThrow } from '../leagueStore';
import { REGULAR_SEASON_WEEKS } from '../postseason';
import { loadOddsContext } from '../../odds';
import { buildPlayoffSelection } from '../utils/playoffSelection';
import { buildResumeComparisonTeams } from '../utils/resumeComparison';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

export type PlayoffTeamEntry = {
  name: string;
  seed: number;
  ranking: number;
  conference: string;
  record: string;
  is_autobid: boolean;
};

export type BubbleTeamEntry = {
  name: string;
  ranking: number;
  conference: string;
  record: string;
};

export type ResumeResultEntry = {
  opponent: string;
  opponent_ranking: number;
};

export type ResumeTeamEntry = {
  name: string;
  ranking: number;
  conference: string;
  record: string;
  poll_score: number;
  sor_rank: number;
  sos_rank: number | null;
  top_25_record: string;
  best_win: ResumeResultEntry | null;
  worst_loss: ResumeResultEntry | null;
  seed: number | null;
  is_autobid: boolean;
  has_bye: boolean;
  is_champ: boolean;
};

export type ConferenceChampionEntry = {
  name: string;
  ranking: number;
  conference: string;
  record: string;
  seed: number | null;
};

export type BowlGameEntry = {
  id: number;
  name: string;
  week: number;
  teamA: string;
  teamB: string;
  teamA_conf: string;
  teamB_conf: string;
  teamA_is_champ: boolean;
  teamB_is_champ: boolean;
  rankA: number;
  rankB: number;
  recordA: string;
  recordB: string;
  scoreA: number | null;
  scoreB: number | null;
  winner: string | null;
  is_ny6: boolean;
  is_projection: boolean;
};

export type PlayoffMatchup = {
  id?: string;
  next_game?: string;
  game_id?: number;
  team1: string;
  team2: string;
  seed1: number | null;
  seed2: number | null;
  score1: number | null;
  score2: number | null;
  winner: string | null;
};

export type TwoTeamPlayoffBracket = {
  championship: PlayoffMatchup;
};

export type FourTeamPlayoffBracket = {
  semifinals: PlayoffMatchup[];
  championship: PlayoffMatchup;
};

type TwelveTeamBracketSide = {
  first_round: PlayoffMatchup[];
  quarterfinals: PlayoffMatchup[];
  semifinal: PlayoffMatchup;
};

export type TwelveTeamPlayoffBracket = {
  left_bracket: TwelveTeamBracketSide;
  right_bracket: TwelveTeamBracketSide;
  championship: PlayoffMatchup;
};

export type PlayoffBracket =
  | TwoTeamPlayoffBracket
  | FourTeamPlayoffBracket
  | TwelveTeamPlayoffBracket;

const NY6_BOWLS = [
  'Rose Bowl',
  'Sugar Bowl',
  'Orange Bowl',
  'Cotton Bowl',
  'Fiesta Bowl',
  'Peach Bowl',
] as const;

const AT_LARGE_BOWLS = [
  'Alamo Bowl',
  'Citrus Bowl',
  'Holiday Bowl',
  'Gator Bowl',
  'Sun Bowl',
  'Liberty Bowl',
  'Las Vegas Bowl',
  'Music City Bowl',
  'Texas Bowl',
  'Pinstripe Bowl',
  'Camping World Bowl',
  'Cheez-It Bowl',
  'Outback Bowl',
  "Duke's Mayo Bowl",
  'ReliaQuest Bowl',
] as const;

const ALL_BOWLS = new Set<string>([...NY6_BOWLS, ...AT_LARGE_BOWLS].map(name => name.toLowerCase()));

const isBowlName = (name?: string | null) => {
  if (!name) return false;
  return ALL_BOWLS.has(name.toLowerCase());
};

const ROTATION_SEMIS: Array<[typeof NY6_BOWLS[number], typeof NY6_BOWLS[number]]> = [
  ['Rose Bowl', 'Sugar Bowl'],
  ['Orange Bowl', 'Cotton Bowl'],
  ['Fiesta Bowl', 'Peach Bowl'],
];

const getNy6PlayoffHosts = (year: number, playoffTeams: number) => {
  if (playoffTeams === 2) {
    return { semis: [] as string[], quarters: [] as string[] };
  }
  const rotationIndex = Math.abs(year) % ROTATION_SEMIS.length;
  const semis = ROTATION_SEMIS[rotationIndex].slice();
  if (playoffTeams === 4) {
    return { semis, quarters: [] as string[] };
  }
  const quarters = NY6_BOWLS.filter(bowl => !semis.includes(bowl));
  return { semis, quarters };
};

const pickBestTeam = (
  teams: Team[],
  usedIds: Set<number>,
  predicate: (team: Team) => boolean
) => {
  const team = teams.find(entry => !usedIds.has(entry.id) && predicate(entry));
  if (!team) return null;
  usedIds.add(team.id);
  return team;
};

const buildBowlProjections = (
  league: LeagueState,
  playoffTeamIds: Set<number>,
  ny6Available: string[],
  requireEligibility: boolean
) => {
  const eligible = league.teams
    .filter(team => !playoffTeamIds.has(team.id))
    .filter(team => !requireEligibility || team.totalWins >= 6)
    .slice()
    .sort((a, b) => a.ranking - b.ranking);
  const usedIds = new Set<number>();

  const takeBest = () => pickBestTeam(eligible, usedIds, () => true);
  const takeConf = (confName: string) =>
    pickBestTeam(eligible, usedIds, team => team.conference === confName);

  const matchups: Array<{ name: string; teamA: Team; teamB: Team }> = [];

  if (ny6Available.includes('Rose Bowl')) {
    const teamA = takeConf('Big Ten') ?? takeBest();
    const teamB = takeConf('Pac-12') ?? takeBest();
    if (teamA && teamB) matchups.push({ name: 'Rose Bowl', teamA, teamB });
  }

  if (ny6Available.includes('Sugar Bowl')) {
    const teamA = takeConf('SEC') ?? takeBest();
    const teamB = takeConf('Big 12') ?? takeBest();
    if (teamA && teamB) matchups.push({ name: 'Sugar Bowl', teamA, teamB });
  }

  if (ny6Available.includes('Orange Bowl')) {
    const teamA = takeConf('ACC') ?? takeBest();
    const teamB = takeBest();
    if (teamA && teamB) matchups.push({ name: 'Orange Bowl', teamA, teamB });
  }

  const atLargeNy6 = ['Cotton Bowl', 'Fiesta Bowl', 'Peach Bowl'];
  atLargeNy6.forEach(bowl => {
    if (!ny6Available.includes(bowl)) return;
    const teamA = takeBest();
    const teamB = takeBest();
    if (teamA && teamB) matchups.push({ name: bowl, teamA, teamB });
  });

  for (const bowl of AT_LARGE_BOWLS) {
    const teamA = takeBest();
    const teamB = takeBest();
    if (!teamA || !teamB) break;
    matchups.push({ name: bowl, teamA, teamB });
  }

  return matchups;
};

const sortBowls = (a: BowlGameEntry, b: BowlGameEntry) => {
  if (a.is_ny6 !== b.is_ny6) return a.is_ny6 ? -1 : 1;
  return a.name.localeCompare(b.name);
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

const buildGameResult = (
  game: GameRecord | null,
  team1Name: string,
  team2Name: string,
  getSeed: (name: string) => number | null,
  teamsById: Map<number, Team>,
  isProjection: boolean
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

const loadPostseasonContext = async (loadedLeague?: LeagueState) => {
  const league = loadedLeague ?? await loadLeagueOrThrow();
  const format = league.settings.playoffTeams;
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const persistedTeams = league.playoff.seeds
    .map(id => teamsById.get(id))
    .filter((team): team is Team => Boolean(team));
  const hasPersistedField =
    league.playoff.seeds.length === format && persistedTeams.length === format;
  const isProjection = !hasPersistedField;

  const conferenceNames = league.conferences
    .map(conf => conf.confName)
    .filter(confName => confName !== 'Independent');
  const champions: Team[] = [];
  for (const confName of conferenceNames) {
    const champion = await getConferenceChampion(league, confName);
    if (champion) champions.push(champion);
  }
  champions.sort((a, b) => a.ranking - b.ranking);

  const selection = buildPlayoffSelection(league, champions);
  const projectedTeams = selection.order.slice(0, format);
  const autobidIds = selection.autobidIds;

  const playoffTeams = hasPersistedField ? persistedTeams : projectedTeams;

  const playoff_teams: PlayoffTeamEntry[] = playoffTeams.map((team, index) => ({
    name: team.name,
    seed: index + 1,
    ranking: team.ranking,
    conference: team.conference ?? 'Independent',
    record: formatRecord(team),
    is_autobid: autobidIds.has(team.id),
  }));

  return {
    league,
    format,
    isProjection,
    champions,
    selection,
    playoffTeams,
    playoff_teams,
    page: {
      ...buildLeagueNavigationEnvelope(league),
      playoff: {
        teams: format,
        autobids: league.settings.playoffAutobids,
        conf_champ_top_4: league.settings.conferenceChampionsReceiveTopSeeds,
      },
      is_projection: isProjection,
    },
  };
};

export const loadPlayoffBracket = async () => {
  const context = await loadPostseasonContext();
  return {
    ...context.page,
    playoff_teams: context.playoff_teams,
    bracket: await buildBracket(
      context.league,
      context.playoffTeams,
      context.isProjection
    ),
  };
};

export const loadPlayoffPicture = async () => {
  const context = await loadPostseasonContext();
  const selectedIds = new Set(context.playoffTeams.map(team => team.id));
  const bubble_teams: BubbleTeamEntry[] = context.league.teams
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .filter(team => !selectedIds.has(team.id))
    .slice(0, 5)
    .map(team => ({
      name: team.name,
      ranking: team.ranking,
      conference: team.conference ?? 'Independent',
      record: formatRecord(team),
    }));
  const conference_champions: ConferenceChampionEntry[] = context.champions.map(team => ({
    name: team.name,
    ranking: team.ranking,
    conference: team.conference ?? 'Independent',
    record: formatRecord(team),
    seed: context.playoff_teams.find(entry => entry.name === team.name)?.seed ?? null,
  }));

  return {
    ...context.page,
    playoff_teams: context.playoff_teams,
    bubble_teams,
    conference_champions,
  };
};

export const loadResumeComparison = async () => {
  const league = await loadLeagueOrThrow();
  const snapshot = league.resumeSnapshot;
  const toEntry = (team: NonNullable<typeof snapshot>['teams'][number]): ResumeTeamEntry => ({
    name: team.name,
    ranking: team.ranking,
    conference: team.conference,
    record: team.record,
    poll_score: team.pollScore,
    sor_rank: team.sorRank,
    sos_rank: team.sosRank,
    top_25_record: team.top25Record,
    best_win: team.bestWin
      ? { opponent: team.bestWin.opponent, opponent_ranking: team.bestWin.opponentRanking }
      : null,
    worst_loss: team.worstLoss
      ? { opponent: team.worstLoss.opponent, opponent_ranking: team.worstLoss.opponentRanking }
      : null,
    seed: team.seed,
    is_autobid: team.isAutobid,
    has_bye: team.hasBye,
    is_champ: team.isChampion,
  });

  if (snapshot) {
    return {
      ...buildLeagueNavigationEnvelope(league),
      playoff: {
        teams: snapshot.playoff.teams,
        autobids: snapshot.playoff.autobids,
        conf_champ_top_4: snapshot.playoff.conferenceChampionsReceiveTopSeeds,
      },
      is_projection: false,
      is_frozen: true,
      frozen_after_week: snapshot.frozenAfterWeek,
      resume_teams: snapshot.teams.map(toEntry),
    };
  }

  const context = await loadPostseasonContext(league);
  const allGames = await getAllGames();
  const oddsContext = await loadOddsContext();
  const resumeTeams = buildResumeComparisonTeams({
    league,
    games: allGames,
    selection: context.selection,
    championIds: new Set(context.champions.map(team => team.id)),
    oddsContext,
  });

  return {
    ...context.page,
    is_frozen: false,
    frozen_after_week: null,
    resume_teams: resumeTeams.map(toEntry),
  };
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
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    .map(game => {
      const teamA = teamsById.get(game.teamAId);
      const teamB = teamsById.get(game.teamBId);
      const isNy6 = NY6_BOWLS.includes((game.name ?? '') as (typeof NY6_BOWLS)[number]);
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
        recordA: teamA ? formatRecord(teamA) : '0-0 (0-0)',
        recordB: teamB ? formatRecord(teamB) : '0-0 (0-0)',
        scoreA: game.winnerId ? game.scoreA : null,
        scoreB: game.winnerId ? game.scoreB : null,
        winner: game.winnerId
          ? game.winnerId === game.teamAId
            ? teamA?.name ?? null
            : teamB?.name ?? null
          : null,
        is_ny6: isNy6,
        is_projection: false,
      };
    });

  const hosts = getNy6PlayoffHosts(context.league.info.currentYear, context.format);
  const ny6Unavailable = new Set([...hosts.semis, ...hosts.quarters]);
  const ny6Available = NY6_BOWLS.filter(bowl => !ny6Unavailable.has(bowl));
  const playoffTeamIds = new Set(context.playoffTeams.map(team => team.id));
  const projectedMatchups = buildBowlProjections(
    context.league,
    playoffTeamIds,
    ny6Available,
    !context.isProjection
  );
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
    recordA: formatRecord(matchup.teamA),
    recordB: formatRecord(matchup.teamB),
    scoreA: null,
    scoreB: null,
    winner: null,
    is_ny6: NY6_BOWLS.includes(matchup.name as (typeof NY6_BOWLS)[number]),
    is_projection: true,
  }));

  return {
    ...context.page,
    bowl_games: bowl_games.sort(sortBowls),
    bowl_projections: bowl_projections.sort(sortBowls),
  };
};
