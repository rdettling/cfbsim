import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { GameRecord } from '../../types/db';
import {
  BOWL_WEEK,
  CONFERENCE_CHAMPIONSHIP_WEEK,
  REGULAR_SEASON_WEEKS,
} from '../league/postseason';
import { buildBaseLabel } from '../utils/gameLabels';
import { buildOddsFields, loadOddsContext } from '../odds';
import { nextId } from './ids';
import { buildWatchability } from './games';
import {
  getAllGames,
  getGameById,
  getGamesByWeek,
  saveGamesAndLeague,
} from '../../db/simRepo';
import { finalizePostseasonRankings } from './rankings';
import { buildPlayoffSelection } from '../league/utils/playoffSelection';
import { buildResumeComparisonSnapshot } from '../league/utils/resumeComparison';
import { generatePlayoffFieldNews } from '../news/rankings';

const isConferenceGame = (teamA: Team, teamB: Team) =>
  teamA.conference !== 'Independent' && teamA.conference === teamB.conference;

const updateTeamGameCounts = (teamA: Team, teamB: Team) => {
  if (isConferenceGame(teamA, teamB)) {
    teamA.confGames += 1;
    teamB.confGames += 1;
  } else {
    teamA.nonConfGames += 1;
    teamB.nonConfGames += 1;
  }
};

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

const buildBowlMatchups = (
  league: LeagueState,
  playoffTeamIds: Set<number>,
  ny6Available: string[]
) => {
  const eligible = league.teams
    .filter(team => !playoffTeamIds.has(team.id) && team.totalWins >= 6)
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

const setBowls = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>
) => {
  const playoffTeams = league.settings.playoffTeams;
  const existing = (await getGamesByWeek(BOWL_WEEK)).filter(
    game => game.year === league.info.currentYear
  );
  if (existing.some(game => game.gameType === 'bowl')) {
    return;
  }

  const playoffTeamIds = new Set<number>(league.playoff.seeds);
  const hosts = getNy6PlayoffHosts(league.info.currentYear, playoffTeams);
  const ny6Unavailable = new Set([...hosts.semis, ...hosts.quarters]);
  const ny6Available = NY6_BOWLS.filter(bowl => !ny6Unavailable.has(bowl));

  const matchups = buildBowlMatchups(league, playoffTeamIds, ny6Available);
  if (!matchups.length) return;

  const gamesToCreate = matchups.map(({ name, teamA, teamB }) =>
    createGameRecord(league, teamA, teamB, BOWL_WEEK, name, oddsContext, {
      neutralSite: true,
      gameType: 'bowl',
    })
  );

  await saveGamesAndLeague(gamesToCreate, league);
};

const createGameRecord = (
  league: LeagueState,
  teamA: Team,
  teamB: Team,
  weekPlayed: number,
  name: string,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  options: {
    gameType: import('../../types/news').GameType;
    neutralSite?: boolean;
    homeTeam?: Team | null;
    awayTeam?: Team | null;
  },
) => {
  const neutralSite = options?.neutralSite ?? true;
  const homeTeam = neutralSite ? null : options?.homeTeam ?? teamA;
  const awayTeam = neutralSite ? null : options?.awayTeam ?? teamB;
  const oddsFields = buildOddsFields(teamA, teamB, homeTeam, neutralSite, oddsContext);

  const record: GameRecord = {
    id: nextId(league, 'game'),
    teamAId: teamA.id,
    teamBId: teamB.id,
    homeTeamId: homeTeam?.id ?? null,
    awayTeamId: awayTeam?.id ?? null,
    neutralSite,
    venue: null,
    winnerId: null,
    baseLabel: buildBaseLabel(teamA, teamB, name),
    name,
    gameType: options.gameType,
    rivalryKey: null,
    ...oddsFields,
    weekPlayed,
    year: league.info.currentYear,
    rankATOG: teamA.ranking,
    rankBTOG: teamB.ranking,
    resultA: null,
    resultB: null,
    overtime: 0,
    quarter: 1,
    clockSecondsLeft: 900,
    scoreA: null,
    scoreB: null,
    watchability: null,
  };
  record.watchability = buildWatchability(record, league.teams.length);
  updateTeamGameCounts(teamA, teamB);
  return record;
};

const sortConferenceTeams = (teams: Team[]) => {
  return teams.slice().sort((a, b) => {
    const aGames = a.confWins + a.confLosses;
    const bGames = b.confWins + b.confLosses;
    const aPct = aGames ? a.confWins / aGames : 0;
    const bPct = bGames ? b.confWins / bGames : 0;
    if (bPct !== aPct) return bPct - aPct;
    if (b.confWins !== a.confWins) return b.confWins - a.confWins;
    if (a.ranking !== b.ranking) return a.ranking - b.ranking;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return a.totalLosses - b.totalLosses;
  });
};

const getConferenceChampion = async (
  league: LeagueState,
  conferenceName: string,
  teamsById: Map<number, Team>
) => {
  const conference = league.conferences.find(conf => conf.confName === conferenceName);
  if (!conference || conference.confName === 'Independent') return null;

  if (conference.championship) {
    const game = await getGameById(conference.championship);
    if (game?.winnerId) {
      return teamsById.get(game.winnerId) ?? null;
    }
  }

  const conferenceTeams = league.teams.filter(team => team.conference === conferenceName);
  const sorted = sortConferenceTeams(conferenceTeams);
  return sorted[0] ?? null;
};

const getPostseasonSelectionContext = async (
  league: LeagueState,
  teamsById: Map<number, Team>
) => {
  const conferenceNames = league.conferences
    .map(conf => conf.confName)
    .filter(confName => confName !== 'Independent');

  const champions: Team[] = [];
  for (const confName of conferenceNames) {
    const champion = await getConferenceChampion(league, confName, teamsById);
    if (champion) champions.push(champion);
  }

  champions.sort((a, b) => a.ranking - b.ranking);
  return {
    champions,
    selection: buildPlayoffSelection(league, champions),
  };
};

const applyPlayoffCommitteeRankings = (orderedTeams: Team[]) => {
  orderedTeams.forEach((team, index) => {
    team.last_rank = team.ranking;
    team.ranking = index + 1;
  });
};

const setConferenceChampionships = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  const gamesToCreate: GameRecord[] = [];
  league.conferences.forEach(conference => {
    if (conference.confName === 'Independent') return;
    if (conference.championship) return;

    const conferenceTeams = league.teams.filter(team => team.conference === conference.confName);
    const sortedTeams = sortConferenceTeams(conferenceTeams);
    const teamA = sortedTeams[0];
    const teamB = sortedTeams[1];
    if (!teamA || !teamB) return;

    const game = createGameRecord(
      league,
      teamA,
      teamB,
      weekOverride ?? CONFERENCE_CHAMPIONSHIP_WEEK,
      `${conference.confName} championship`,
      oddsContext,
      { neutralSite: true, gameType: 'conference_championship' }
    );
    conference.championship = game.id;
    gamesToCreate.push(game);
  });

  if (gamesToCreate.length) await saveGamesAndLeague(gamesToCreate, league);
};

const setPlayoffR1 = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  if (league.playoff.left_r1_1 || league.playoff.left_r1_2 || league.playoff.right_r1_1 || league.playoff.right_r1_2) {
    return;
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const { selection } = await getPostseasonSelectionContext(league, teamsById);
  const teams = selection.order;
  applyPlayoffCommitteeRankings(teams);
  const seeds = teams.slice(0, 12);
  if (seeds.length < 12) return;

  league.playoff.seeds = seeds.map(team => team.id);

  const week = weekOverride ?? CONFERENCE_CHAMPIONSHIP_WEEK + 1;
  const gamesToCreate = [
    createGameRecord(league, seeds[7], seeds[8], week, 'Playoff round 1', oddsContext, { neutralSite: true, gameType: 'playoff_first_round' }),
    createGameRecord(league, seeds[4], seeds[11], week, 'Playoff round 1', oddsContext, { neutralSite: true, gameType: 'playoff_first_round' }),
    createGameRecord(league, seeds[6], seeds[9], week, 'Playoff round 1', oddsContext, { neutralSite: true, gameType: 'playoff_first_round' }),
    createGameRecord(league, seeds[5], seeds[10], week, 'Playoff round 1', oddsContext, { neutralSite: true, gameType: 'playoff_first_round' }),
  ];

  league.playoff.left_r1_1 = gamesToCreate[0].id;
  league.playoff.left_r1_2 = gamesToCreate[1].id;
  league.playoff.right_r1_1 = gamesToCreate[2].id;
  league.playoff.right_r1_2 = gamesToCreate[3].id;

  const fieldStory = generatePlayoffFieldNews({
    year: league.info.currentYear,
    week: CONFERENCE_CHAMPIONSHIP_WEEK,
    selectedTeamIds: league.playoff.seeds,
    teamsById,
  }).item;
  await saveGamesAndLeague(gamesToCreate, league, [fieldStory]);
};

const setPlayoffQuarter = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  if (league.playoff.left_quarter_1 || league.playoff.left_quarter_2 || league.playoff.right_quarter_1 || league.playoff.right_quarter_2) {
    return;
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const seeds = (league.playoff.seeds ?? [])
    .map(id => teamsById.get(id))
    .filter(Boolean) as Team[];
  if (seeds.length < 4) return;

  const r1Ids = [
    league.playoff.left_r1_1,
    league.playoff.left_r1_2,
    league.playoff.right_r1_1,
    league.playoff.right_r1_2,
  ];
  const r1Games = await Promise.all(r1Ids.map(id => (id ? getGameById(id) : null)));
  if (r1Games.some(game => !game?.winnerId)) return;

  const winners = r1Games.map(game => teamsById.get(game!.winnerId!)).filter(Boolean) as Team[];
  if (winners.length < 4) return;

  const week = weekOverride ?? CONFERENCE_CHAMPIONSHIP_WEEK + 2;
  const gamesToCreate = [
    createGameRecord(league, seeds[0], winners[0], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true, gameType: 'playoff_quarterfinal' }),
    createGameRecord(league, seeds[3], winners[1], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true, gameType: 'playoff_quarterfinal' }),
    createGameRecord(league, seeds[1], winners[2], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true, gameType: 'playoff_quarterfinal' }),
    createGameRecord(league, seeds[2], winners[3], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true, gameType: 'playoff_quarterfinal' }),
  ];

  league.playoff.left_quarter_1 = gamesToCreate[0].id;
  league.playoff.left_quarter_2 = gamesToCreate[1].id;
  league.playoff.right_quarter_1 = gamesToCreate[2].id;
  league.playoff.right_quarter_2 = gamesToCreate[3].id;

  await saveGamesAndLeague(gamesToCreate, league);
};

const setPlayoffSemi = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  if (league.playoff.left_semi || league.playoff.right_semi) {
    return;
  }

  const playoffTeams = league.settings.playoffTeams;
  const week = weekOverride ?? (playoffTeams === 4
    ? CONFERENCE_CHAMPIONSHIP_WEEK + 1
    : CONFERENCE_CHAMPIONSHIP_WEEK + 3);

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const gamesToCreate: GameRecord[] = [];

  if (playoffTeams === 4) {
    const seeds = league.teams
      .slice()
      .sort((a, b) => a.ranking - b.ranking)
      .slice(0, 4);
    if (seeds.length < 4) return;
    league.playoff.seeds = seeds.map(team => team.id);

    gamesToCreate.push(
      createGameRecord(league, seeds[0], seeds[3], week, 'Playoff semifinal', oddsContext, { neutralSite: true, gameType: 'playoff_semifinal' }),
      createGameRecord(league, seeds[1], seeds[2], week, 'Playoff semifinal', oddsContext, { neutralSite: true, gameType: 'playoff_semifinal' })
    );
  } else {
    const quarterIds = [
      league.playoff.left_quarter_1,
      league.playoff.left_quarter_2,
      league.playoff.right_quarter_1,
      league.playoff.right_quarter_2,
    ];
    const quarterGames = await Promise.all(quarterIds.map(id => (id ? getGameById(id) : null)));
    if (quarterGames.some(game => !game?.winnerId)) return;

    const winners = quarterGames.map(game => teamsById.get(game!.winnerId!)).filter(Boolean) as Team[];
    if (winners.length < 4) return;

    gamesToCreate.push(
      createGameRecord(league, winners[0], winners[1], week, 'Playoff semifinal', oddsContext, { neutralSite: true, gameType: 'playoff_semifinal' }),
      createGameRecord(league, winners[2], winners[3], week, 'Playoff semifinal', oddsContext, { neutralSite: true, gameType: 'playoff_semifinal' })
    );
  }

  league.playoff.left_semi = gamesToCreate[0]?.id;
  league.playoff.right_semi = gamesToCreate[1]?.id;

  if (gamesToCreate.length) {
    if (playoffTeams === 4) {
      const fieldStory = generatePlayoffFieldNews({
        year: league.info.currentYear,
        week: CONFERENCE_CHAMPIONSHIP_WEEK,
        selectedTeamIds: league.playoff.seeds,
        teamsById,
      }).item;
      await saveGamesAndLeague(gamesToCreate, league, [fieldStory]);
    } else {
      await saveGamesAndLeague(gamesToCreate, league);
    }
  }
};

const setNatty = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  if (league.playoff.natty) {
    return;
  }

  const playoffTeams = league.settings.playoffTeams;
  const week = weekOverride ?? (playoffTeams === 2
    ? CONFERENCE_CHAMPIONSHIP_WEEK + 1
    : playoffTeams === 4
      ? CONFERENCE_CHAMPIONSHIP_WEEK + 2
      : CONFERENCE_CHAMPIONSHIP_WEEK + 4);

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  let teamA: Team | null = null;
  let teamB: Team | null = null;

  if (playoffTeams === 2) {
    const seeds = league.teams
      .slice()
      .sort((a, b) => a.ranking - b.ranking)
      .slice(0, 2);
    league.playoff.seeds = seeds.map(team => team.id);
    [teamA, teamB] = seeds;
  } else {
    const leftSemi = league.playoff.left_semi ? await getGameById(league.playoff.left_semi) : null;
    const rightSemi = league.playoff.right_semi ? await getGameById(league.playoff.right_semi) : null;
    if (!leftSemi?.winnerId || !rightSemi?.winnerId) return;
    teamA = teamsById.get(leftSemi.winnerId) ?? null;
    teamB = teamsById.get(rightSemi.winnerId) ?? null;
  }

  if (!teamA || !teamB) return;
  const game = createGameRecord(league, teamA, teamB, week, 'National Championship', oddsContext, { neutralSite: true, gameType: 'national_championship' });
  league.playoff.natty = game.id;
  if (playoffTeams === 2) {
    const fieldStory = generatePlayoffFieldNews({
      year: league.info.currentYear,
      week: CONFERENCE_CHAMPIONSHIP_WEEK,
      selectedTeamIds: league.playoff.seeds,
      teamsById,
    }).item;
    await saveGamesAndLeague([game], league, [fieldStory]);
  } else {
    await saveGamesAndLeague([game], league);
  }
};

const ensureSummaryStage = async (league: LeagueState) => {
  if (league.info.stage === 'summary') return;
  if (!league.playoff.natty) return;
  const natty = await getGameById(league.playoff.natty);
  if (natty?.winnerId) {
    league.info.stage = 'summary';
    finalizePostseasonRankings(league.teams, natty);
  }
};

export const handleSpecialWeeks = async (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => {
  const playoffTeams = league.settings.playoffTeams;
  const baseWeek = REGULAR_SEASON_WEEKS;
  const ccWeek = CONFERENCE_CHAMPIONSHIP_WEEK;
  const specialActions: Record<number, Record<number, (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => Promise<void>>> = {
    2: {
      [baseWeek]: setConferenceChampionships,
      [ccWeek]: async (leagueState, context) => {
        await setNatty(leagueState, context);
        await setBowls(leagueState, context);
      },
    },
    4: {
      [baseWeek]: setConferenceChampionships,
      [ccWeek]: async (leagueState, context) => {
        await setPlayoffSemi(leagueState, context);
        await setBowls(leagueState, context);
      },
      [ccWeek + 1]: setNatty,
    },
    12: {
      [baseWeek]: setConferenceChampionships,
      [ccWeek]: async (leagueState, context) => {
        await setPlayoffR1(leagueState, context);
        await setBowls(leagueState, context);
      },
      [ccWeek + 1]: setPlayoffQuarter,
      [ccWeek + 2]: setPlayoffSemi,
      [ccWeek + 3]: setNatty,
    },
  };

  const action = specialActions[playoffTeams]?.[league.info.currentWeek];
  if (action) {
    if (league.info.currentWeek === ccWeek && league.resumeSnapshot === null) {
      const games = await getAllGames();
      const gamesById = new Map(games.map(game => [game.id, game]));
      const championshipIds = league.conferences
        .map(conference => conference.championship)
        .filter((id): id is number => Boolean(id));
      const championshipsComplete = championshipIds.every(id => gamesById.get(id)?.winnerId);
      if (championshipsComplete) {
        const teamsById = new Map(league.teams.map(team => [team.id, team]));
        const { champions, selection } = await getPostseasonSelectionContext(league, teamsById);
        league.resumeSnapshot = buildResumeComparisonSnapshot({
          league,
          games,
          selection,
          championIds: new Set(champions.map(team => team.id)),
          oddsContext,
        });
      }
    }
    await action(league, oddsContext);
    await ensureSummaryStage(league);
    return;
  }

  const currentWeek = league.info.currentWeek;
  if (playoffTeams === 12 && league.playoff) {
    const r1Ids = [
      league.playoff.left_r1_1,
      league.playoff.left_r1_2,
      league.playoff.right_r1_1,
      league.playoff.right_r1_2,
    ];
    const quarterIds = [
      league.playoff.left_quarter_1,
      league.playoff.left_quarter_2,
      league.playoff.right_quarter_1,
      league.playoff.right_quarter_2,
    ];
    const semiIds = [league.playoff.left_semi, league.playoff.right_semi];

    if (!quarterIds.some(Boolean)) {
      const r1Games = await Promise.all(r1Ids.map(id => (id ? getGameById(id) : null)));
      if (r1Games.every(game => game?.winnerId)) {
        await setPlayoffQuarter(league, oddsContext, currentWeek);
      }
      await ensureSummaryStage(league);
      return;
    }

    if (!semiIds.some(Boolean)) {
      const qGames = await Promise.all(quarterIds.map(id => (id ? getGameById(id) : null)));
      if (qGames.every(game => game?.winnerId)) {
        await setPlayoffSemi(league, oddsContext, currentWeek);
      }
      await ensureSummaryStage(league);
      return;
    }

    if (!league.playoff.natty) {
      const sGames = await Promise.all(semiIds.map(id => (id ? getGameById(id) : null)));
      if (sGames.every(game => game?.winnerId)) {
        await setNatty(league, oddsContext, currentWeek);
      }
    }
    await ensureSummaryStage(league);
    return;
  }

  if (playoffTeams === 4 && league.playoff) {
    if (!league.playoff.left_semi && !league.playoff.right_semi) return;
    if (!league.playoff.natty) {
      const semiGames = await Promise.all([
        league.playoff.left_semi ? getGameById(league.playoff.left_semi) : null,
        league.playoff.right_semi ? getGameById(league.playoff.right_semi) : null,
      ]);
      if (semiGames.every(game => game?.winnerId)) {
        await setNatty(league, oddsContext, currentWeek);
      }
    }
    await ensureSummaryStage(league);
    return;
  }

  await ensureSummaryStage(league);
};
