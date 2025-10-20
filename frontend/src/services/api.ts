import axios, { AxiosResponse, AxiosError } from 'axios';

// Determine if we're in production based on the URL
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

// Set the base URL for API requests
export const API_BASE_URL = isProduction
    ? '' // In production, use relative URLs (empty string for same domain)
    : 'http://127.0.0.1:8000'; // In development, use the local server

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
    RECRUITING_SUMMARY: '/recruiting_summary',
} as const;

// Helper functions to generate routes
export const getGameRoute = (gameId: string) => `/game/${gameId}`;
export const getTeamScheduleRoute = (teamName: string) => `/${teamName}/schedule`;
export const getTeamRosterRoute = (teamName: string) => `/${teamName}/roster`;
export const getTeamHistoryRoute = (teamName: string) => `/${teamName}/history`;
export const getStandingsRoute = (conferenceName: string) => `/standings/${conferenceName}`;
export const getPlayerRoute = (playerId: string) => `/players/${playerId}`;
export const getWeekScheduleRoute = (week: string) => `/schedule/${week}`;

// Create an axios instance with the base URL
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Enable cookies for cross-origin requests
});

// Add client ID to all requests
api.interceptors.request.use(config => {
    const userId = localStorage.getItem('user_id');
    
    if (userId) {
        config.headers['X-User-ID'] = userId;
    }
    
    return config;
});

// Store client ID from response if present
api.interceptors.response.use(
    response => {
        // Only store user_id if explicitly provided in response
        if (response.data.user_id) {
            localStorage.setItem('user_id', response.data.user_id);
        }
        return response;
    },
    error => {
        // Handle redirect errors
        if (error.response?.data?.redirect) {
            window.location.href = error.response.data.redirect;
        }
        return Promise.reject(error);
    }
);

// Generic error handler
const handleError = (error: AxiosError): never => {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
};

// Generic API request function with type safety
const request = async <T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    options?: { params?: Record<string, any>; data?: any }
): Promise<T> => {
    try {
        // Create the config object
        const config = {
            params: options?.params
        };

        // Make the API request
        let response: AxiosResponse<T>;
        
        switch (method) {
            case 'get':
                response = await api.get<T>(url, config);
                break;
            case 'post':
                response = await api.post<T>(url, options?.data, config);
                break;
            case 'put':
                response = await api.put<T>(url, options?.data, config);
                break;
            case 'delete':
                response = await api.delete<T>(url, config);
                break;
        }
        
        return response.data;
    } catch (error) {
        return handleError(error as AxiosError);
    }
};

// API endpoint functions
export const apiService = {
    // Home page
    getHome: <T>(year?: string) => 
        request<T>('get', '/api/home/', year ? { params: { year } } : undefined),
    
    // Non-conference
    getNonCon: <T>() => 
        request<T>('get', '/api/noncon/'),
    
    // Dashboard
    getDashboard: <T>() => 
        request<T>('get', '/api/dashboard/'),
    
    // Rankings
    getRankings: <T>(week?: number) => 
        request<T>('get', '/api/rankings/', week ? { params: { week } } : undefined),
    
    // Team related endpoints
    getTeamSchedule: <T>(teamName: string, year?: string) => 
        request<T>('get', `/api/${teamName}/schedule/`, year ? { params: { year } } : undefined),
    getTeamRoster: <T>(teamName: string) => 
        request<T>('get', `/api/${teamName}/roster/`),
    getTeamHistory: <T>(teamName: string) => 
        request<T>('get', `/api/${teamName}/history/`),
    getTeamStats: <T>(teamName: string) => 
        request<T>('get', `/api/${teamName}/stats/`),
    
    // Playoff
    getPlayoff: <T>() => 
        request<T>('get', '/api/playoff/'),
    
    // Conference standings
    getConferenceStandings: <T>(conferenceName: string) => 
        request<T>('get', `/api/standings/${conferenceName}/`),
    
    // Player related endpoints
    getPlayer: <T>(playerId: string, year?: string) => 
        request<T>('get', `/api/player/${playerId}/`, year ? { params: { year } } : undefined),
    
    // Schedule
    getWeekSchedule: <T>(week: number) => 
        request<T>('get', `/api/week/${week}/`),
    
    // Game related endpoints
    getGame: <T>(gameId: string) => 
        request<T>('get', `/api/game/${gameId}/`),
    
    // Stats
    getTeamStatsList: <T>(filters?: Record<string, any>) => 
        request<T>('get', '/api/stats/team/', { params: filters }),
    getIndividualStatsList: <T>(filters?: Record<string, any>) => 
        request<T>('get', '/api/stats/individual/', { params: filters }),
    getRatingsStats: <T>() => 
        request<T>('get', '/api/stats/ratings/'),
    
    // Season summary
    getSeasonSummary: <T>() => 
        request<T>('get', '/api/summary/'),
    
    // Roster progression
    getRosterProgression: <T>() => 
        request<T>('get', '/api/roster_progression/'),
    
    // Recruiting summary
    getRecruitingSummary: <T>() => 
        request<T>('get', '/api/recruiting_summary/'),
    
    // Live sim
    getLiveSimGames: <T>() => 
        request<T>('get', '/api/live-sim-games/'),
    liveSimGame: <T>(gameId: number) => 
        request<T>('post', `/api/game/${gameId}/live-sim/`),
    
    // Generic request function for custom endpoints
    get: <T>(endpoint: string, params?: Record<string, any>) => 
        request<T>('get', endpoint, { params }),
    post: <T>(endpoint: string, data: any, params?: Record<string, any>) => 
        request<T>('post', endpoint, { data, params }),
    put: <T>(endpoint: string, data: any, params?: Record<string, any>) => 
        request<T>('put', endpoint, { data, params }),
    delete: <T>(endpoint: string, params?: Record<string, any>) => 
        request<T>('delete', endpoint, { params }),
};

export default apiService;