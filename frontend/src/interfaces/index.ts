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
