import axios, { AxiosResponse, AxiosError } from 'axios';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Determine if we're in production based on the URL
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

// Set the base URL for API requests
export const API_BASE_URL = isProduction
    ? '' // In production, use relative URLs (empty string for same domain)
    : 'http://127.0.0.1:8000'; // In development, use the local server

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
        let response: AxiosResponse<T>;
        const config = {
            params: options?.params
        };

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
        request<T>('get', '/api/home', year ? { params: { year } } : undefined),
    
    // Non-conference
    getNonCon: <T>() => 
        request<T>('get', '/api/noncon'),
    
    // Dashboard
    getDashboard: <T>() => 
        request<T>('get', '/api/dashboard'),
    
    // Rankings
    getRankings: <T>(week?: number) => 
        request<T>('get', '/api/rankings', week ? { params: { week } } : undefined),
    
    // Team related endpoints
    getTeamSchedule: <T>(teamName: string, year?: string) => 
        request<T>('get', `/api/${teamName}/schedule`, year ? { params: { year } } : undefined),
    getTeamRoster: <T>(teamName: string) => 
        request<T>('get', `/api/${teamName}/roster`),
    getTeamHistory: <T>(teamName: string) => 
        request<T>('get', `/api/${teamName}/history`),
    getTeamStats: <T>(teamName: string) => 
        request<T>('get', `/api/${teamName}/stats`),
    
    // Playoff
    getPlayoff: <T>() => 
        request<T>('get', '/api/playoff'),
    
    // Conference standings
    getConferenceStandings: <T>(conferenceName: string) => 
        request<T>('get', `/api/standings/${conferenceName}`),
    
    // Player related endpoints
    getPlayer: <T>(playerId: string, year?: string) => 
        request<T>('get', `/api/player/${playerId}`, year ? { params: { year } } : undefined),
    
    // Schedule
    getWeekSchedule: <T>(week: number) => 
        request<T>('get', `/api/week/${week}`),
    
    // Game related endpoints
    getGame: <T>(gameId: string) => 
        request<T>('get', `/api/game/${gameId}`),
    
    // Stats
    getTeamStatsList: <T>(filters?: Record<string, any>) => 
        request<T>('get', '/api/stats/team', { params: filters }),
    getIndividualStatsList: <T>(filters?: Record<string, any>) => 
        request<T>('get', '/api/stats/individual', { params: filters }),
    
    // Season summary
    getSeasonSummary: <T>() => 
        request<T>('get', '/api/summary'),
    
    // Roster progression
    getRosterProgression: <T>() => 
        request<T>('get', '/api/roster_progression'),
    
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

// Route mapping for usePageRefresh
const routeToApiMapping: Record<string, (params: any) => Promise<any>> = {
    // Static routes
    '/dashboard': () => apiService.getDashboard(),
    '/rankings': () => apiService.getRankings(),
    '/playoff': () => apiService.getPlayoff(),
    '/stats/team': () => apiService.getTeamStatsList(),
    '/stats/individual': () => apiService.getIndividualStatsList(),
    '/summary': () => apiService.getSeasonSummary(),
    '/roster_progression': () => apiService.getRosterProgression(),
    '/noncon': () => apiService.getNonCon(),
    
    // Dynamic routes - these will be matched by pattern in the usePageRefresh function
};

// Custom hook that uses the apiService for page refreshes
export function usePageRefresh<T>(setData: (data: T) => void) {
    const location = useLocation();

    const refreshCurrentPage = async () => {
        const path = location.pathname;
        const pathParts = path.split('/').filter(Boolean); // Remove empty strings
        const searchParams = new URLSearchParams(location.search);
        let data;

        try {
            // Check for exact static routes first
            if (routeToApiMapping[path]) {
                data = await routeToApiMapping[path]({});
            }
            // Handle dynamic routes
            else if (pathParts.length >= 1) {
                const firstPart = pathParts[0];
                const secondPart = pathParts.length > 1 ? pathParts[1] : '';
                
                // Conference standings: /standings/:conference
                if (path.startsWith('/standings/')) {
                    data = await apiService.getConferenceStandings(secondPart);
                }
                // Week schedule: /schedule/:week
                else if (firstPart === 'schedule') {
                    data = await apiService.getWeekSchedule(parseInt(secondPart));
                }
                // Game details: /game/:id
                else if (firstPart === 'game') {
                    data = await apiService.getGame(secondPart);
                }
                // Player details: /players/:id
                else if (firstPart === 'players') {
                    const year = searchParams.get('year');
                    data = await apiService.getPlayer(secondPart, year || undefined);
                }
                // Team pages with second path part
                else if (secondPart) {
                    const teamName = firstPart;
                    
                    // Team roster: /:team/roster
                    if (secondPart === 'roster') {
                        data = await apiService.getTeamRoster(teamName);
                    }
                    // Team schedule: /:team/schedule
                    else if (secondPart === 'schedule') {
                        const year = searchParams.get('year');
                        data = await apiService.getTeamSchedule(teamName, year || undefined);
                    }
                    // Team history: /:team/history
                    else if (secondPart === 'history') {
                        data = await apiService.getTeamHistory(teamName);
                    }
                    // Team stats: /:team/stats
                    else if (secondPart === 'stats') {
                        data = await apiService.getTeamStats(teamName);
                    }
                }
            }

            // Update data if response was received
            if (data) {
                setData(data as T);
            }
        } catch (error) {
            console.error('Error refreshing page data:', error);
        }
    };

    useEffect(() => {
        const handlePageRefresh = () => refreshCurrentPage();

        window.addEventListener('pageDataRefresh', handlePageRefresh);

        return () => {
            window.removeEventListener('pageDataRefresh', handlePageRefresh);
        };
    }, [location.pathname, location.search]); // Re-attach when route changes
}

export default apiService;