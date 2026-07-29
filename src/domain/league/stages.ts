import {
  getHistoryData,
  getPrestigeConfig,
  getTeamsData,
} from '../../db/baseData';
import { commitOffseasonTransition } from '../../db/offseasonRepo';
import type { HistoryData } from '../../types/baseData';
import {
  OffseasonStageMismatchError,
  type OffseasonAdvanceStage,
  type LeagueState,
  type OffseasonAdvanceResult,
} from '../../types/league';
import { applyRealignmentAndPlayoff } from './offseason';
import { resolveHistoricalData } from './historicalData';
import { loadLeagueOrThrow } from './leagueStore';
import { updateHistoryForSeason } from './history';
import { applyPrestigeChanges, calculatePrestigeChanges } from './prestige';
import { getNextStageDefinition } from '../../constants/stages';
import { initializeRecruiting } from './recruiting';
import { initializeRosterFinalization } from './rosterFinalization';

export const isOffseasonAdvanceStage = (
  stage: LeagueState['info']['stage'],
): stage is OffseasonAdvanceStage =>
  stage === 'summary' ||
  stage === 'realignment' ||
  stage === 'progression' ||
  stage === 'recruiting_summary';

export const advanceOffseasonStage = async (
  expectedStage: OffseasonAdvanceStage,
): Promise<OffseasonAdvanceResult> => {
  const league = await loadLeagueOrThrow();
  if (league.info.stage !== expectedStage) {
    throw new OffseasonStageMismatchError(expectedStage, league.info.stage);
  }
  const destination = getNextStageDefinition(expectedStage);

  let history: HistoryData | undefined;
  switch (expectedStage) {
    case 'summary': {
      const [historyData, teamsData, prestigeConfig] = await Promise.all([
        getHistoryData(),
        getTeamsData(),
        getPrestigeConfig(),
      ]);
      calculatePrestigeChanges(
        league,
        historyData,
        teamsData,
        prestigeConfig,
      );
      history = updateHistoryForSeason(league, historyData);
      applyPrestigeChanges(league);
      break;
    }
    case 'realignment': {
      const expectedSettings = structuredClone(league.settings);
      const historicalData = await resolveHistoricalData(
        league.info.currentYear + 1,
        league.info.startYear,
      );
      await applyRealignmentAndPlayoff(league, historicalData);
      league.info.stage = destination.id;
      await commitOffseasonTransition({
        expectedStage,
        expectedSettings,
        league,
      });
      return {
        previousStage: expectedStage,
        currentStage: destination.id,
        route: destination.path,
      };
    }
    case 'progression': {
      const result = await initializeRecruiting({
        expectedStage,
        expectedYear: league.info.currentYear,
      });
      return {
        previousStage: expectedStage,
        currentStage: result.stage,
        route: result.route,
      };
    }
    case 'recruiting_summary': {
      return initializeRosterFinalization({
        expectedStage,
        expectedYear: league.info.currentYear,
      });
    }
  }

  league.info.stage = destination.id;
  await commitOffseasonTransition({
    expectedStage,
    league,
    history,
  });

  return {
    previousStage: expectedStage,
    currentStage: destination.id,
    route: destination.path,
  };
};
