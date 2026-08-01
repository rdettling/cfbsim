import { describe, expect, it } from 'vitest';
import type { NewLeagueDraft } from './newLeagueDraft';
import {
  NEW_LEAGUE_DRAFT_KEY,
  clearNewLeagueDraft,
  loadNewLeagueDraft,
  saveNewLeagueDraft,
} from './newLeagueDraft';

const buildStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
};

const draft: NewLeagueDraft = {
  year: '2025',
  step: 2,
  teamName: 'Test State',
  alignmentMode: 'custom',
  conferencePlan: {
    assignments: { 'Test State': 'Test Conference' },
    conferenceGames: { 'Test Conference': { mode: 'automatic' } },
  },
  playoffTeams: 12,
  playoffAutobids: 1,
  conferenceChampionsReceiveTopSeeds: false,
};

describe('new league session draft', () => {
  it('round trips the active step and setup choices', () => {
    const storage = buildStorage();
    saveNewLeagueDraft(draft, storage);
    expect(loadNewLeagueDraft(storage)).toEqual(draft);
  });

  it('discards malformed drafts', () => {
    const storage = buildStorage();
    storage.values.set(
      NEW_LEAGUE_DRAFT_KEY,
      JSON.stringify({ ...draft, playoffTeams: 6 }),
    );
    expect(loadNewLeagueDraft(storage)).toBeNull();
    expect(storage.values.has(NEW_LEAGUE_DRAFT_KEY)).toBe(false);
  });

  it('discards drafts with malformed conference assignments', () => {
    const storage = buildStorage();
    storage.values.set(
      NEW_LEAGUE_DRAFT_KEY,
      JSON.stringify({
        ...draft,
        conferencePlan: {
          ...draft.conferencePlan,
          assignments: { 'Test State': 42 },
        },
      }),
    );
    expect(loadNewLeagueDraft(storage)).toBeNull();
  });

  it('clears a completed or reset draft', () => {
    const storage = buildStorage();
    saveNewLeagueDraft(draft, storage);
    clearNewLeagueDraft(storage);
    expect(loadNewLeagueDraft(storage)).toBeNull();
  });
});
