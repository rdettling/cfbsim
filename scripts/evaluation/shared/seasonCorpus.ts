import type {
  ConferencesData,
  HistoryData,
  PrestigeConfig,
  TeamsData,
  SeasonData,
} from '../../../src/types/baseData';
import type {
  GameDetailRecord,
  GameLogRecord,
  GameRecord,
  PlayerRecord,
} from '../../../src/types/db';
import type { Team } from '../../../src/types/domain';
import { DEFAULT_NEXT_SEASON_CONFIGURATION, type LeagueState } from '../../../src/types/league';
import type { GameType } from '../../../src/types/news';
import type { FullGame } from '../../../src/types/scheduleTypes';
import type { NamesData } from '../../../src/types/baseData';
import { buildTeamsAndConferencesFromData } from '../../../src/domain/baseData';
import { calculateStartingPrestiges } from '../../../src/domain/league/prestige';
import { buildGameDetail } from '../../../src/domain/league/gameDetails';
import { REGULAR_SEASON_WEEKS } from '../../../src/domain/schedule/constants';
import { buildOddsContext, buildOddsFields, type OddsContext } from '../../../src/domain/odds';
import { prepareInitialRostersFromData } from '../../../src/domain/rosterBootstrap';
import {
  buildAcceptedRivalryGames,
  initializeRivalryHostSeeds,
  resolveRivalries,
  type RivalriesData,
} from '../../../src/domain/rivalryScheduling';
import { buildFullScheduleFromExisting } from '../../../src/domain/schedule/planner';
import {
  hydrateGame,
  simGame,
} from '../../../src/domain/sim/engine';
import {
  buildStartersCacheFromPlayers,
  createGameLogsFromPlays,
} from '../../../src/domain/sim/statistics';
import { buildWatchability } from '../../../src/domain/sim/games';
import { updateRankings } from '../../../src/domain/sim/rankings';
import { updateTeamRecords } from '../../../src/domain/sim/teamRecords';
import { buildPerformanceIndexMap } from '../../../src/domain/league/utils/stats/teamPerformance';
import { buildBaseLabel } from '../../../src/domain/utils/gameLabels';
import {
  createSeededRandom,
  withSeededMathRandom,
  type RandomSource,
} from '../../../src/domain/utils/random';
export interface SeasonCorpusData {
  yearData: SeasonData;
  teamsData: TeamsData;
  conferencesData: ConferencesData;
  historyData: HistoryData;
  prestigeConfig: PrestigeConfig;
  names: NamesData;
  states: Record<string, number>;
  rivalries: RivalriesData;
  bettingOdds: unknown;
}

export interface SeasonCorpusOptions {
  seed: number;
  seeds: number;
  seasons: number;
  startYear: number;
}

export interface SeasonSimulationSnapshot {
  rootSeed: number;
  sample: number;
  season: number;
  league: LeagueState;
  players: PlayerRecord[];
  games: GameRecord[];
  logs: GameLogRecord[];
  teamRankingsByWeek: Record<number, Array<{ teamId: number; ranking: number }>>;
}

export interface SeasonCorpusPreseasonContext {
  rootSeed: number;
  sample: number;
  season: number;
  league: LeagueState;
  players: PlayerRecord[];
  games: GameRecord[];
  defendingChampionId: number | null;
}

export interface SeasonCorpusGameContext {
  rootSeed: number;
  sample: number;
  season: number;
  league: LeagueState;
  game: GameRecord;
  detail: ReturnType<typeof buildGameDetail>;
  teamsById: Map<number, Team>;
  playersById: Map<number, PlayerRecord>;
  games: GameRecord[];
}

export interface SeasonCorpusRankingsContext {
  rootSeed: number;
  sample: number;
  season: number;
  league: LeagueState;
  updates: ReturnType<typeof updateRankings>;
}

export interface SeasonCorpusSampleContext {
  rootSeed: number;
  sample: number;
  league: LeagueState;
  players: PlayerRecord[];
}

export interface SeasonCorpusObserver {
  onPreseason?: (context: SeasonCorpusPreseasonContext) => void;
  onGameComplete?: (context: SeasonCorpusGameContext) => void;
  onRankingsUpdated?: (context: SeasonCorpusRankingsContext) => void;
  onSeasonComplete?: (snapshot: SeasonSimulationSnapshot) => void;
  onSampleComplete?: (context: SeasonCorpusSampleContext) => void;
}

const BOWL_NAMES = [
  'Rose Bowl',
  'Sugar Bowl',
  'Orange Bowl',
  'Cotton Bowl',
  'Fiesta Bowl',
  'Peach Bowl',
  'Alamo Bowl',
  'Citrus Bowl',
  'Holiday Bowl',
  'Gator Bowl',
  'Sun Bowl',
  'Liberty Bowl',
  'Las Vegas Bowl',
  'Music City Bowl',
  'Texas Bowl',
] as const;

const AWARD_RANKING_CHECKPOINTS = new Set([3, 9, 12, 15]);

const buildLeague = (
  year: number,
  data: SeasonCorpusData,
  random: RandomSource,
) => {
  const startingPrestiges = calculateStartingPrestiges({
    year,
    teamNames: [
      ...Object.values(data.yearData.conferences).flatMap(conference => conference.teams),
      ...data.yearData.independents,
    ],
    historyData: data.historyData,
    teamsData: data.teamsData,
    prestigeConfig: data.prestigeConfig,
  });
  const { teams, conferences } = buildTeamsAndConferencesFromData(
    data.yearData,
    data.teamsData,
    data.conferencesData,
    startingPrestiges,
  );
  const league: LeagueState = {
    info: {
      currentWeek: 1,
      lastRankingsWeek: 0,
      currentYear: year,
      startYear: year,
      stage: 'season',
      team: teams[0].name,
      lastWeek: 19,
    },
    teams,
    conferences,
    pending_rivalries: [],
    declinedRivalries: [],
    rivalryHostSeeds: {},
    scheduleBuilt: true,
    simInitialized: true,
    settings: {
      ...DEFAULT_NEXT_SEASON_CONFIGURATION,
      conferencePolicy: 'current',
      playoffTeams: 12,
      playoffAutobids: 5,
      conferenceChampionsReceiveTopSeeds: true,
    },
    playoff: { seeds: [] },
    resumeSnapshot: null,
    idCounters: { game: 1, player: 1 },
  };
  initializeRivalryHostSeeds(league, data.rivalries, () => random.next());
  const players = prepareInitialRostersFromData({
    league,
    historyData: data.historyData,
    names: data.names,
    states: data.states,
    random: random.fork('rosters'),
  });
  return { league, players };
};

const resetSeasonRecords = (teams: Team[]) => {
  teams.forEach(team => {
    team.confGames = 0;
    team.nonConfGames = 0;
    team.confWins = 0;
    team.confLosses = 0;
    team.nonConfWins = 0;
    team.nonConfLosses = 0;
    team.totalWins = 0;
    team.totalLosses = 0;
    team.gamesPlayed = 0;
    team.wins_over_expectation = 0;
    team.wins_over_expectation_per_game = 0;
    team.record = '0-0 (0-0)';
    team.last_game = null;
    team.next_game = null;
  });
};

const createGameRecord = ({
  league,
  teamA,
  teamB,
  week,
  gameType,
  name,
  rivalryKey,
  homeTeam,
  awayTeam,
  venue,
  odds,
}: {
  league: LeagueState;
  teamA: Team;
  teamB: Team;
  week: number;
  gameType: GameType;
  name: string | null;
  rivalryKey: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  venue: string | null;
  odds: OddsContext;
}): GameRecord => {
  const neutralSite = homeTeam === null && awayTeam === null;
  const record: GameRecord = {
    id: league.idCounters.game++,
    teamAId: teamA.id,
    teamBId: teamB.id,
    homeTeamId: homeTeam?.id ?? null,
    awayTeamId: awayTeam?.id ?? null,
    neutralSite,
    venue,
    winnerId: null,
    baseLabel: buildBaseLabel(teamA, teamB, name),
    name,
    gameType,
    rivalryKey,
    ...buildOddsFields(teamA, teamB, homeTeam, neutralSite, odds),
    weekPlayed: week,
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
    watchability: 0,
  };
  record.watchability = buildWatchability(record, league.teams.length);
  return record;
};

const recordFromFullGame = (
  league: LeagueState,
  game: FullGame,
  odds: OddsContext,
) => createGameRecord({
  league,
  teamA: game.teamA,
  teamB: game.teamB,
  week: game.weekPlayed,
  gameType: 'regular_season',
  name: game.name ?? null,
  rivalryKey: game.rivalryKey,
  homeTeam: game.homeTeam,
  awayTeam: game.awayTeam,
  venue: game.venue,
  odds,
});

const completeGame = ({
  league,
  record,
  starters,
  playersById,
  allGames,
  allLogs,
  allDetails,
  odds,
  rootSeed,
  sample,
  season,
  observer,
}: {
  league: LeagueState;
  record: GameRecord;
  starters: ReturnType<typeof buildStartersCacheFromPlayers>;
  playersById: Map<number, PlayerRecord>;
  allGames: GameRecord[];
  allLogs: GameLogRecord[];
  allDetails: GameDetailRecord[];
  odds: OddsContext;
  rootSeed: number;
  sample: number;
  season: number;
  observer: SeasonCorpusObserver;
}) => {
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  record.rankATOG = teamsById.get(record.teamAId)!.ranking;
  record.rankBTOG = teamsById.get(record.teamBId)!.ranking;
  const simulated = hydrateGame(record, teamsById);
  const drives = simGame(league, simulated, starters);
  const driveRecords = drives.map(drive => drive.record);
  const plays = drives.flatMap(drive => drive.plays);
  const logs = createGameLogsFromPlays(simulated, plays, starters);
  allLogs.push(...logs);
  record.scoreA = simulated.scoreA;
  record.scoreB = simulated.scoreB;
  record.winnerId = simulated.winner!.id;
  record.resultA = simulated.resultA;
  record.resultB = simulated.resultB;
  record.overtime = simulated.overtime;
  record.quarter = simulated.quarter;
  record.clockSecondsLeft = simulated.clockSecondsLeft;
  const detail = buildGameDetail(record.id, record.year, driveRecords, plays, logs);
  allDetails.push(detail);
  updateTeamRecords([simulated], league.teams, odds);
  observer.onGameComplete?.({
    rootSeed,
    sample,
    season,
    league,
    game: record,
    detail,
    teamsById,
    playersById,
    games: allGames,
  });
};

const playRound = (
  league: LeagueState,
  records: GameRecord[],
  context: Omit<Parameters<typeof completeGame>[0], 'league' | 'record'>,
  publishRankings = false,
) => {
  records.forEach(record => completeGame({ league, record, ...context }));
  const performanceIndexes = buildPerformanceIndexMap(
    league.teams,
    context.allGames.filter(game => game.year === league.info.currentYear),
    context.allDetails.filter(detail => detail.year === league.info.currentYear),
  );
  const updates = updateRankings(
    league.info,
    league.teams,
    league.settings,
    performanceIndexes,
  );
  if (publishRankings) context.observer.onRankingsUpdated?.({
    rootSeed: context.rootSeed,
    sample: context.sample,
    season: context.season,
    league,
    updates,
  });
};

const conferenceChampionships = (league: LeagueState, odds: OddsContext) =>
  league.conferences.flatMap(conference => {
    if (conference.confName === 'Independent' || conference.teams.length < 2) return [];
    const [teamA, teamB] = [...conference.teams].sort((left, right) => left.ranking - right.ranking).slice(0, 2);
    return [createGameRecord({
      league,
      teamA,
      teamB,
      week: 15,
      gameType: 'conference_championship',
      name: `${conference.confFullName} Championship`,
      rivalryKey: null,
      homeTeam: null,
      awayTeam: null,
      venue: null,
      odds,
    })];
  });

const buildPostseason = (
  league: LeagueState,
  odds: OddsContext,
  play: (records: GameRecord[]) => void,
) => {
  const seeds = [...league.teams].sort((left, right) => left.ranking - right.ranking).slice(0, 12);
  const playoffIds = new Set(seeds.map(team => team.id));
  const bowlTeams = [...league.teams]
    .filter(team => !playoffIds.has(team.id) && team.totalWins >= 6)
    .sort((left, right) => left.ranking - right.ranking)
    .slice(0, BOWL_NAMES.length * 2);
  const bowls: GameRecord[] = [];
  for (let index = 0; index + 1 < bowlTeams.length; index += 2) {
    bowls.push(createGameRecord({
      league,
      teamA: bowlTeams[index],
      teamB: bowlTeams[index + 1],
      week: 16,
      gameType: 'bowl',
      name: BOWL_NAMES[index / 2],
      rivalryKey: null,
      homeTeam: null,
      awayTeam: null,
      venue: null,
      odds,
    }));
  }
  play(bowls);

  const firstRoundPairs: Array<[Team, Team]> = [
    [seeds[4], seeds[11]],
    [seeds[5], seeds[10]],
    [seeds[6], seeds[9]],
    [seeds[7], seeds[8]],
  ];
  const firstRound = firstRoundPairs.map(([teamA, teamB]) => createGameRecord({
    league,
    teamA,
    teamB,
    week: 16,
    gameType: 'playoff_first_round',
    name: 'College Football Playoff First Round',
    rivalryKey: null,
    homeTeam: teamA,
    awayTeam: teamB,
    venue: teamA.stadium,
    odds,
  }));
  play(firstRound);
  const firstWinners = firstRound.map(record => league.teams.find(team => team.id === record.winnerId)!);
  const quarterPairs: Array<[Team, Team]> = [
    [seeds[0], firstWinners[3]],
    [seeds[1], firstWinners[2]],
    [seeds[2], firstWinners[1]],
    [seeds[3], firstWinners[0]],
  ];
  const quarters = quarterPairs.map(([teamA, teamB], index) => createGameRecord({
    league,
    teamA,
    teamB,
    week: 17,
    gameType: 'playoff_quarterfinal',
    name: BOWL_NAMES[index],
    rivalryKey: null,
    homeTeam: null,
    awayTeam: null,
    venue: null,
    odds,
  }));
  play(quarters);
  const quarterWinners = quarters.map(record => league.teams.find(team => team.id === record.winnerId)!);
  const semis = [[quarterWinners[0], quarterWinners[3]], [quarterWinners[1], quarterWinners[2]]]
    .map(([teamA, teamB], index) => createGameRecord({
      league,
      teamA,
      teamB,
      week: 18,
      gameType: 'playoff_semifinal',
      name: index === 0 ? 'Cotton Bowl' : 'Peach Bowl',
      rivalryKey: null,
      homeTeam: null,
      awayTeam: null,
      venue: null,
      odds,
    }));
  play(semis);
  const finalists = semis.map(record => league.teams.find(team => team.id === record.winnerId)!);
  const title = createGameRecord({
    league,
    teamA: finalists[0],
    teamB: finalists[1],
    week: 19,
    gameType: 'national_championship',
    name: 'National Championship',
    rivalryKey: null,
    homeTeam: null,
    awayTeam: null,
    venue: null,
    odds,
  });
  play([title]);
};

export const runSeasonCorpus = (
  data: SeasonCorpusData,
  options: SeasonCorpusOptions,
  observer: SeasonCorpusObserver = {},
) => {
  for (let sample = 0; sample < options.seeds; sample += 1) {
    const rootSeed = (options.seed + sample) >>> 0;
    const random = createSeededRandom(rootSeed);
    const { league, players } = buildLeague(options.startYear, data, random);
    const starters = buildStartersCacheFromPlayers(players);
    const playersById = new Map(players.map(player => [player.id, player]));
    const odds = buildOddsContext(data.bettingOdds);
    const allGames: GameRecord[] = [];
    let defendingChampionId: number | null = null;
    withSeededMathRandom(random.fork('game-simulation'), () => {
      for (let season = 0; season < options.seasons; season += 1) {
        const seasonGames: GameRecord[] = [];
        const seasonLogs: GameLogRecord[] = [];
        const seasonDetails: GameDetailRecord[] = [];
        const teamRankingsByWeek: SeasonSimulationSnapshot['teamRankingsByWeek'] = {};
        const captureTeamRankings = (week: number) => {
          if (!AWARD_RANKING_CHECKPOINTS.has(week)) return;
          teamRankingsByWeek[week] = league.teams.map(team => ({
            teamId: team.id,
            ranking: team.ranking,
          }));
        };
        league.info.currentYear = options.startYear + season;
        resetSeasonRecords(league.teams);
        const resolution = resolveRivalries({
          teams: league.teams,
          rivalries: data.rivalries,
          existingGames: [],
          year: league.info.currentYear,
        });
        const { fullGames } = buildFullScheduleFromExisting(
          league.teams[0],
          league.teams,
          [],
          {
            year: league.info.currentYear,
            seed: random.fork(`schedule:${season}`).int(0, 0xffff_ffff),
            requireComplete: true,
            requiredGames: buildAcceptedRivalryGames(resolution, league.teams, league),
          },
        );
        const regular = fullGames.map(game => recordFromFullGame(league, game, odds));
        allGames.push(...regular);
        seasonGames.push(...regular);
        observer.onPreseason?.({
          rootSeed,
          sample,
          season,
          league,
          players,
          games: regular,
          defendingChampionId,
        });
        for (let week = 1; week <= REGULAR_SEASON_WEEKS; week += 1) {
          league.info.currentWeek = week;
          const weekGames = regular.filter(game => game.weekPlayed === week);
          playRound(league, weekGames, {
            starters,
            playersById,
            allGames,
            allLogs: seasonLogs,
            allDetails: seasonDetails,
            odds,
            rootSeed,
            sample,
            season,
            observer,
          }, true);
          captureTeamRankings(week);
        }
        league.info.currentWeek = 15;
        const championships = conferenceChampionships(league, odds);
        allGames.push(...championships);
        seasonGames.push(...championships);
        playRound(league, championships, {
          starters,
          playersById,
          allGames,
          allLogs: seasonLogs,
          allDetails: seasonDetails,
          odds,
          rootSeed,
          sample,
          season,
          observer,
        });
        captureTeamRankings(15);
        const play = (records: GameRecord[]) => {
          if (!records.length) return;
          league.info.currentWeek = records[0].weekPlayed;
          allGames.push(...records);
          seasonGames.push(...records);
          return playRound(league, records, {
            starters,
            playersById,
            allGames,
            allLogs: seasonLogs,
            allDetails: seasonDetails,
            odds,
            rootSeed,
            sample,
            season,
            observer,
          });
        };
        buildPostseason(league, odds, play);
        observer.onSeasonComplete?.({
          rootSeed,
          sample,
          season,
          league: structuredClone(league),
          players,
          games: seasonGames,
          logs: seasonLogs,
          teamRankingsByWeek,
        });
        defendingChampionId = [...allGames].reverse().find(game =>
          game.year === league.info.currentYear &&
          game.gameType === 'national_championship')?.winnerId ?? null;
      }
    });
    observer.onSampleComplete?.({ rootSeed, sample, league, players });
  }
};
