import type { StageDefinition } from '../../constants/stages';
import type { Conference, Info, LeagueStage, Team } from '../../types/domain';

export interface AppNavigationData {
  team: Team;
  currentStage: LeagueStage;
  info: Info;
  conferences: Conference[];
  advanceDisabled?: boolean;
}

export interface StageAdvanceAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface NavigationItem {
  type: 'item';
  label: string;
  path: string;
  match?: 'exact' | 'prefix';
}

export interface NavigationGroup {
  type: 'group';
  id: string;
  desktopLabel: string;
  mobileLabel: string;
  items: NavigationItem[];
}

export interface NavigationModel {
  entries: Array<NavigationItem | NavigationGroup>;
}

export type StageInfo = StageDefinition;

export const getNavigationTeamName = ({ team, info }: AppNavigationData) =>
  info.team || team.name;

export const buildNavigationModel = ({
  team,
  info,
  conferences,
}: AppNavigationData): NavigationModel => ({
  entries: [
    { type: 'item', label: 'Dashboard', path: '/dashboard' },
    {
      type: 'group',
      id: 'team',
      desktopLabel: 'Team',
      mobileLabel: 'Team',
      items: [
        { type: 'item', label: 'Schedule', path: `/${info.team || team.name}/schedule`, match: 'prefix' },
        { type: 'item', label: 'Roster', path: `/${info.team || team.name}/roster` },
        { type: 'item', label: 'History', path: `/${info.team || team.name}/history` },
      ],
    },
    {
      type: 'group',
      id: 'schedule',
      desktopLabel: 'Schedule',
      mobileLabel: 'Weekly schedule',
      items: Array.from({ length: info.lastWeek }, (_, index) => ({
        type: 'item' as const,
        label: `Week ${index + 1}`,
        path: `/schedule/${index + 1}`,
      })),
    },
    {
      type: 'group',
      id: 'standings',
      desktopLabel: 'Standings',
      mobileLabel: 'Conference standings',
      items: [
        ...conferences
          .filter(conference => conference.confName.toLowerCase() !== 'independent')
          .map(conference => ({
            type: 'item' as const,
            label: conference.confName,
            path: `/standings/${conference.confName}`,
          })),
        { type: 'item', label: 'Independent', path: '/standings/independent' },
      ],
    },
    { type: 'item', label: 'Rankings', path: '/rankings' },
    {
      type: 'group',
      id: 'stats',
      desktopLabel: 'Stats',
      mobileLabel: 'Stats',
      items: [
        { type: 'item', label: 'Team Stats', path: '/stats/team' },
        { type: 'item', label: 'Player Stats', path: '/stats/individual' },
        { type: 'item', label: 'Advanced Stats', path: '/stats/advanced' },
        { type: 'item', label: 'Ratings', path: '/stats/ratings' },
        { type: 'item', label: 'Awards', path: '/awards' },
      ],
    },
    {
      type: 'group',
      id: 'postseason',
      desktopLabel: 'Postseason',
      mobileLabel: 'Postseason',
      items: [
        { type: 'item', label: 'Playoff Bracket', path: '/playoff' },
        { type: 'item', label: 'Playoff Picture', path: '/playoff/picture' },
        { type: 'item', label: 'Resume Comparison', path: '/playoff/resumes' },
        { type: 'item', label: 'Projections', path: '/playoff/projections' },
        { type: 'item', label: 'Bowl Games', path: '/playoff/bowls' },
      ],
    },
  ],
});

export const normalizePath = (path: string) => {
  const decoded = decodeURIComponent(path);
  const trimmed = decoded.endsWith('/') && decoded.length > 1
    ? decoded.slice(0, -1)
    : decoded;
  return trimmed.toLowerCase();
};

export const isPathActive = (currentPath: string, item: NavigationItem) => {
  const normalizedCurrentPath = normalizePath(currentPath);
  const targetPath = normalizePath(item.path);
  return normalizedCurrentPath === targetPath ||
    (item.match === 'prefix' && normalizedCurrentPath.startsWith(`${targetPath}/`));
};

export const isGroupActive = (currentPath: string, group: NavigationGroup) =>
  group.items.some(item => isPathActive(currentPath, item));
