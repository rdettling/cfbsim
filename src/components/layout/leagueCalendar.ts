import {
  getOffseasonTargetYear,
  getStageDefinition,
  isOffseasonFlowStage,
  OFFSEASON_FLOW_STAGE_IDS,
  type OffseasonFlowStage,
} from '../../constants/stages';
import { REGULAR_SEASON_WEEKS } from '../../domain/schedule/constants';
import type { AppNavigationData } from './navigation';

export interface OffseasonFlowStep {
  id: OffseasonFlowStage;
  label: string;
  position: number;
  state: 'completed' | 'current' | 'future';
}

export interface SeasonWeekStep {
  week: number;
  state: 'completed' | 'current' | 'future';
  phase: 'regular-season' | 'postseason';
}

export interface SeasonAdvanceDestination {
  targetWeek: number;
  label: string;
  kind: 'week' | 'end';
}

export interface SeasonCalendarModel {
  kind: 'season';
  year: number;
  currentWeek: number;
  lastWeek: number;
  complete: boolean;
  steps: SeasonWeekStep[];
  primaryAction:
    | { kind: 'advance'; label: string; targetWeek: number }
    | { kind: 'summary'; label: string };
  menuDestinations: SeasonAdvanceDestination[];
}

export interface OffseasonCalendarModel {
  kind: 'offseason';
  year: number;
  currentStage: OffseasonFlowStage;
  currentPosition: number;
  steps: OffseasonFlowStep[];
}

export type LeagueCalendarModel = SeasonCalendarModel | OffseasonCalendarModel;

export const buildOffseasonFlowModel = (
  currentStage: OffseasonFlowStage,
): OffseasonFlowStep[] => {
  const currentPosition = OFFSEASON_FLOW_STAGE_IDS.indexOf(currentStage);
  return OFFSEASON_FLOW_STAGE_IDS.map((stage, position) => ({
    id: stage,
    label: getStageDefinition(stage).flowLabel,
    position,
    state:
      position < currentPosition
        ? 'completed'
        : position === currentPosition
          ? 'current'
          : 'future',
  }));
};

export const buildSeasonCalendarModel = (
  year: number,
  currentWeek: number,
  lastWeek: number,
): SeasonCalendarModel => {
  const complete = currentWeek > lastWeek;
  const steps = Array.from({ length: lastWeek }, (_, index): SeasonWeekStep => {
    const week = index + 1;
    return {
      week,
      state: complete || week < currentWeek
        ? 'completed'
        : week === currentWeek
          ? 'current'
          : 'future',
      phase: week <= REGULAR_SEASON_WEEKS ? 'regular-season' : 'postseason',
    };
  });

  if (complete) {
    return {
      kind: 'season',
      year,
      currentWeek,
      lastWeek,
      complete,
      steps,
      primaryAction: { kind: 'summary', label: 'Season Summary' },
      menuDestinations: [],
    };
  }

  const finishing = currentWeek === lastWeek;
  return {
    kind: 'season',
    year,
    currentWeek,
    lastWeek,
    complete,
    steps,
    primaryAction: {
      kind: 'advance',
      label: finishing ? 'Finish Season' : `Advance to Week ${currentWeek + 1}`,
      targetWeek: finishing ? lastWeek + 1 : currentWeek + 1,
    },
    menuDestinations: [
      ...Array.from(
        { length: lastWeek - currentWeek },
        (_, index): SeasonAdvanceDestination => {
          const targetWeek = currentWeek + index + 1;
          return {
            targetWeek,
            label: `Sim to Week ${targetWeek}`,
            kind: 'week',
          };
        },
      ),
      {
        targetWeek: lastWeek + 1,
        label: 'End of Season',
        kind: 'end',
      },
    ],
  };
};

export const buildLeagueCalendarModel = (
  data: AppNavigationData,
): LeagueCalendarModel => {
  if (data.info.stage === 'season') {
    return buildSeasonCalendarModel(
      data.info.currentYear,
      data.info.currentWeek,
      data.info.lastWeek,
    );
  }

  if (!isOffseasonFlowStage(data.info.stage)) {
    throw new Error(`Stage ${data.info.stage} has no league calendar model.`);
  }
  const currentStage = data.info.stage;
  return {
    kind: 'offseason',
    year: getOffseasonTargetYear(currentStage, data.info.currentYear),
    currentStage,
    currentPosition: OFFSEASON_FLOW_STAGE_IDS.indexOf(currentStage),
    steps: buildOffseasonFlowModel(currentStage),
  };
};
