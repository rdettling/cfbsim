import {
  getHistoryData,
  getPrestigeConfig,
} from '../../../db/baseData';
import { commitOffseasonTransition } from '../../../db/offseasonRepo';
import type { HistoryData } from '../../../types/baseData';
import {
  OffseasonStageMismatchError,
  type OffseasonAdvanceStage,
  type LeagueState,
  type OffseasonAdvanceResult,
} from '../../../types/league';
import { applyRealignmentAndPlayoff } from '../offseason';
import { resolveHistoricalData } from '../historicalData';
import { loadLeagueOrThrow } from '../leagueStore';
import { updateHistoryForSeason } from '../history';
import { applyPrestigeChanges, calculatePrestigeChanges } from '../prestige';
import { getNextStageDefinition } from '../../../constants/stages';
import { initializeRecruiting } from './recruiting';
import { initializeRosterFinalization } from './rosterFinalization';
import { getGamesByYear } from '../../../db/simRepo';
import { getSeasonMemory } from '../../../db/seasonMemoryRepo';
import { selectRetainedGameIds } from '../gameDetails';
import { SeasonMemoryDataIntegrityError } from '../../../types/memory';
import { prepareProgramEntryRosters } from '../../rosterBootstrap';
import { buildProgramEntryOrigins } from '../../playerOrigins';

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
      const [
        historyData,
        prestigeConfig,
        games,
        memory,
      ] = await Promise.all([
        getHistoryData(),
        getPrestigeConfig(),
        getGamesByYear(league.info.currentYear),
        getSeasonMemory(league.info.currentYear),
      ]);
      if (!memory) {
        throw new SeasonMemoryDataIntegrityError(
          `Season ${league.info.currentYear} is missing its finalized memory.`,
        );
      }
      const prestigeChanges = calculatePrestigeChanges(
        league,
        historyData,
        prestigeConfig,
      );
      history = updateHistoryForSeason(league, historyData);
      const userTeam = league.teams.find(team => team.name === league.info.team);
      if (!userTeam) throw new Error('The user program is missing.');
      const retainedGameIds = selectRetainedGameIds(
        userTeam.id,
        games,
        memory,
      );
      applyPrestigeChanges(league, prestigeChanges);
      league.info.stage = destination.id;
      await commitOffseasonTransition({
        expectedStage,
        league,
        history,
        detailPruning: {
          year: memory.year,
          retainedGameIds,
        },
      });
      return {
        previousStage: expectedStage,
        currentStage: destination.id,
        route: destination.path,
      };
    }
    case 'realignment': {
      const expectedSettings = structuredClone(league.settings);
      const historicalData = await resolveHistoricalData(
        league.info.currentYear + 1,
        league.info.startYear,
      );
      const addedTeams = await applyRealignmentAndPlayoff(
        league,
        historicalData,
      );
      const players = addedTeams.length
        ? await prepareProgramEntryRosters(league, addedTeams)
        : undefined;
      const playerOrigins = players
        ? buildProgramEntryOrigins(players, league.info.currentYear)
        : undefined;
      league.info.stage = destination.id;
      await commitOffseasonTransition({
        expectedStage,
        expectedSettings,
        league,
        players,
        playerOrigins,
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
