export type BowlTeamEntry = {
  name: string;
  conference: string;
  isConferenceChampion: boolean;
  ranking: number | null;
  record: string;
  spread: string | null;
  score: number | null;
  isWinner: boolean;
};

export type BowlGameEntry = {
  gameId: number | null;
  name: string;
  status: 'projected' | 'scheduled' | 'final';
  tier: 'playoff' | 'ny6' | 'other';
  teams: [BowlTeamEntry, BowlTeamEntry];
};

export type PlayoffMatchup = {
  id?: string;
  next_game?: string;
  game_id?: number;
  team1: string;
  team2: string;
  seed1: number | null;
  seed2: number | null;
  spread1: string | null;
  spread2: string | null;
  score1: number | null;
  score2: number | null;
  winner: string | null;
};

export type TwoTeamPlayoffBracket = {
  championship: PlayoffMatchup;
};

export type FourTeamPlayoffBracket = {
  semifinals: PlayoffMatchup[];
  championship: PlayoffMatchup;
};

type TwelveTeamBracketSide = {
  first_round: PlayoffMatchup[];
  quarterfinals: PlayoffMatchup[];
  semifinal: PlayoffMatchup;
};

export type TwelveTeamPlayoffBracket = {
  left_bracket: TwelveTeamBracketSide;
  right_bracket: TwelveTeamBracketSide;
  championship: PlayoffMatchup;
};

export type PlayoffBracket =
  | TwoTeamPlayoffBracket
  | FourTeamPlayoffBracket
  | TwelveTeamPlayoffBracket;
