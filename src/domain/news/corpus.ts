import type { ConferencesData, TeamsData, SeasonData } from '../../types/baseData';
import type { GameRecord, PlayerRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import { DEFAULT_NEXT_SEASON_CONFIGURATION, type LeagueState } from '../../types/league';
import type { GameType } from '../../types/news';
import type { FullGame } from '../../types/scheduleTypes';
import type { NamesData } from '../../types/baseData';
import { buildTeamsAndConferencesFromData } from '../baseData';
import { buildGameDetail } from '../league/gameDetails';
import { REGULAR_SEASON_WEEKS } from '../league/postseason';
import { buildOddsContext, buildOddsFields, type OddsContext } from '../odds';
import { prepareInitialRostersFromData } from '../rosterBootstrap';
import {
  buildAcceptedRivalryGames,
  initializeRivalryHostSeeds,
  resolveRivalries,
  type RivalriesData,
} from '../rivalryScheduling';
import { buildFullScheduleFromExisting } from '../schedule/planner';
import {
  hydrateGame,
  simGame,
} from '../sim/engine';
import {
  buildStartersCacheFromPlayers,
  createGameLogsFromPlays,
} from '../sim/statistics';
import { buildWatchability } from '../sim/games';
import { updateRankings, updateTeamRecords } from '../sim/rankings';
import { buildBaseLabel } from '../utils/gameLabels';
import {
  createSeededRandom,
  withSeededMathRandom,
  type RandomSource,
} from '../utils/random';
import { extractGameStoryFacts } from './facts';
import { generateGameNews } from './generate';
import type { NewsAuditEntry } from './audit';
import { buildNewsAuditScenarioEntries } from './scenarios';
import {
  buildPlayoffFieldAuditEntry,
  buildRankingAuditEntry,
  type RankingNewsAuditEntry,
} from './rankingAudit';
import {
  buildPreviewNewsAuditEntry,
  type PreviewNewsAuditEntry,
} from './previewAudit';

export interface NewsAuditCorpusData {
  yearData: SeasonData;
  teamsData: TeamsData;
  conferencesData: ConferencesData;
  names: NamesData;
  states: Record<string, number>;
  rivalries: RivalriesData;
  bettingOdds: unknown;
}

export interface NewsAuditCorpusOptions {
  seed: number;
  seeds: number;
  seasons: number;
  startYear: number;
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

const buildLeague = (
  year: number,
  data: NewsAuditCorpusData,
  random: RandomSource,
) => {
  const { teams, conferences } = buildTeamsAndConferencesFromData(
    data.yearData,
    data.teamsData,
    data.conferencesData,
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
    team.strength_of_record = 0;
    team.strength_of_record_avg = 0;
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
    watchability: null,
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
  odds,
  rootSeed,
  sample,
  season,
}: {
  league: LeagueState;
  record: GameRecord;
  starters: ReturnType<typeof buildStartersCacheFromPlayers>;
  playersById: Map<number, PlayerRecord>;
  allGames: GameRecord[];
  odds: OddsContext;
  rootSeed: number;
  sample: number;
  season: number;
}): NewsAuditEntry => {
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  record.rankATOG = teamsById.get(record.teamAId)!.ranking;
  record.rankBTOG = teamsById.get(record.teamBId)!.ranking;
  const simulated = hydrateGame(record, teamsById);
  const drives = simGame(league, simulated, starters);
  const driveRecords = drives.map(drive => drive.record);
  const plays = drives.flatMap(drive => drive.plays);
  const logs = createGameLogsFromPlays(simulated, plays, starters);
  record.scoreA = simulated.scoreA;
  record.scoreB = simulated.scoreB;
  record.winnerId = simulated.winner!.id;
  record.resultA = simulated.resultA;
  record.resultB = simulated.resultB;
  record.overtime = simulated.overtime;
  record.quarter = simulated.quarter;
  record.clockSecondsLeft = simulated.clockSecondsLeft;
  const detail = buildGameDetail(record.id, record.year, driveRecords, plays, logs);
  updateTeamRecords([simulated], league.teams, odds, league.info);
  const generated = generateGameNews(extractGameStoryFacts({
    game: record,
    detail,
    teamsById,
    playersById,
    games: allGames,
  }));
  const winner = teamsById.get(generated.trace.facts.winnerId)!;
  const loser = teamsById.get(generated.trace.facts.loserId)!;
  const featured = generated.item.featuredPlayerId === null
    ? null
    : playersById.get(generated.item.featuredPlayerId) ?? null;
  return {
    ...generated,
    auditId: `sim:${rootSeed}:${sample}:${record.year}:${record.id}`,
    source: 'simulation',
    rootSeed,
    sample,
    season,
    winnerName: winner.name,
    loserName: loser.name,
    winnerConference: winner.conference,
    loserConference: loser.conference,
    featuredPosition: featured?.pos ?? null,
  };
};

const playRound = (
  league: LeagueState,
  records: GameRecord[],
  context: Omit<Parameters<typeof completeGame>[0], 'league' | 'record'>,
  rankingEntries?: RankingNewsAuditEntry[],
) => {
  const entries = records.map(record => completeGame({ league, record, ...context }));
  const updates = updateRankings(league.info, league.teams, league.settings);
  if (rankingEntries) {
    rankingEntries.push(buildRankingAuditEntry({
      auditId: `rankings:${context.rootSeed}:${context.sample}:${league.info.currentYear}:${league.info.currentWeek}`,
      source: 'simulation',
      rootSeed: context.rootSeed,
      sample: context.sample,
      season: context.season,
      year: league.info.currentYear,
      week: league.info.currentWeek,
      updates,
      teamsById: new Map(league.teams.map(team => [team.id, team])),
    }));
  }
  return entries;
};

const buildRankingScenarioEntries = (
  teams: Team[],
  rootSeed: number,
): RankingNewsAuditEntry[] => {
  const ordered = [...teams].sort((left, right) => left.ranking - right.ranking);
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const base = ordered.map(team => ({
    teamId: team.id,
    previousRank: team.ranking,
    currentRank: team.ranking,
    record: team.record,
    pollScore: team.poll_score,
  }));
  const swap = (updates: typeof base, firstRank: number, secondRank: number) => {
    const first = ordered[firstRank - 1];
    const second = ordered[secondRank - 1];
    return updates.map(update => update.teamId === first.id
      ? { ...update, previousRank: firstRank, currentRank: secondRank }
      : update.teamId === second.id
        ? { ...update, previousRank: secondRank, currentRank: firstRank }
        : update);
  };
  const weekly = (label: string, week: number, updates: typeof base) =>
    buildRankingAuditEntry({
      auditId: `ranking-scenario:${label}`,
      source: 'scenario',
      rootSeed,
      sample: 0,
      season: 0,
      year: 2026,
      week,
      updates,
      teamsById,
    });
  let topFive = swap(base, 4, 6);
  topFive = swap(topFive, 5, 7);
  let turnover = swap(base, 23, 26);
  turnover = swap(turnover, 24, 27);
  turnover = swap(turnover, 25, 28);
  let conflict = swap(turnover, 1, 2);
  conflict = swap(conflict, 4, 6);
  conflict = swap(conflict, 5, 7);
  return [
    weekly('new-number-one', 5, swap(base, 1, 2)),
    weekly('top-five-shakeup', 6, topFive),
    weekly('top-25-turnover', 7, turnover),
    weekly('conflicting-triggers', 8, conflict),
    weekly('large-riser-no-trigger', 9, swap(base, 6, 20)),
    buildPlayoffFieldAuditEntry({ auditId: 'ranking-scenario:field-2', rootSeed, size: 2, teamsById }),
    buildPlayoffFieldAuditEntry({ auditId: 'ranking-scenario:field-4', rootSeed, size: 4, teamsById }),
    buildPlayoffFieldAuditEntry({ auditId: 'ranking-scenario:field-12', rootSeed, size: 12, teamsById }),
  ];
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
  play: (records: GameRecord[]) => NewsAuditEntry[],
) => {
  const entries: NewsAuditEntry[] = [];
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
  entries.push(...play(bowls));

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
  entries.push(...play(firstRound));
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
  entries.push(...play(quarters));
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
  entries.push(...play(semis));
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
  entries.push(...play([title]));
  return entries;
};

export const generateNewsAuditCorpus = (
  data: NewsAuditCorpusData,
  options: NewsAuditCorpusOptions,
  rankingEntries?: RankingNewsAuditEntry[],
  previewEntries?: PreviewNewsAuditEntry[],
): NewsAuditEntry[] => {
  const entries: NewsAuditEntry[] = [];
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
        previewEntries?.push(buildPreviewNewsAuditEntry({
          auditId: `preview:${rootSeed}:${sample}:${league.info.currentYear}`,
          source: 'simulation',
          rootSeed,
          sample,
          season,
          year: league.info.currentYear,
          teams: league.teams,
          games: regular,
          defendingChampionId,
        }));
        for (let week = 1; week <= REGULAR_SEASON_WEEKS; week += 1) {
          league.info.currentWeek = week;
          const weekGames = regular.filter(game => game.weekPlayed === week);
          entries.push(...playRound(league, weekGames, {
            starters,
            playersById,
            allGames,
            odds,
            rootSeed,
            sample,
            season,
          }, rankingEntries));
        }
        league.info.currentWeek = 15;
        const championships = conferenceChampionships(league, odds);
        allGames.push(...championships);
        entries.push(...playRound(league, championships, {
          starters,
          playersById,
          allGames,
          odds,
          rootSeed,
          sample,
          season,
        }));
        const play = (records: GameRecord[]) => {
          if (!records.length) return [];
          league.info.currentWeek = records[0].weekPlayed;
          allGames.push(...records);
          return playRound(league, records, {
            starters,
            playersById,
            allGames,
            odds,
            rootSeed,
            sample,
            season,
          });
        };
        entries.push(...buildPostseason(league, odds, play));
        defendingChampionId = [...allGames].reverse().find(game =>
          game.year === league.info.currentYear &&
          game.gameType === 'national_championship')?.winnerId ?? null;
      }
    });
    if (sample === 0) {
      entries.push(...buildNewsAuditScenarioEntries(league.teams, players, rootSeed));
      rankingEntries?.push(...buildRankingScenarioEntries(league.teams, rootSeed));
    }
  }
  return entries.sort((left, right) => left.auditId.localeCompare(right.auditId));
};
