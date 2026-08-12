import { describe, expect, it } from 'vitest';
import { canonicalCfbdTeamName } from './cfbd_team_names';

describe('CFBD team-name normalization', () => {
  it('maps provider abbreviations to canonical program names', () => {
    expect(canonicalCfbdTeamName('TCU')).toBe('Texas Christian');
    expect(canonicalCfbdTeamName('SMU')).toBe('Southern Methodist');
    expect(canonicalCfbdTeamName('UAB')).toBe('Alabama Birmingham');
  });

  it('maps provider punctuation and Unicode variants', () => {
    expect(canonicalCfbdTeamName("Hawai'i")).toBe('Hawaii');
    expect(canonicalCfbdTeamName('Miami (OH)')).toBe('Miami Ohio');
    expect(canonicalCfbdTeamName('San José State')).toBe('San Jose State');
  });

  it('preserves names without a provider alias', () => {
    expect(canonicalCfbdTeamName('Lower Division State'))
      .toBe('Lower Division State');
  });
});
