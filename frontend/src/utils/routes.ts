// Route definitions matching App.tsx
export const ROUTES = {
    HOME: '/',
    NONCON: '/noncon',
    DASHBOARD: '/dashboard',
    RANKINGS: '/rankings',
    TEAM_SCHEDULE: '/:teamName/schedule',
    TEAM_ROSTER: '/:teamName/roster',
    TEAM_HISTORY: '/:teamName/history',
    PLAYOFF: '/playoff',
    STANDINGS: '/standings/:conference_name',
    PLAYER: '/players/:playerId',
    WEEK_SCHEDULE: '/schedule/:week',
    GAME: '/game/:id',
    TEAM_STATS: '/stats/team',
    INDIVIDUAL_STATS: '/stats/individual',
    RATINGS_STATS: '/stats/ratings',
    SEASON_SUMMARY: '/summary',
    ROSTER_PROGRESSION: '/roster_progression',
} as const;

// Helper function to generate game route
export const getGameRoute = (gameId: string) => `/game/${gameId}`;

// Helper function to generate team schedule route
export const getTeamScheduleRoute = (teamName: string) => `/${teamName}/schedule`;

// Helper function to generate team roster route
export const getTeamRosterRoute = (teamName: string) => `/${teamName}/roster`;

// Helper function to generate team history route
export const getTeamHistoryRoute = (teamName: string) => `/${teamName}/history`;

// Helper function to generate standings route
export const getStandingsRoute = (conferenceName: string) => `/standings/${conferenceName}`;

// Helper function to generate player route
export const getPlayerRoute = (playerId: string) => `/players/${playerId}`;

// Helper function to generate week schedule route
export const getWeekScheduleRoute = (week: string) => `/schedule/${week}`; 