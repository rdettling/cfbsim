import type { Team } from '../../../src/types/domain';
import { extractGameStoryFacts } from '../../../src/domain/news/facts';
import { generateGameNews } from '../../../src/domain/news/generate';
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
import {
  runSeasonCorpus,
  type SeasonCorpusData,
  type SeasonCorpusOptions,
  type SeasonSimulationSnapshot,
} from '../shared/seasonCorpus';

export interface NewsAuditCorpusSinks {
  rankingEntries?: RankingNewsAuditEntry[];
  previewEntries?: PreviewNewsAuditEntry[];
  onSeasonComplete?: (snapshot: SeasonSimulationSnapshot) => void;
}

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

export const generateNewsAuditCorpus = (
  data: SeasonCorpusData,
  options: SeasonCorpusOptions,
  sinks: NewsAuditCorpusSinks = {},
): NewsAuditEntry[] => {
  const entries: NewsAuditEntry[] = [];
  runSeasonCorpus(data, options, {
    onPreseason: context => {
      sinks.previewEntries?.push(buildPreviewNewsAuditEntry({
        auditId: `preview:${context.rootSeed}:${context.sample}:${context.league.info.currentYear}`,
        source: 'simulation',
        rootSeed: context.rootSeed,
        sample: context.sample,
        season: context.season,
        year: context.league.info.currentYear,
        teams: context.league.teams,
        games: context.games,
        defendingChampionId: context.defendingChampionId,
      }));
    },
    onGameComplete: context => {
      const generated = generateGameNews(extractGameStoryFacts({
        game: context.game,
        detail: context.detail,
        teamsById: context.teamsById,
        playersById: context.playersById,
        games: context.games,
      }));
      const winner = context.teamsById.get(generated.trace.facts.winnerId)!;
      const loser = context.teamsById.get(generated.trace.facts.loserId)!;
      const featured = generated.item.featuredPlayerId === null
        ? null
        : context.playersById.get(generated.item.featuredPlayerId) ?? null;
      entries.push({
        ...generated,
        auditId: `sim:${context.rootSeed}:${context.sample}:${context.game.year}:${context.game.id}`,
        source: 'simulation',
        rootSeed: context.rootSeed,
        sample: context.sample,
        season: context.season,
        winnerName: winner.name,
        loserName: loser.name,
        winnerConference: winner.conference,
        loserConference: loser.conference,
        featuredPosition: featured?.pos ?? null,
      });
    },
    onRankingsUpdated: context => {
      if (!sinks.rankingEntries) return;
      sinks.rankingEntries.push(buildRankingAuditEntry({
        auditId: `rankings:${context.rootSeed}:${context.sample}:${context.league.info.currentYear}:${context.league.info.currentWeek}`,
        source: 'simulation',
        rootSeed: context.rootSeed,
        sample: context.sample,
        season: context.season,
        year: context.league.info.currentYear,
        week: context.league.info.currentWeek,
        updates: context.updates,
        teamsById: new Map(context.league.teams.map(team => [team.id, team])),
      }));
    },
    onSeasonComplete: sinks.onSeasonComplete,
    onSampleComplete: context => {
      if (context.sample !== 0) return;
      entries.push(...buildNewsAuditScenarioEntries(
        context.league.teams,
        context.players,
        context.rootSeed,
      ));
      sinks.rankingEntries?.push(...buildRankingScenarioEntries(
        context.league.teams,
        context.rootSeed,
      ));
    },
  });
  return entries.sort((left, right) => left.auditId.localeCompare(right.auditId));
};
