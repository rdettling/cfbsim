import type {
  LeagueStage,
  OffseasonStage,
} from '../types/domain';
import { ROUTES } from './routes';

export interface StageDefinition {
  id: LeagueStage;
  banner_label: string;
  flowLabel: string;
  label: string;
  path: string;
  next: LeagueStage;
  season: boolean;
}

export const STAGES = [
  {
    id: 'preseason',
    banner_label: 'Preseason',
    flowLabel: 'Scheduling',
    label: 'Non-Conference scheduling',
    path: ROUTES.NONCON,
    next: 'season',
    season: false,
  },
  {
    id: 'season',
    banner_label: 'Season',
    flowLabel: 'Season',
    label: 'Season',
    path: ROUTES.DASHBOARD,
    next: 'summary',
    season: true,
  },
  {
    id: 'summary',
    banner_label: 'Season Summary',
    flowLabel: 'Summary',
    label: 'Season Summary',
    path: ROUTES.SEASON_SUMMARY,
    next: 'realignment',
    season: false,
  },
  {
    id: 'realignment',
    banner_label: 'Offseason',
    flowLabel: 'Setup',
    label: 'Next Season Setup',
    path: ROUTES.REALIGNMENT,
    next: 'progression',
    season: false,
  },
  {
    id: 'progression',
    banner_label: 'Offseason',
    flowLabel: 'Progression',
    label: 'Roster Progression',
    path: ROUTES.ROSTER_PROGRESSION,
    next: 'recruiting',
    season: false,
  },
  {
    id: 'recruiting',
    banner_label: 'Offseason',
    flowLabel: 'Recruiting',
    label: 'Recruiting',
    path: ROUTES.RECRUITING,
    next: 'recruiting_summary',
    season: false,
  },
  {
    id: 'recruiting_summary',
    banner_label: 'Offseason',
    flowLabel: 'Results',
    label: 'Recruiting Summary',
    path: ROUTES.RECRUITING_SUMMARY,
    next: 'roster_cuts',
    season: false,
  },
  {
    id: 'roster_cuts',
    banner_label: 'Offseason',
    flowLabel: 'Roster Cuts',
    label: 'Roster Cuts',
    path: ROUTES.ROSTER_CUTS,
    next: 'preseason',
    season: false,
  },
] as const satisfies readonly StageDefinition[];

export const OFFSEASON_FLOW_STAGE_IDS = [
  'summary',
  'realignment',
  'progression',
  'recruiting',
  'recruiting_summary',
  'roster_cuts',
  'preseason',
] as const satisfies readonly LeagueStage[];

export type OffseasonFlowStage =
  (typeof OFFSEASON_FLOW_STAGE_IDS)[number];

export type OffseasonFlowTarget = Exclude<
  OffseasonFlowStage,
  'summary'
> | 'season';

const STAGES_BY_ID = Object.fromEntries(
  STAGES.map(stage => [stage.id, stage]),
) as Record<LeagueStage, (typeof STAGES)[number]>;

export const getStageDefinition = (stage: LeagueStage) =>
  STAGES_BY_ID[stage];

export const getStageRoute = (stage: LeagueStage) =>
  getStageDefinition(stage).path;

export const isOffseasonFlowStage = (
  stage: LeagueStage,
): stage is OffseasonFlowStage =>
  OFFSEASON_FLOW_STAGE_IDS.some(flowStage => flowStage === stage);

export const getOffseasonTargetYear = (
  stage: OffseasonFlowStage,
  currentYear: number,
) => stage === 'summary' || stage === 'realignment'
  ? currentYear + 1
  : currentYear;

export function getNextStageDefinition(
  stage: OffseasonStage,
): (typeof STAGES)[number] & {
  id: Exclude<LeagueStage, 'season' | 'summary'>;
};
export function getNextStageDefinition(
  stage: LeagueStage,
): (typeof STAGES)[number];
export function getNextStageDefinition(stage: LeagueStage) {
  return getStageDefinition(getStageDefinition(stage).next);
}
