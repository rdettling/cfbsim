import { describe, expect, it } from 'vitest';
import { STAGES } from '../../constants/stages';
import { formatHomeRank, getHomeStatusLabel } from './DynastyLauncher';

describe('Home dynasty status', () => {
  it('shows the current week during the season', () => {
    expect(getHomeStatusLabel(2026, 'season', 2)).toBe(
      '2026 Season · Week 2',
    );
  });

  it('shows the established label for every non-season stage', () => {
    STAGES.filter(stage => stage.id !== 'season').forEach(stage => {
      expect(getHomeStatusLabel(2026, stage.id, 2)).toBe(
        `2026 Season · ${stage.label}`,
      );
    });
  });

  it('formats ranked and unranked programs', () => {
    expect(formatHomeRank(7)).toBe('#7');
    expect(formatHomeRank(0)).toBe('Unranked');
  });
});
