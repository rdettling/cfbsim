import type {
  RecruitingInterestEntry,
  RecruitingSimulationState,
  TeamRecruitingState,
} from '../../types/recruiting';
import { canAcceptCommitment } from './capacity';
import { RECRUITING } from './config';
import type { RecruitingContext } from './context';
import { createSeededRandom } from '../utils/random';
import { indexRecruitingState } from './validation';

export type RecruitingResolutionPhase = 'round' | 'signing_day';

export const getRecruitingInterestTotal = (
  entry: RecruitingInterestEntry,
) => entry.initial + entry.earned;

const incomingPositions = (
  team: TeamRecruitingState,
  prospectsById: ReturnType<
    typeof indexRecruitingState
  >['prospectsById'],
  extraPosition?: string,
) => [
  ...team.commitmentIds
    .map(id => prospectsById.get(id)?.position)
    .filter((position): position is string => Boolean(position)),
  ...(extraPosition ? [extraPosition] : []),
];

export const getRecruitingCommitmentCandidates = (
  state: RecruitingSimulationState,
  prospectId: number,
  context: RecruitingContext,
  phase: RecruitingResolutionPhase,
  index = indexRecruitingState(state),
) => {
  const { prospectsById } = index;
  const prospect = prospectsById.get(prospectId);
  if (!prospect) return [];

  return state.teams
    .filter(team => {
      if (!team.board.includes(prospectId)) return false;
      const entry = prospect.interest.find(
        candidate => candidate.teamId === team.teamId,
      );
      return (
        (entry?.lifetimePoints ?? 0) >= RECRUITING.meaningfulPursuitPoints
      );
    })
    .map(team => {
      const interest = prospect.interest.find(
        entry => entry.teamId === team.teamId,
      )!;
      const tie =
        phase === 'signing_day'
          ? createSeededRandom(state.seed)
              .fork(`signing:${prospect.id}:${team.teamId}`)
              .next()
          : createSeededRandom(state.seed)
              .fork(`round:${state.round}:${prospect.id}:${team.teamId}`)
              .next();
      return {
        team,
        interest,
        totalInterest: getRecruitingInterestTotal(interest),
        tie,
      };
    })
    .filter(({ team }) =>
      canAcceptCommitment(
        context,
        team.teamId,
        incomingPositions(team, prospectsById, prospect.position),
      ),
    )
    .sort(
      (left, right) =>
        right.totalInterest - left.totalInterest || left.tie - right.tie,
    );
};
