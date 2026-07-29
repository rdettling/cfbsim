import { loadRecruitingLifecycleSnapshot } from '../../../db/recruitingRepo';
import type { RecruitingRound } from '../../../types/recruiting';
import { buildAiRecruitingSnapshot } from '../../recruiting/aiSnapshot';
import { RECRUITING } from '../../recruiting/config';
import { buildRecruitingContext } from '../../recruiting/context';
import { calculateTeamFit } from '../../recruiting/fit';
import {
  getMaxProspectAllocation,
  roundRecruitingValue,
} from '../../recruiting/rules';
import {
  getRecruitingCommitmentCandidates,
  getRecruitingInterestTotal,
} from '../../recruiting/standings';
import { indexRecruitingState } from '../../recruiting/validation';
import { requireRecruitingState } from '../recruiting';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

const EMPTY_RECRUITING = {
  cursor: null,
  userRecruiting: null,
  prospects: [],
  positions: [],
  rules: null,
};

export const loadRecruiting = async () => {
  const { league, recruiting, players } =
    await loadRecruitingLifecycleSnapshot();
  const envelope = buildLeagueNavigationEnvelope(league);

  if (league.info.stage !== 'recruiting') {
    return {
      ...envelope,
      ...structuredClone(EMPTY_RECRUITING),
    };
  }

  const state = requireRecruitingState(recruiting);
  if (state.year !== league.info.currentYear) {
    throw new Error(
      `Recruiting year ${state.year} does not match league year ${league.info.currentYear}.`,
    );
  }
  if (state.status === 'finalized') {
    throw new Error(
      'Finalized recruiting state cannot remain in the Recruiting stage.',
    );
  }

  const userTeam = envelope.team;
  const userState = state.teams.find(team => team.teamId === userTeam.id);
  if (!userState) {
    throw new Error(
      `Recruiting state is missing the user team ${userTeam.id}.`,
    );
  }

  const context = buildRecruitingContext(league.teams, players);
  const publicSnapshot = buildAiRecruitingSnapshot(state, context);
  const publicUser = publicSnapshot.teams.find(
    team => team.teamId === userTeam.id,
  );
  if (!publicUser) {
    throw new Error(
      `Recruiting snapshot is missing the user team ${userTeam.id}.`,
    );
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const teamStatesById = new Map(
    state.teams.map(team => [team.teamId, team]),
  );
  const fitsByProspectId = new Map(
    publicUser.prospectFits.map(entry => [entry.prospectId, entry]),
  );
  const phase =
    state.status === 'ready_for_signing_day' ? 'signing_day' : 'round';
  const stateIndex = indexRecruitingState(state);

  const prospects = [...state.prospects]
    .sort(
      (left, right) =>
        left.nationalRank - right.nationalRank || left.id - right.id,
    )
    .map(prospect => {
      const candidates = getRecruitingCommitmentCandidates(
        state,
        prospect.id,
        context,
        phase,
        stateIndex,
      );
      const leader = candidates[0];
      const runnerUp = candidates[1];
      const leadMargin = leader
        ? roundRecruitingValue(
            leader.totalInterest - (runnerUp?.totalInterest ?? 0),
          )
        : 0;
      const candidateIds = new Set(
        candidates.map(candidate => candidate.team.teamId),
      );
      const standings = prospect.interest
        .map(entry => {
          const team = teamsById.get(entry.teamId);
          const teamState = teamStatesById.get(entry.teamId);
          if (!team || !teamState) {
            throw new Error(
              `Recruiting interest references unknown team ${entry.teamId}.`,
            );
          }
          return {
            teamId: team.id,
            teamName: team.name,
            totalInterest: roundRecruitingValue(
              getRecruitingInterestTotal(entry),
            ),
            lifetimePoints: entry.lifetimePoints,
            offerActive: teamState.board.includes(prospect.id),
            meaningful:
              entry.lifetimePoints >= RECRUITING.meaningfulPursuitPoints,
            eligible: candidateIds.has(team.id),
            leader: leader?.team.teamId === team.id,
          };
        })
        .sort(
          (left, right) =>
            right.totalInterest - left.totalInterest ||
            left.teamName.localeCompare(right.teamName) ||
            left.teamId - right.teamId,
        );
      const commitmentTeam =
        prospect.committedTeamId === null
          ? null
          : teamsById.get(prospect.committedTeamId);
      if (prospect.committedTeamId !== null && !commitmentTeam) {
        throw new Error(
          `Recruiting commitment references unknown team ${prospect.committedTeamId}.`,
        );
      }
      const fit = fitsByProspectId.get(prospect.id);
      if (!fit) {
        throw new Error(
          `Recruiting snapshot is missing prospect ${prospect.id}.`,
        );
      }

      return {
        id: prospect.id,
        nationalRank: prospect.nationalRank,
        first: prospect.first,
        last: prospect.last,
        state: prospect.state,
        position: prospect.position,
        stars: prospect.stars,
        preferenceWeights: { ...prospect.preferenceWeights },
        userFit: calculateTeamFit(prospect, userTeam, context),
        onUserBoard: userState.board.includes(prospect.id),
        canAdd:
          prospect.committedTeamId === null &&
          !userState.board.includes(prospect.id) &&
          userState.board.length < RECRUITING.boardLimit &&
          fit.canAccept,
        canAcceptCommitment: fit.canAccept,
        commitment:
          commitmentTeam && prospect.committedRound
            ? {
                teamId: commitmentTeam.id,
                teamName: commitmentTeam.name,
                round: prospect.committedRound,
              }
            : null,
        standings,
        leaderTeamId: leader?.team.teamId ?? null,
        leaderInterest: leader
          ? roundRecruitingValue(leader.totalInterest)
          : 0,
        commitmentThresholdRemaining: leader
          ? roundRecruitingValue(
              Math.max(
                0,
                RECRUITING.commitmentThreshold - leader.totalInterest,
              ),
            )
          : RECRUITING.commitmentThreshold,
        leadMargin,
        commitmentLeadRemaining: roundRecruitingValue(
          Math.max(0, RECRUITING.commitmentLead - leadMargin),
        ),
      };
    });

  return {
    ...envelope,
    cursor: {
      stage: 'recruiting' as const,
      year: state.year,
      round: state.round as RecruitingRound,
      status: state.status,
      version: state.version,
    },
    userRecruiting: {
      teamId: userTeam.id,
      pointBudget: userState.pointBudget,
      perProspectCap: getMaxProspectAllocation(userState.pointBudget),
      boardLimit: RECRUITING.boardLimit,
      boardIds: [...userState.board],
      commitmentIds: [...userState.commitmentIds],
      baseSigningCapacity: userState.baseSigningCapacity,
      maximumSigningCapacity: userState.oversignCapacity,
      remainingBaseSlots: publicUser.remainingBaseSlots,
      remainingMaximumSlots: publicUser.remainingMaximumSlots,
      positions: Object.entries(publicUser.positions).map(
        ([position, need]) => ({
          position,
          ...need,
        }),
      ),
    },
    rules: {
      meaningfulPursuitPoints: RECRUITING.meaningfulPursuitPoints,
      commitmentThreshold: RECRUITING.commitmentThreshold,
      commitmentLead: RECRUITING.commitmentLead,
    },
    prospects,
    positions: Array.from(
      new Set(prospects.map(prospect => prospect.position)),
    ),
  };
};
