import {
  getHistoryData,
  getPrestigeConfig,
  getTeamsData,
} from '../../db/baseData';
import { commitOffseasonTransition } from '../../db/offseasonRepo';
import { getAllPlayers } from '../../db/simRepo';
import type { HistoryData } from '../../types/baseData';
import type { GameRecord, PlayerRecord } from '../../types/db';
import type { OffseasonStage } from '../../types/domain';
import {
  applyProgression,
  ensureRosters,
  recalculateTeamRatings,
  runRecruitingCycle,
  setStarters,
} from '../roster';
import { applyRosterCuts } from '../rosterCuts';
import {
  OffseasonStageMismatchError,
  type LeagueState,
  type OffseasonAdvanceResult,
} from '../../types/league';
import { applyRealignmentAndPlayoff } from './offseason';
import { resolveHistoricalData } from './historicalData';
import { loadLeagueOrThrow } from './leagueStore';
import { updateHistoryForSeason } from './history';
import { applyPrestigeChanges, calculatePrestigeChanges } from './prestige';
import { prepareSeasonReset } from './seasonReset';
import { getNextStageDefinition } from '../../constants/stages';

export const isOffseasonStage = (
  stage: LeagueState['info']['stage'],
): stage is OffseasonStage =>
  stage === 'summary' ||
  stage === 'realignment' ||
  stage === 'progression' ||
  stage === 'recruiting_summary' ||
  stage === 'roster_cuts';

export const advanceOffseasonStage = async (
  expectedStage: OffseasonStage,
): Promise<OffseasonAdvanceResult> => {
  const league = await loadLeagueOrThrow();
  if (league.info.stage !== expectedStage) {
    throw new OffseasonStageMismatchError(expectedStage, league.info.stage);
  }
  const destination = getNextStageDefinition(expectedStage);

  let history: HistoryData | undefined;
  let players: PlayerRecord[] | undefined;
  let games: GameRecord[] | undefined;
  let clearNonGameArtifacts = false;

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
    case 'progression':
      await ensureRosters(league);
      players = await getAllPlayers();
      applyProgression(players);
      await runRecruitingCycle(league, league.teams, players);
      break;
    case 'recruiting_summary':
      break;
    case 'roster_cuts': {
      await ensureRosters(league);
      players = await getAllPlayers();
      applyRosterCuts(league.teams, players);
      setStarters(league.teams, players);
      recalculateTeamRatings(league.teams, players);
      const reset = await prepareSeasonReset(league);
      games = reset.gamesToSave;
      clearNonGameArtifacts = true;
      break;
    }
  }

  league.info.stage = destination.id;
  await commitOffseasonTransition({
    expectedStage,
    league,
    history,
    players,
    games,
    clearNonGameArtifacts,
  });

  return {
    previousStage: expectedStage,
    currentStage: destination.id,
    route: destination.path,
  };
};
