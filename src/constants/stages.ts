import type {
  LeagueStage,
  OffseasonStage,
} from '../types/domain';
import { ROUTES } from './routes';

export interface StageDefinition {
  id: LeagueStage;
  banner_label: string;
  label: string;
  path: string;
  next: LeagueStage;
  season: boolean;
}

export const STAGES = [
  {
    id: 'preseason',
    banner_label: 'Preseason',
    label: 'Non-Conference scheduling',
    path: ROUTES.NONCON,
    next: 'season',
    season: false,
  },
  {
    id: 'season',
    banner_label: 'Season',
    label: 'Season',
    path: ROUTES.DASHBOARD,
    next: 'summary',
    season: true,
  },
  {
    id: 'summary',
    banner_label: 'Season Summary',
    label: 'Season Summary',
    path: ROUTES.SEASON_SUMMARY,
    next: 'realignment',
    season: false,
  },
  {
    id: 'realignment',
    banner_label: 'Offseason',
    label: 'Next Season Setup',
    path: ROUTES.REALIGNMENT,
    next: 'progression',
    season: false,
  },
  {
    id: 'progression',
    banner_label: 'Offseason',
    label: 'Roster Progression',
    path: ROUTES.ROSTER_PROGRESSION,
    next: 'recruiting_summary',
    season: false,
  },
  {
    id: 'recruiting_summary',
    banner_label: 'Offseason',
    label: 'Recruiting Summary',
    path: ROUTES.RECRUITING_SUMMARY,
    next: 'roster_cuts',
    season: false,
  },
  {
    id: 'roster_cuts',
    banner_label: 'Offseason',
    label: 'Roster Cuts',
    path: ROUTES.ROSTER_CUTS,
    next: 'preseason',
    season: false,
  },
] as const satisfies readonly StageDefinition[];

const STAGES_BY_ID = Object.fromEntries(
  STAGES.map(stage => [stage.id, stage]),
) as Record<LeagueStage, (typeof STAGES)[number]>;

export const getStageDefinition = (stage: LeagueStage) =>
  STAGES_BY_ID[stage];

export const getStageRoute = (stage: LeagueStage) =>
  getStageDefinition(stage).path;

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
