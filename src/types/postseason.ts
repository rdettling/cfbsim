export type PlayoffTeamEntry = {
  name: string;
  seed: number;
  ranking: number;
  conference: string;
  record: string;
  is_autobid: boolean;
};

export type BubbleTeamEntry = {
  name: string;
  ranking: number;
  conference: string;
  record: string;
};

export type ResumeResultEntry = {
  opponent: string;
  opponent_ranking: number;
};

export type ResumeTeamEntry = {
  name: string;
  ranking: number;
  conference: string;
  record: string;
  poll_score: number;
  sor_rank: number;
  sos_rank: number | null;
  top_25_record: string;
  best_win: ResumeResultEntry | null;
  worst_loss: ResumeResultEntry | null;
  seed: number | null;
  is_autobid: boolean;
  has_bye: boolean;
  is_champ: boolean;
};

export type ConferenceChampionEntry = {
  name: string;
  ranking: number;
  conference: string;
  record: string;
  seed: number | null;
};

export type BowlGameEntry = {
  id: number;
  name: string;
  week: number;
  teamA: string;
  teamB: string;
  teamA_conf: string;
  teamB_conf: string;
  teamA_is_champ: boolean;
  teamB_is_champ: boolean;
  rankA: number;
  rankB: number;
  recordA: string;
  recordB: string;
  scoreA: number | null;
  scoreB: number | null;
  winner: string | null;
  is_ny6: boolean;
  is_projection: boolean;
};

export type PlayoffMatchup = {
  id?: string;
  next_game?: string;
  game_id?: number;
  team1: string;
  team2: string;
  seed1: number | null;
  seed2: number | null;
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
