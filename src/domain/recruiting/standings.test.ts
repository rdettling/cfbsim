import { describe, expect, it } from 'vitest';
import {
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import { buildRecruitingProspect } from '../../test/recruitingFixtures';
import type { RecruitingSimulationState } from '../../types/recruiting';
import { buildRecruitingContext } from './context';
import { resolveRecruitingRound } from './resolution';
import { createTeamRecruitingStates } from './state';
import { getRecruitingCommitmentCandidates } from './standings';

describe('public recruiting standings', () => {
  it('uses the same eligible ordering as round commitment resolution', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'Alpha' }),
      buildTestTeam({ id: 2, name: 'Beta', state: 'OS', ranking: 2 }),
    ];
    const players = [
      buildTestPlayer({ id: 1, teamId: 1 }),
      buildTestPlayer({ id: 2, teamId: 2 }),
    ];
    const context = buildRecruitingContext(teams, players);
    const teamStates = createTeamRecruitingStates(teams, context);
    teamStates.forEach(team => {
      team.board = [1];
    });
    const state: RecruitingSimulationState = {
      year: 2025,
      round: 1,
      status: 'active',
      seed: 91,
      prospects: [
        buildRecruitingProspect({
          interest: [
            {
              teamId: 1,
              fit: 80,
              initial: 60,
              earned: 0,
              lifetimePoints: 20,
            },
            {
              teamId: 2,
              fit: 70,
              initial: 45,
              earned: 0,
              lifetimePoints: 20,
            },
          ],
        }),
      ],
      teams: teamStates,
    };

    const candidates = getRecruitingCommitmentCandidates(
      state,
      1,
      context,
      'round',
    );
    const result = resolveRecruitingRound(state, {}, context);

    expect(candidates.map(candidate => candidate.team.teamId)).toEqual([1, 2]);
    expect(result.commitments).toEqual([
      { prospectId: 1, teamId: candidates[0].team.teamId, round: 1 },
    ]);
  });

  it('excludes withdrawn and non-meaningful pursuits from the leader', () => {
    const teams = [buildTestTeam()];
    const context = buildRecruitingContext(teams, [buildTestPlayer()]);
    const state: RecruitingSimulationState = {
      year: 2025,
      round: 1,
      status: 'active',
      seed: 5,
      prospects: [
        buildRecruitingProspect({
          interest: [
            {
              teamId: 1,
              fit: 90,
              initial: 90,
              earned: 0,
              lifetimePoints: 19,
            },
          ],
        }),
      ],
      teams: createTeamRecruitingStates(teams, context),
    };

    expect(
      getRecruitingCommitmentCandidates(state, 1, context, 'round'),
    ).toEqual([]);
  });
});
