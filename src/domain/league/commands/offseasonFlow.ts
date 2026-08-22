import { loadRecruitingState } from '../../../db/recruitingRepo';
import {
  getStageRoute,
  OFFSEASON_FLOW_STAGE_IDS,
  type OffseasonFlowStage,
  type OffseasonFlowTarget,
} from '../../../constants/stages';
import type { LeagueStage } from '../../../types/domain';
import {
  completeRecruitingWithAi,
  finalizeRecruiting,
} from './recruiting';
import { finalizeRoster } from './rosterFinalization';
import { initializeSeason } from './season';
import { advanceOffseasonStage } from './stages';
import { loadLeagueOrThrow } from '../leagueStore';

export interface AdvanceOffseasonToStageOptions {
  recruitingAllocations?: Record<number, number>;
}

export interface OffseasonFlowAdvanceResult {
  previousStage: OffseasonFlowStage;
  currentStage: OffseasonFlowTarget;
  route: string;
}

const FLOW_WITH_SEASON = [...OFFSEASON_FLOW_STAGE_IDS, 'season'] as const;

const stageIndex = (stage: LeagueStage) =>
  FLOW_WITH_SEASON.findIndex(flowStage => flowStage === stage);

export const advanceOffseasonToStage = async (
  target: OffseasonFlowTarget,
  options: AdvanceOffseasonToStageOptions = {},
): Promise<OffseasonFlowAdvanceResult> => {
  const initialLeague = await loadLeagueOrThrow();
  const previousStage = initialLeague.info.stage;
  const initialIndex = stageIndex(previousStage);
  const targetIndex = stageIndex(target);

  if (initialIndex < 0 || previousStage === 'season') {
    throw new Error(`Cannot advance the offseason from ${previousStage}.`);
  }
  if (targetIndex <= initialIndex) {
    throw new Error(
      `Cannot advance the offseason from ${previousStage} to ${target}.`,
    );
  }

  while (true) {
    const league = await loadLeagueOrThrow();
    if (league.info.stage === target) break;
    if (stageIndex(league.info.stage) > targetIndex) {
      throw new Error(
        `The offseason advanced beyond the requested ${target} stage.`,
      );
    }

    switch (league.info.stage) {
      case 'summary':
      case 'realignment':
      case 'progression':
      case 'recruiting_summary':
        await advanceOffseasonStage(league.info.stage);
        break;
      case 'recruiting': {
        const recruiting = await loadRecruitingState();
        if (!recruiting) {
          throw new Error('Recruiting state is unavailable.');
        }
        const guard = {
          expectedStage: 'recruiting' as const,
          expectedYear: recruiting.year,
          expectedRound: recruiting.round,
          expectedVersion: recruiting.version,
        };
        if (recruiting.status === 'active') {
          await completeRecruitingWithAi({
            ...guard,
            allocations:
              previousStage === 'recruiting'
                ? options.recruitingAllocations ?? {}
                : {},
          });
        } else if (recruiting.status === 'ready_for_signing_day') {
          await finalizeRecruiting({
            ...guard,
            expectedRound: 6,
          });
        } else {
          throw new Error(
            'Finalized recruiting cannot remain in the Recruiting stage.',
          );
        }
        break;
      }
      case 'roster_cuts': {
        const recruiting = await loadRecruitingState();
        if (!recruiting) {
          throw new Error('Roster-finalization state is unavailable.');
        }
        await finalizeRoster({
          expectedStage: 'roster_cuts',
          expectedYear: recruiting.year,
          expectedRound: 6,
          expectedStatus: 'finalized',
          expectedVersion: recruiting.version,
        });
        break;
      }
      case 'preseason':
        await initializeSeason(league.info.currentYear);
        break;
      case 'season':
        throw new Error('The offseason has already reached the active season.');
    }
  }

  return {
    previousStage: previousStage as OffseasonFlowStage,
    currentStage: target,
    route: getStageRoute(target),
  };
};
