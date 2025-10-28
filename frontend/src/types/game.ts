export interface Play {
    id?: number;
    down: number;
    yardsLeft: number;
    startingFP: number;
    playType: string;
    yardsGained: number;
    text: string;
    header?: string;
    result: string;
    scoreA: number;
    scoreB: number;
    offense: string;
    defense: string;
}

export interface Drive {
    driveNum: number;
    offense: string;
    defense: string;
    startingFP: number;
    result: string;
    points: number;
    plays: Play[];
}

export interface GameData {
    id: number;
    teamA: {
        name: string;
        record: string;
        colorPrimary: string;
        colorSecondary: string;
    };
    teamB: {
        name: string;
        record: string;
        colorPrimary: string;
        colorSecondary: string;
    };
    scoreA: number;
    scoreB: number;
    winner: {
        name: string;
    };
    headline: string;
    base_label: string;
    overtime: number;
    weekPlayed: number;
    year: number;
}
