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
    ceiling: number;
    floor: number;
    mascot: string;
    ranking: number;
    offense: number;
    defense: number;
    colorPrimary: string;
    colorSecondary: string;
    conference: string;
    confName?: string;
    confWins: number;
    confLosses: number;
    rating: number;
    totalWins: number;
    totalLosses: number;
    record: string;
    movement: number;
    last_game: ScheduleGame;
    next_game: ScheduleGame;
    // Game preview stats (optional - only present in game preview)
    stats?: {
        offensive_ypg: {
            value: number;
            rank: number;
        };
        defensive_ypg: {
            value: number;
            rank: number;
        };
        points_per_game: {
            value: number;
            rank: number;
        };
    };
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
    // Additional properties for game results
    name?: string;
    base_label?: string;
    scoreA?: number;
    scoreB?: number;
    resultA?: string;
    resultB?: string;
    overtime?: number;
    headline?: string;
}

export interface Player {
    id: number;
    first: string;
    last: string;
    pos: string;
    rating: number;
    rating_fr: number;
    rating_so: number;
    rating_jr: number;
    rating_sr: number;
    stars: number;
    development_trait: number;
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
    // Additional properties for game results
    drives?: Array<{
        offense: string;
        result: string;
        points: number;
        scoreAAfter: number;
        scoreBAfter: number;
    }>;
    stats?: Record<string, {
        teamA: number;
        teamB: number;
    }>;
    game_logs?: Record<string, Array<{
        player_id: number;
        team_name: string;
        game_log_string: string;
    }>>;
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

export interface RatingsStatsData {
    info: Info;
    team: Team;
    prestige_stars_table: PrestigeStarsRow[];
    total_star_counts: {
        counts: Record<number, number>;
        avg_ratings: Record<number, number>;
    };
    team_counts_by_prestige: TeamCountRow[];
    conferences: Conference[];
}

export interface PrestigeStarsRow {
    prestige: number;
    avg_rating: number;
    avg_stars: number;
    star_percentages: Record<number, number>;
}

export interface TeamCountRow {
    prestige: number;
    team_count: number;
}
