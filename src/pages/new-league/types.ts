export type CreationSection = 'program' | 'rules';
export type RulesTab = 'alignment' | 'postseason';
export type AlignmentMode = 'historical' | 'custom';
export type CreationProgress = 'idle' | 'checking' | 'creating';

export const CREATION_SECTIONS: Array<{
  id: CreationSection;
  label: string;
}> = [
  { id: 'program', label: 'Program' },
  { id: 'rules', label: 'League Rules' },
];

export const canAccessCreationSection = (
  section: CreationSection,
  hasProgram: boolean,
) =>
  section === 'program' || (section === 'rules' && hasProgram);

export const getCreateActionLabel = (progress: CreationProgress) =>
  progress === 'checking'
    ? 'Checking setup…'
    : progress === 'creating'
      ? 'Creating dynasty…'
      : 'Create dynasty';
