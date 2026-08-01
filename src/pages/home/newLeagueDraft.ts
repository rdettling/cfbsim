import type {
  CustomConferencePlan,
  PlayoffTeamCount,
} from '../../types/domain';

export type NewLeagueAlignmentMode = 'historical' | 'custom';

export interface NewLeagueDraft {
  year: string;
  step: number;
  teamName: string | null;
  alignmentMode: NewLeagueAlignmentMode;
  conferencePlan: CustomConferencePlan;
  playoffTeams: PlayoffTeamCount;
  playoffAutobids: number;
  conferenceChampionsReceiveTopSeeds: boolean;
}

export const NEW_LEAGUE_DRAFT_KEY = 'cfbsim:new-league-draft:v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPlayoffTeams = (value: unknown): value is PlayoffTeamCount =>
  value === 2 || value === 4 || value === 12;

const isConferencePlan = (value: unknown): value is CustomConferencePlan => {
  if (
    !isRecord(value) ||
    !isRecord(value.assignments) ||
    !isRecord(value.conferenceGames)
  ) {
    return false;
  }
  const assignmentsValid = Object.values(value.assignments).every(
    assignment => assignment === null || typeof assignment === 'string',
  );
  const gamesValid = Object.values(value.conferenceGames).every(setting =>
    isRecord(setting) &&
    (
      setting.mode === 'automatic' ||
      (
        setting.mode === 'manual' &&
        Number.isInteger(setting.target) &&
        Number(setting.target) >= 1 &&
        Number(setting.target) <= 12
      )
    ),
  );
  return assignmentsValid && gamesValid;
};

export const loadNewLeagueDraft = (
  storage: Pick<Storage, 'getItem' | 'removeItem'> = sessionStorage,
): NewLeagueDraft | null => {
  try {
    const raw = storage.getItem(NEW_LEAGUE_DRAFT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      typeof value.year !== 'string' ||
      !value.year.length ||
      !Number.isInteger(value.step) ||
      Number(value.step) < 0 ||
      Number(value.step) > 4 ||
      (value.teamName !== null && typeof value.teamName !== 'string') ||
      (value.alignmentMode !== 'historical' && value.alignmentMode !== 'custom') ||
      !isConferencePlan(value.conferencePlan) ||
      !isPlayoffTeams(value.playoffTeams) ||
      !Number.isInteger(value.playoffAutobids) ||
      Number(value.playoffAutobids) < 0 ||
      Number(value.playoffAutobids) > 10 ||
      typeof value.conferenceChampionsReceiveTopSeeds !== 'boolean'
    ) {
      storage.removeItem(NEW_LEAGUE_DRAFT_KEY);
      return null;
    }
    return value as unknown as NewLeagueDraft;
  } catch {
    storage.removeItem(NEW_LEAGUE_DRAFT_KEY);
    return null;
  }
};

export const saveNewLeagueDraft = (
  draft: NewLeagueDraft,
  storage: Pick<Storage, 'setItem'> = sessionStorage,
) => {
  storage.setItem(NEW_LEAGUE_DRAFT_KEY, JSON.stringify(draft));
};

export const clearNewLeagueDraft = (
  storage: Pick<Storage, 'removeItem'> = sessionStorage,
) => {
  storage.removeItem(NEW_LEAGUE_DRAFT_KEY);
};
