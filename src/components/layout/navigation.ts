import { ROUTES } from '../../constants/routes';
import type { LeagueNavigationData } from '../../types/navigation';

export interface AppNavigationData extends LeagueNavigationData {
  advanceDisabled?: boolean;
}

export interface OffseasonAdvanceContext {
  recruitingAllocations?: Record<number, number>;
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

const isTeamContextPath = (pathname: string) =>
  /^\/[^/]+\/(schedule|roster|stats|history)(?:\/|$)/i.test(
    normalizePath(pathname),
  );

export const getUserTeamName = ({ team, info }: AppNavigationData) =>
  info.team || team.name;

export const getTeamContextName = (
  { team, info }: AppNavigationData,
  pathname = '',
) => isTeamContextPath(pathname) ? team.name : info.team || team.name;

export const buildNavigationModel = ({
  team,
  info,
  conferences,
  playoffTeams,
}: AppNavigationData, navigationTeamName = info.team || team.name): NavigationModel => ({
  entries: [
    { type: 'item', label: 'Dashboard', path: '/dashboard' },
    {
      type: 'group',
      id: 'league',
      desktopLabel: 'League',
      mobileLabel: 'League',
      items: [
        { type: 'item', label: 'News', path: ROUTES.NEWS, match: 'prefix' },
        { type: 'item', label: 'Biggest Upsets', path: ROUTES.BIGGEST_UPSETS },
        { type: 'item', label: 'Awards', path: '/awards' },
        { type: 'item', label: 'History', path: '/league/history', match: 'prefix' },
        { type: 'item', label: 'Records', path: '/league/records' },
      ],
    },
    {
      type: 'group',
      id: 'team',
      desktopLabel: 'Team',
      mobileLabel: 'Team',
      items: [
        { type: 'item', label: 'Schedule', path: `/${navigationTeamName}/schedule`, match: 'prefix' },
        { type: 'item', label: 'Roster', path: `/${navigationTeamName}/roster` },
        { type: 'item', label: 'Stats', path: `/${navigationTeamName}/stats` },
        { type: 'item', label: 'History', path: `/${navigationTeamName}/history` },
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
        { type: 'item', label: 'Team Rankings', path: '/stats/teams' },
        { type: 'item', label: 'Player Leaders', path: '/stats/players' },
        { type: 'item', label: 'Advanced Stats', path: '/stats/advanced' },
        { type: 'item', label: 'Ratings', path: '/stats/ratings' },
      ],
    },
    {
      type: 'group',
      id: 'postseason',
      desktopLabel: 'Postseason',
      mobileLabel: 'Postseason',
      items: [
        ...(playoffTeams === 12
          ? [{ type: 'item' as const, label: 'Playoff Bracket', path: '/playoff' }]
          : []),
        { type: 'item', label: 'Bowl Games', path: '/playoff/bowls' },
        { type: 'item', label: 'Resume Comparison', path: '/playoff/resumes' },
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
