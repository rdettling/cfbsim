/// <reference types="node" />
import {
  copyFile,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validatePrestigeConfig,
  validateTeamsData,
} from '../src/domain/baseDataValidation';
import {
  evaluatePrestigePrograms,
  type PrestigeFinishObservation,
} from '../src/domain/league/prestige';
import { validateSeasonData } from '../src/domain/seasonDataValidation';
import type {
  PrestigeConfig,
  SeasonData,
  TeamsData,
} from '../src/types/baseData';
import { DATA_ROOT, prettyJson, readJson } from './data_files';

export type StartingPrestigeMode = 'audit' | 'check' | 'write';

export interface StartingPrestigeTeamAudit {
  team: string;
  before: number;
  after: number;
  rawTarget: number;
  score: number | null;
  averageFinish: number | null;
  observationYears: number[];
  usedMidpointFallback: boolean;
}

export interface StartingPrestigeSeasonAudit {
  year: number;
  teams: number;
  changed: number;
  maximumChange: number;
  teamAudits: StartingPrestigeTeamAudit[];
}

export interface StartingPrestigeBuildResult {
  seasons: SeasonData[];
  audits: StartingPrestigeSeasonAudit[];
}

const getSeasonPrestiges = (season: SeasonData) => new Map<string, number>([
  ...Object.values(season.conferences).flatMap(conference =>
    Object.entries(conference.teams)),
  ...Object.entries(season.independents),
]);

const getObservations = (
  team: string,
  season: SeasonData,
  seasonsByYear: ReadonlyMap<number, SeasonData>,
): PrestigeFinishObservation[] => {
  const observations: PrestigeFinishObservation[] = [];
  for (let year = season.year - 4; year < season.year; year += 1) {
    const source = seasonsByYear.get(year);
    const result = source?.results?.[team];
    if (!source?.results || !result) continue;
    observations.push({
      year,
      rank: result.rank,
      teamCount: Object.keys(source.results).length,
    });
  }
  const currentResult = season.results?.[team];
  if (observations.length < 4 && season.results && currentResult) {
    observations.push({
      year: season.year,
      rank: currentResult.rank,
      teamCount: Object.keys(season.results).length,
    });
  }
  return observations;
};

const applyPrestiges = (
  season: SeasonData,
  assignments: ReadonlyMap<string, number>,
): SeasonData => {
  const assignmentFor = (team: string) => {
    const assignment = assignments.get(team);
    if (assignment === undefined) {
      throw new Error(`Season ${season.year}: ${team} has no prestige assignment.`);
    }
    return assignment;
  };
  return {
    ...season,
    conferences: Object.fromEntries(
      Object.entries(season.conferences).map(([conferenceName, conference]) => [
        conferenceName,
        {
          ...conference,
          teams: Object.fromEntries(
            Object.keys(conference.teams).map(team => [team, assignmentFor(team)]),
          ),
        },
      ]),
    ),
    independents: Object.fromEntries(
      Object.keys(season.independents).map(team => [team, assignmentFor(team)]),
    ),
  };
};

export const buildStartingPrestigeCandidates = ({
  prestigeConfig,
  seasons,
  teams,
}: {
  prestigeConfig: PrestigeConfig;
  seasons: SeasonData[];
  teams: TeamsData;
}): StartingPrestigeBuildResult => {
  const orderedSeasons = seasons.slice().sort((left, right) => left.year - right.year);
  const seasonsByYear = new Map(orderedSeasons.map(season => [season.year, season]));
  if (seasonsByYear.size !== orderedSeasons.length) {
    throw new Error('Starting prestige requires unique season years.');
  }

  const candidates: SeasonData[] = [];
  const audits: StartingPrestigeSeasonAudit[] = [];
  for (const season of orderedSeasons) {
    const currentPrestiges = getSeasonPrestiges(season);
    const observationsByTeam = new Map<string, PrestigeFinishObservation[]>();
    const programs = [...currentPrestiges].map(([team, currentPrestige], index) => {
      const metadata = teams.teams[team];
      if (!metadata) {
        throw new Error(`Season ${season.year}: ${team} is missing program metadata.`);
      }
      const observations = getObservations(team, season, seasonsByYear);
      observationsByTeam.set(team, observations);
      return {
        id: index + 1,
        name: team,
        currentPrestige: Math.round((metadata.floor + metadata.ceiling) / 2),
        floor: metadata.floor,
        ceiling: metadata.ceiling,
        observations,
        authoredPrestige: currentPrestige,
      };
    });
    const authoredByTeam = new Map(
      programs.map(program => [program.name, program.authoredPrestige]),
    );
    const evaluations = evaluatePrestigePrograms(programs, prestigeConfig);
    const assignments = new Map(
      evaluations.map(evaluation => [evaluation.name, evaluation.targetPrestige]),
    );
    const candidate = validateSeasonData(
      applyPrestiges(season, assignments),
      `Generated starting prestige for ${season.year}`,
      season.year,
    );
    const teamAudits = evaluations
      .map(evaluation => {
        const before = authoredByTeam.get(evaluation.name)!;
        const observationYears = (observationsByTeam.get(evaluation.name) ?? [])
          .map(observation => observation.year);
        return {
          team: evaluation.name,
          before,
          after: evaluation.targetPrestige,
          rawTarget: evaluation.rawTargetPrestige,
          score: evaluation.score,
          averageFinish: evaluation.averageRank,
          observationYears,
          usedMidpointFallback: observationYears.length === 0,
        };
      })
      .sort((left, right) => left.team.localeCompare(right.team));
    candidates.push(candidate);
    audits.push({
      year: season.year,
      teams: teamAudits.length,
      changed: teamAudits.filter(team => team.before !== team.after).length,
      maximumChange: teamAudits.reduce(
        (maximum, team) => Math.max(maximum, Math.abs(team.after - team.before)),
        0,
      ),
      teamAudits,
    });
  }
  return { seasons: candidates, audits };
};

export const parseStartingPrestigeArgs = (args: string[]): StartingPrestigeMode => {
  if (!args.length) return 'audit';
  if (args.length === 1 && args[0] === '--check') return 'check';
  if (args.length === 1 && args[0] === '--write') return 'write';
  throw new Error('Use no flag for audit, --check, or --write.');
};

const readStartingPrestigeInputs = async (dataRoot: string) => {
  const seasonsDirectory = join(dataRoot, 'seasons');
  const years = (await readdir(seasonsDirectory))
    .filter(file => /^\d{4}\.json$/.test(file))
    .map(file => Number(file.slice(0, 4)))
    .sort((left, right) => left - right);
  const [seasons, teams, prestigeConfig] = await Promise.all([
    Promise.all(years.map(async year => validateSeasonData(
      await readJson<unknown>(join(seasonsDirectory, `${year}.json`)),
      `seasons/${year}.json`,
      year,
    ))),
    readJson<unknown>(join(dataRoot, 'teams.json')).then(value =>
      validateTeamsData(value, 'teams.json')),
    readJson<unknown>(join(dataRoot, 'prestige_config.json')).then(value =>
      validatePrestigeConfig(value, 'prestige_config.json')),
  ]);
  return { seasons, teams, prestigeConfig };
};

const replaceSeasonDirectory = async (
  dataRoot: string,
  seasons: SeasonData[],
) => {
  const target = join(dataRoot, 'seasons');
  const staging = await mkdtemp(join(dataRoot, '.starting-prestige-seasons-'));
  const backup = `${target}.starting-prestige-backup`;
  try {
    await Promise.all([
      ...seasons.map(season => writeFile(
        join(staging, `${season.year}.json`),
        prettyJson(season),
      )),
      copyFile(join(target, 'index.json'), join(staging, 'index.json')),
    ]);
    await rm(backup, { recursive: true, force: true });
    await rename(target, backup);
    try {
      await rename(staging, target);
    } catch (error) {
      await rename(backup, target);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};

export const runStartingPrestigeGenerator = async ({
  dataRoot = DATA_ROOT,
  mode,
}: {
  dataRoot?: string;
  mode: StartingPrestigeMode;
}): Promise<StartingPrestigeBuildResult> => {
  const result = buildStartingPrestigeCandidates(
    await readStartingPrestigeInputs(dataRoot),
  );
  const changed = result.audits.reduce((sum, audit) => sum + audit.changed, 0);
  if (mode === 'check' && changed) {
    throw new Error(
      `${changed} starting prestige value(s) are stale; run ` +
      '`npm run generate:starting-prestige -- --write`.',
    );
  }
  if (mode === 'write' && changed) {
    await replaceSeasonDirectory(dataRoot, result.seasons);
  }
  return result;
};

const printAudit = (
  result: StartingPrestigeBuildResult,
  mode: StartingPrestigeMode,
) => {
  for (const audit of result.audits) {
    const fallbacks = audit.teamAudits.filter(team => team.usedMidpointFallback);
    console.log(
      `${audit.year}: ${audit.changed}/${audit.teams} changed, ` +
      `maximum ${audit.maximumChange}, midpoint fallbacks ${fallbacks.length}.`,
    );
  }
  const changed = result.audits.reduce((sum, audit) => sum + audit.changed, 0);
  console.log(
    mode === 'write'
      ? `Wrote ${changed} generated starting prestige value(s).`
      : mode === 'check'
        ? 'Starting prestige data matches the shared evaluator.'
        : `Audit found ${changed} starting prestige value(s) to update.`,
  );
};

const main = async () => {
  const mode = parseStartingPrestigeArgs(process.argv.slice(2));
  const result = await runStartingPrestigeGenerator({ mode });
  printAudit(result, mode);
};

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  await main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
