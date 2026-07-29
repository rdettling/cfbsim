import type { Team } from '../../types/domain';
import type { RecruitingProspect } from '../../types/recruiting';
import { ROSTER } from '../rosterConfig';
import { STAR_RATING_TARGETS } from './config';
import type { RecruitingContext } from './context';

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const ELITE_PRESTIGE_BLEND = 0.9;
const ELITE_PRESTIGE_EXPONENT = 2;

export const calculatePrestigeFit = (prestige: number) =>
  round3(((clamp(prestige, 1, 7) - 1) / 6) * 100);

export const calculateProximityFit = (
  prospectState: string,
  teamState: string,
) =>
  prospectState.trim().toUpperCase() === teamState.trim().toUpperCase()
    ? 100
    : 0;

export const calculateRecentSuccessFit = (rank: number, teamCount: number) => {
  if (teamCount <= 1) return 100;
  if (!Number.isFinite(rank) || rank < 1 || rank > teamCount) return 50;
  return round3(((teamCount - rank) / (teamCount - 1)) * 100);
};

export const calculatePlayingTimeFit = (
  prospect: Pick<
    RecruitingProspect,
    'position' | 'stars'
  >,
  teamId: number,
  context: RecruitingContext,
) => {
  const config = ROSTER[prospect.position];
  if (!config || config.starters <= 0 || config.total <= 0) return 0;
  const expectedRating =
    (STAR_RATING_TARGETS[prospect.stars] ?? STAR_RATING_TARGETS[1])
      .freshman;
  const depth = context.rostersByTeamId
    .get(teamId)
    ?.positions.get(prospect.position);
  const firstWeaker = depth?.ratings.findIndex(
    rating => rating < expectedRating,
  );
  const stronger =
    firstWeaker === undefined
      ? 0
      : firstWeaker === -1
        ? depth!.ratings.length
        : firstWeaker;
  const starterPath =
    clamp((config.starters - stronger) / config.starters, 0, 1) * 100;
  const rosterRoom =
    clamp((config.total - (depth?.count ?? 0)) / config.total, 0, 1) * 100;
  return round3(starterPath * 0.75 + rosterRoom * 0.25);
};

export const calculateTeamFit = (
  prospect: Pick<
    RecruitingProspect,
    | 'state'
    | 'stars'
    | 'position'
    | 'preferenceWeights'
  >,
  team: Team,
  context: RecruitingContext,
) => {
  const weights = prospect.preferenceWeights;
  const preferenceFit =
    calculatePrestigeFit(team.prestige) * weights.prestige +
    calculateProximityFit(prospect.state, team.state) * weights.proximity +
    calculatePlayingTimeFit(prospect, team.id, context) *
      weights.playingTime +
    calculateRecentSuccessFit(team.ranking, context.teamCount) *
      weights.recentSuccess;
  const fit = preferenceFit / 100;
  const elitePrestigeFit =
    ((clamp(team.prestige, 1, 7) - 1) / 6) **
      ELITE_PRESTIGE_EXPONENT *
    100;
  return round3(
    clamp(
      prospect.stars >= 4
        ? fit * (1 - ELITE_PRESTIGE_BLEND) +
            elitePrestigeFit * ELITE_PRESTIGE_BLEND
        : fit,
    ),
  );
};
