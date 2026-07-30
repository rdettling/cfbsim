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
  label: string;
  path: string;
}

export interface NavigationGroup {
  id: string;
  desktopLabel: string;
  mobileLabel: string;
  items: NavigationItem[];
}

export interface NavigationModel {
  leading: NavigationItem[];
  groups: NavigationGroup[];
  trailing: NavigationItem[];
}

export type StageInfo = StageDefinition;

export const getNavigationTeamName = ({ team, info }: AppNavigationData) =>
  info.team || team.name;

export const buildNavigationModel = ({
  team,
  info,
  conferences,
}: AppNavigationData): NavigationModel => ({
  leading: [{ label: 'Dashboard', path: '/dashboard' }],
  groups: [
    {
      id: 'team',
      desktopLabel: 'Team',
      mobileLabel: 'Team',
      items: [
        { label: 'Schedule', path: `/${info.team || team.name}/schedule` },
        { label: 'Roster', path: `/${info.team || team.name}/roster` },
        { label: 'History', path: `/${info.team || team.name}/history` },
      ],
    },
    {
      id: 'standings',
      desktopLabel: 'Standings',
      mobileLabel: 'Conference standings',
      items: [
        ...conferences
          .filter(conference => conference.confName.toLowerCase() !== 'independent')
          .map(conference => ({
            label: conference.confName,
            path: `/standings/${conference.confName}`,
          })),
        { label: 'Independent', path: '/standings/independent' },
      ],
    },
    {
      id: 'stats',
      desktopLabel: 'Stats',
      mobileLabel: 'Stats',
      items: [
        { label: 'Team', path: '/stats/team' },
        { label: 'Individual', path: '/stats/individual' },
        { label: 'Ratings', path: '/stats/ratings' },
        { label: 'Awards', path: '/awards' },
      ],
    },
    {
      id: 'schedule',
      desktopLabel: 'Schedule',
      mobileLabel: 'Weekly schedule',
      items: Array.from({ length: info.lastWeek }, (_, index) => ({
        label: `Week ${index + 1}`,
        path: `/schedule/${index + 1}`,
      })),
    },
  ],
  trailing: [
    { label: 'Rankings', path: '/rankings' },
    { label: 'Playoff', path: '/playoff' },
  ],
});

export const normalizePath = (path: string) => {
  const decoded = decodeURIComponent(path);
  const trimmed = decoded.endsWith('/') && decoded.length > 1
    ? decoded.slice(0, -1)
    : decoded;
  return trimmed.toLowerCase();
};

export const isPathActive = (currentPath: string, path: string) => {
  const targetPath = normalizePath(path);
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
};

export const isGroupActive = (currentPath: string, group: NavigationGroup) =>
  group.items.some(item => isPathActive(currentPath, item.path));
