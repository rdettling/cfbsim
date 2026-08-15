import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ConferencesData, NamesData, SeasonData, TeamsData } from '../src/types/baseData';
import type { GameLogRecord, GameRecord, PlayerRecord } from '../src/types/db';
import type { LeagueState } from '../src/types/league';
import { buildAwardScoringSnapshot } from '../src/domain/league/awards';
import {
  AWARD_EVALUATION_CHECKPOINTS,
  evaluateAwards,
  type AwardSeasonEvaluation,
} from '../src/domain/league/awardEvaluation';
import {
  AWARD_EVALUATION_PROFILES,
  deriveAwardSeedFamily,
  parseAwardEvaluationArguments,
} from '../src/domain/league/awardEvaluationCli';
import {
  buildAwardEvaluationMarkdown,
  buildAwardSeasonArtifact,
} from '../src/domain/league/awardEvaluationReport';
import {
  generateNewsAuditCorpus,
  type NewsAuditCorpusData,
  type SeasonSimulationSnapshot,
} from '../src/domain/news/corpus';
import { normalizeRivalriesData } from '../src/domain/rivalryData';

const START_YEAR = 2026;

const readJson = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

const loadCorpusData = (): NewsAuditCorpusData => {
  const teamsData = readJson<TeamsData>('../public/data/teams.json');
  return {
    yearData: readJson<SeasonData>('../public/data/seasons/2026.json'),
    teamsData,
    conferencesData: readJson<ConferencesData>('../public/data/conferences.json'),
    names: readJson<NamesData>('../public/data/names.json'),
    states: readJson<Record<string, number>>('../public/data/states.json'),
    rivalries: normalizeRivalriesData(
      readJson<unknown>('../public/data/rivalries.json'),
      new Set(Object.keys(teamsData.teams)),
    ),
    bettingOdds: readJson<unknown>('../public/data/betting_odds.json'),
  };
};

interface CachedSeason {
  seed: number;
  season: number;
  year: number;
  league: LeagueState;
  players: PlayerRecord[];
  games: GameRecord[];
  logs: GameLogRecord[];
  teamRankingsByWeek: SeasonSimulationSnapshot['teamRankingsByWeek'];
}

const cacheSeason = (snapshot: SeasonSimulationSnapshot): CachedSeason => ({
  seed: snapshot.rootSeed,
  season: snapshot.season,
  year: snapshot.league.info.currentYear,
  league: {
    ...snapshot.league,
    info: { ...snapshot.league.info },
    teams: snapshot.league.teams,
  },
  players: snapshot.players,
  games: snapshot.games,
  logs: snapshot.logs,
  teamRankingsByWeek: snapshot.teamRankingsByWeek,
});

const scoreCachedSeason = (cached: CachedSeason): AwardSeasonEvaluation => ({
  seed: cached.seed,
  season: cached.season,
  year: cached.year,
  checkpoints: Object.fromEntries(AWARD_EVALUATION_CHECKPOINTS.map(week => {
    const games = cached.games.filter(game => game.weekPlayed <= week);
    const gameIds = new Set(games.map(game => game.id));
    const logs = cached.logs.filter(log => gameIds.has(log.gameId));
    const checkpointRankings = cached.teamRankingsByWeek[week];
    if (!checkpointRankings) {
      throw new Error(`Award evaluation is missing Week ${week} team rankings.`);
    }
    const rankings = new Map(checkpointRankings.map(
      entry => [entry.teamId, entry.ranking],
    ));
    if (rankings.size !== cached.league.teams.length) {
      throw new Error(`Award evaluation has incomplete Week ${week} team rankings.`);
    }
    const league = {
      ...cached.league,
      info: { ...cached.league.info, stage: 'season' as const, currentWeek: week },
      resumeSnapshot: null,
      teams: cached.league.teams.map(team => ({
        ...team,
        ranking: rankings.get(team.id)!,
      })),
    };
    return [week, buildAwardScoringSnapshot(league, cached.players, games, logs)];
  })),
});

export const collectAwardSeasonEvaluations = (
  data: NewsAuditCorpusData,
  seeds: number[],
  seasons: number,
) => {
  const cache: CachedSeason[] = [];
  seeds.forEach(seed => {
    generateNewsAuditCorpus(data, {
      seed,
      seeds: 1,
      seasons,
      startYear: START_YEAR,
    }, { onSeasonComplete: snapshot => cache.push(cacheSeason(snapshot)) });
  });
  return cache.map(scoreCachedSeason);
};

export const runAwardEvaluation = (arguments_: string[]) => {
  const options = parseAwardEvaluationArguments(arguments_);
  const profile = AWARD_EVALUATION_PROFILES[options.profile];
  const seeds = deriveAwardSeedFamily(options.profile, options.seed);
  const data = loadCorpusData();
  const seasons = collectAwardSeasonEvaluations(data, seeds, profile.seasons);
  const replayChecksums = seeds.slice(0, profile.replaySeeds).map(seed => {
    const expected = evaluateAwards({
      profile: 'smoke',
      seasons: seasons.filter(season => season.seed === seed),
    }).checksum;
    const replay = collectAwardSeasonEvaluations(data, [seed], profile.seasons);
    const actual = evaluateAwards({ profile: 'smoke', seasons: replay }).checksum;
    return { seed, expected, actual, matches: expected === actual };
  });
  const summary = evaluateAwards({ profile: options.profile, seasons, replayChecksums });
  const seedArgument = ` --seed ${options.seed}`;
  if (summary.status === 'invalid') {
    summary.nextCommand = `npm run eval:awards -- --profile smoke${seedArgument}`;
  } else if (summary.status === 'needs_tuning') {
    summary.nextCommand = `npm run eval:awards -- --profile ${options.profile}${seedArgument}`;
  } else if (summary.status === 'ready_for_acceptance') {
    summary.nextCommand = `npm run eval:awards -- --profile acceptance${seedArgument}`;
  }
  const output = resolve(options.output);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(resolve(output, 'seasons.jsonl'), `${seasons.map(season =>
    JSON.stringify(buildAwardSeasonArtifact(season))).join('\n')}\n`);
  writeFileSync(resolve(output, 'review.md'), buildAwardEvaluationMarkdown(summary));
  console.log(JSON.stringify(summary));
  process.exitCode = summary.exitCode;
  return summary;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAwardEvaluation(process.argv.slice(2));
}
