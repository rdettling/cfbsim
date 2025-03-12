import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface Conference {
    id: number;
    confName: string;
    confFullName: string;
    confGames: number;
    info: string;
    championship: null | any;
    teams: Team[];
}

export interface Team {
    id: number;
    name: string;
    abbreviation: string;
    nonConfGames: number;
    nonConfLimit: number;
    prestige: number;
    mascot: string;
    ranking: number;
    offense: number;
    defense: number;
    colorPrimary: string;
    colorSecondary: string;
    conference: string;
    confWins: number;
    confLosses: number;
    rating: number;
    totalWins: number;
    totalLosses: number;
    record: string;
    movement: number;
    last_game: ScheduleGame;
    next_game: ScheduleGame;
}

export interface Info {
    currentWeek: number;
    currentYear: number;
    stage: string;
    team: Team;
    lastWeek: number;
}

export interface ScheduleGame {
    weekPlayed: number;
    opponent: {
        name: string;
        rating: number;
        ranking: number;
        record: string;
    };
    label?: string;
    result: string;
    score: string;
    spread: string;
    moneyline: string;
    id: string;
}

export interface Game {
    id: number;
    label: string;
    weekPlayed: number;
    year: number;
    teamA: Team;
    teamB: Team;
    rankATOG: number;
    rankBTOG: number;
    spreadA: number;
    spreadB: number;
    moneylineA: number;
    moneylineB: number;
    winProbA: number;
    winProbB: number;
    winner: Team;
}

export interface Player {
    id: number;
    first: string;
    last: string;
    pos: string;
    rating: number;
    starter: boolean;
    year: string;
    team: string;
}

export interface GameLog {
    game: {
        id: number;
        weekPlayed: number;
        opponent: {
            name: string;
            rating: number;
            ranking: number;
            record: string;
        };
        label: string;
        result: string;
        score: string;
    };
    [key: string]: any;
}

export interface GamePreviewData {
    info: Info;
    game: Game;
    conferences: Conference[];
    top_players: Player[][];
}

export interface TeamStats {
    games: number;
    ppg: number;
    pass_cpg: number;
    pass_apg: number;
    comp_percent: number;
    pass_ypg: number;
    pass_tdpg: number;
    rush_apg: number;
    rush_ypg: number;
    rush_ypc: number;
    rush_tdpg: number;
    playspg: number;
    yardspg: number;
    ypp: number;
    first_downs_pass: number;
    first_downs_rush: number;
    first_downs_total: number;
    fumbles: number;
    interceptions: number;
    turnovers: number;
}


// Custom hooks
export function usePageRefresh<T>(setData: (data: T) => void) {
    const location = useLocation();

    const refreshCurrentPage = async () => {
        const path = location.pathname;
        const pathParts = path.split('/').filter(Boolean); // Remove empty strings
        const searchParams = new URLSearchParams(location.search);
        let response;

        try {
            // Define API endpoints based on route patterns
            const apiEndpoints: Record<string, string> = {
                // Static routes
                '/dashboard': `${API_BASE_URL}/api/dashboard`,
                '/rankings': `${API_BASE_URL}/api/rankings`,
                '/playoff': `${API_BASE_URL}/api/playoff`,
                '/stats/team': `${API_BASE_URL}/api/team_stats`,
                '/stats/individual': `${API_BASE_URL}/api/individual_stats`,
            };

            // Check for static routes first
            if (path in apiEndpoints) {
                response = await axios.get(apiEndpoints[path]);
            }
            // Handle dynamic routes
            else if (pathParts.length >= 1) {
                const firstPart = pathParts[0];
                const secondPart = pathParts.length > 1 ? pathParts[1] : '';
                
                // Conference standings: /standings/:conference
                if (path.includes('/standings/')) {
                    const conference = secondPart;
                    response = await axios.get(`${API_BASE_URL}/api/standings/${conference}`);
                }
                // Week schedule: /schedule/:week
                else if (firstPart === 'schedule') {
                    const week = secondPart;
                    response = await axios.get(`${API_BASE_URL}/api/week/${week}`);
                }
                // Game details: /game/:id
                else if (firstPart === 'game') {
                    const gameId = secondPart;
                    response = await axios.get(`${API_BASE_URL}/api/game/${gameId}`);
                }
                // Player details: /players/:id
                else if (firstPart === 'players') {
                    const playerId = secondPart;
                    const year = searchParams.get('year');
                    response = await axios.get(
                        `${API_BASE_URL}/api/player/${playerId}${year ? `?year=${year}` : ''}`
                    );
                }
                // Team pages with second path part
                else if (secondPart) {
                    const teamName = firstPart;
                    const section = secondPart;
                    
                    // Team roster: /:team/roster
                    if (section === 'roster') {
                        response = await axios.get(`${API_BASE_URL}/api/${teamName}/roster`);
                    }
                    // Team schedule: /:team/schedule
                    else if (section === 'schedule') {
                        const year = searchParams.get('year');
                        response = await axios.get(
                            `${API_BASE_URL}/api/${teamName}/schedule${year ? `?year=${year}` : ''}`
                        );
                    }
                    // Team history: /:team/history
                    else if (section === 'history') {
                        response = await axios.get(`${API_BASE_URL}/api/${teamName}/history`);
                    }
                }
            }

            // Update data if response was received
            if (response) {
                setData(response.data);
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
    }, []);
}