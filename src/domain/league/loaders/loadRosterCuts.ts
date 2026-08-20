import { loadRecruitingLifecycleSnapshot } from '../../../db/recruitingRepo';
import type {
  RosterCutPlayerPreview,
  RosterCutsSummary,
  RosterPositionCutPreview,
} from '../../../types/roster';
import { buildRosterCutsPreview } from '../../rosterCuts';
import {
  requireFinalizedRecruitingState,
} from '../utils/recruitingLifecycleState';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

const EMPTY_SUMMARY: RosterCutsSummary = {
  activePlayers: 0,
  requiredCuts: 0,
  selectedCuts: 0,
  remainingCuts: 0,
  projectedCuts: 0,
  projectedRosterSize: 0,
  positionsOverLimit: 0,
};

export const loadRosterCuts = async () => {
  const { league, recruiting, players } =
    await loadRecruitingLifecycleSnapshot();

  const envelope = buildLeagueNavigationEnvelope(league);
  const { team } = envelope;
  if (league.info.stage !== 'roster_cuts') {
    return {
      ...envelope,
      players: [] as RosterCutPlayerPreview[],
      selectedCutIds: [] as number[],
      recommendedCutIds: [] as number[],
      positions: [] as RosterPositionCutPreview[],
      summary: { ...EMPTY_SUMMARY },
      cursor: null,
    };
  }

  const state = requireFinalizedRecruitingState(
    recruiting,
    league.info.currentYear,
  );
  const preview = buildRosterCutsPreview({
    players,
    teamId: team.id,
    year: state.year,
    seed: state.seed,
    selectedCutIds: state.pendingUserCutIds,
  });

  return {
    ...envelope,
    ...preview,
    cursor: {
      stage: 'roster_cuts' as const,
      year: state.year,
      round: state.round,
      status: state.status,
      version: state.version,
      pendingUserCutIds: [...state.pendingUserCutIds],
      requiredCuts: preview.summary.requiredCuts,
    },
  };
};
