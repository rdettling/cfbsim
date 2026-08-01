import { describe, expect, it } from 'vitest';
import {
  canAccessCreationSection,
  getCreateActionLabel,
  type CreationProgress,
} from './types';

describe('new dynasty workspace progression', () => {
  it('unlocks league rules after a program is selected', () => {
    expect(canAccessCreationSection('program', false)).toBe(true);
    expect(canAccessCreationSection('rules', false)).toBe(false);
    expect(canAccessCreationSection('rules', true)).toBe(true);
  });

  it.each<CreationProgress>(['idle', 'checking', 'creating'])(
    'labels the continuous create action for %s progress',
    progress => {
      const label = getCreateActionLabel(progress);
      expect(label).toBe(
        progress === 'checking'
          ? 'Checking setup…'
          : progress === 'creating'
            ? 'Creating dynasty…'
            : 'Create dynasty',
      );
    },
  );
});
