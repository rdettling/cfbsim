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

export interface PlayerInfo {
    id: number;
    first: string;
    last: string;
    pos: string;
    rating: number;
    starter: boolean;
}

export interface GameLog {
    game: {
        id: number;
        weekPlayed: number;
    };
    opponent: string;
    rank: number;
    label: string;
    result: string;
    [key: string]: any;
}

export interface YearStats {
    class: string;
    rating: number;
    games: number;
    [key: string]: any;
}

export interface PlayerStats {
    player: PlayerInfo;
    years: number[];
    stats: Record<number, YearStats>;
    game_logs: GameLog[];
    info: Info;
    team: Team;
    conferences: Conference[];
}

export interface GamePreviewData {
    info: Info;
    game: Game;
    conferences: Conference[];
    top_players: PlayerInfo[][];
}

// Custom hooks
export function usePageRefresh<T>(setData: (data: T) => void) {
    const location = useLocation();

    const refreshCurrentPage = async () => {
        const path = location.pathname;
        const pathParts = path.split('/').filter(Boolean); // Remove empty strings
        let response;

        try {
            if (path === '/dashboard') {
                response = await axios.get(`${API_BASE_URL}/api/dashboard`);
            } else if (path.includes('/standings/')) {
                const conference = pathParts[1];
                response = await axios.get(`${API_BASE_URL}/api/standings/${conference}`);
            } else if (pathParts[0] === 'schedule') {
                const week = pathParts[1];
                response = await axios.get(`${API_BASE_URL}/api/week_schedule/${week}`);
            } else if (path === '/rankings') {
                response = await axios.get(`${API_BASE_URL}/api/rankings`);
            } else if (path === '/playoff') {
                response = await axios.get(`${API_BASE_URL}/api/playoff`);
            } else if (path.includes('/game/')) {
                const gameId = pathParts[1];
                response = await axios.get(`${API_BASE_URL}/api/game/${gameId}`);
            } else if (pathParts[1] === 'roster') {
                const teamName = pathParts[0];
                response = await axios.get(`${API_BASE_URL}/api/${teamName}/roster`);
            } else if (pathParts[1] === 'schedule') {
                const teamName = pathParts[0];
                response = await axios.get(`${API_BASE_URL}/api/${teamName}/schedule`);
            } else if (pathParts[1] === 'history') {
                const teamName = pathParts[0];
                response = await axios.get(`${API_BASE_URL}/api/${teamName}/history`);
            }

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