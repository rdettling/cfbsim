import type {
  RecruitingProspect,
  RecruitingState,
} from '../types/recruiting';

export const buildRecruitingProspect = (
  overrides: Partial<RecruitingProspect> = {},
): RecruitingProspect => ({
  id: 1,
  nationalRank: 1,
  first: 'Pat',
  last: 'Prospect',
  state: 'TS',
  position: 'qb',
  stars: 4,
  ratingFr: 70,
  ratingSo: 75,
  ratingJr: 79,
  ratingSr: 82,
  publicRatingMin: 65,
  publicRatingMax: 75,
  preferenceWeights: {
    prestige: 25,
    proximity: 25,
    playingTime: 25,
    recentSuccess: 25,
  },
  interest: [],
  committedTeamId: null,
  committedRound: null,
  ...overrides,
});

export const buildRecruitingState = (
  overrides: Partial<RecruitingState> = {},
): RecruitingState => ({
  year: 2025,
  round: 6,
  status: 'finalized',
  seed: 10,
  version: 8,
  prospects: [],
  teams: [
    {
      teamId: 1,
      board: [],
      allocations: {},
      commitmentIds: [],
      baseSigningCapacity: 1,
      oversignCapacity: 5,
      pointBudget: 105,
    },
  ],
  pendingUserCutIds: [],
  ...overrides,
});
