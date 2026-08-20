import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../../../src/test/fixtures';
import { buildRecruitingProspect } from '../../../src/test/recruitingFixtures';
import type { RecruitingSimulationState } from '../../../src/types/recruiting';
import { runAiRecruitingCycle } from './aiCycle';
import { buildRecruitingContext } from '../../../src/domain/recruiting/context';
import { createTeamRecruitingStates } from '../../../src/domain/recruiting/state';
import { ROSTER } from '../../../src/domain/rosterConfig';

const teams = [
  buildTestTeam({ id: 1, name: 'One', abbreviation: 'ONE', prestige: 2 }),
  buildTestTeam({
    id: 2,
    name: 'Two',
    abbreviation: 'TWO',
    prestige: 6,
    ranking: 2,
    state: 'OS',
  }),
];
const players = teams.flatMap(team => {
  let id = (team.id - 1) * 100 + 1;
  return Object.entries(ROSTER).flatMap(([position, config]) =>
    Array.from(
      {
        length:
          config.total -
          (position === 'qb' || position === 'wr' ? 1 : 0),
      },
      () =>
        buildTestPlayer({
          id: id++,
          teamId: team.id,
          pos: position,
        }),
    ),
  );
});
const context = buildRecruitingContext(teams, players);
const makeState = (): RecruitingSimulationState => ({
  year: 2026,
  round: 1,
  status: 'active',
  seed: 77,
  prospects: Array.from({ length: 12 }, (_, index) =>
    buildRecruitingProspect({
      id: index + 1,
      nationalRank: index + 1,
      position: index % 2 ? 'qb' : 'wr',
      stars: index < 2 ? 4 : 3,
      publicRatingMin: 60 - Math.floor(index / 3),
      publicRatingMax: 70 - Math.floor(index / 3),
    }),
  ),
  teams: createTeamRecruitingStates(teams, context),
});

describe('AI recruiting cycle baseline', () => {
  it('runs six rounds and signing day reproducibly through production rules', () => {
    const first = runAiRecruitingCycle(makeState(), context);
    const second = runAiRecruitingCycle(makeState(), context);
    expect(first).toEqual(second);
    expect(first.state.status).toBe('finalized');
    expect(first.decisionsByRound).toHaveLength(6);
    expect(first.report.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(first.report.averageBudgetUse).toBeGreaterThan(0);
    expect(first.report.baseCapacityCompletion).toBeGreaterThan(0);
    expect(first.report.meaningfulPursuits).toBeGreaterThanOrEqual(
      first.report.meaningfullyPursuedProspects,
    );
    expect(first.report.meaningfulCompetitionRate).toBe(
      first.report.meaningfullyPursuedProspects > 0
        ? first.report.contestedMeaningfulProspects /
            first.report.meaningfullyPursuedProspects
        : 0,
    );
    expect(first.report.pursuitsAdmitted).toBeGreaterThan(0);

    const committedIds = first.state.prospects
      .filter(prospect => prospect.committedTeamId !== null)
      .map(prospect => prospect.id);
    expect(new Set(committedIds).size).toBe(committedIds.length);
    first.state.teams.forEach(team => {
      expect(team.commitmentIds.length).toBeLessThanOrEqual(
        team.oversignCapacity,
      );
    });
  });

  it('does not mutate the supplied recruiting state', () => {
    const state = makeState();
    const before = structuredClone(state);
    runAiRecruitingCycle(state, context);
    expect(state).toEqual(before);
  });
});
