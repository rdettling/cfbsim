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
}

export interface Info {
    currentWeek: number;
    currentYear: number;
    stage: string;
    team: Team;
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