import { describe, expect, it } from 'vitest';
import type { LeagueStage } from '../types/domain';
import {
  getNextStageDefinition,
  getStageDefinition,
  getStageRoute,
  STAGES,
} from './stages';

const EXPECTED_STAGES: LeagueStage[] = [
  'preseason',
  'season',
  'summary',
  'realignment',
  'progression',
  'recruiting_summary',
  'roster_cuts',
];

describe('stage catalog', () => {
  it('defines every league stage exactly once', () => {
    expect(STAGES.map(stage => stage.id)).toEqual(EXPECTED_STAGES);
    expect(new Set(STAGES.map(stage => stage.id)).size).toBe(
      EXPECTED_STAGES.length,
    );
  });

  it('resolves every route and next stage from the same catalog', () => {
    EXPECTED_STAGES.forEach(stage => {
      const definition = getStageDefinition(stage);

      expect(definition.id).toBe(stage);
      expect(getStageRoute(stage)).toBe(definition.path);
      expect(getNextStageDefinition(stage)).toBe(
        getStageDefinition(definition.next),
      );
    });
  });

  it('preserves the authoritative annual lifecycle', () => {
    expect(
      EXPECTED_STAGES.map(stage => [
        stage,
        getNextStageDefinition(stage).id,
      ]),
    ).toEqual([
      ['preseason', 'season'],
      ['season', 'summary'],
      ['summary', 'realignment'],
      ['realignment', 'progression'],
      ['progression', 'recruiting_summary'],
      ['recruiting_summary', 'roster_cuts'],
      ['roster_cuts', 'preseason'],
    ]);
  });
});
