export interface GameRecord {
  id: number;
  teamAId: number;
  teamBId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  neutralSite: boolean;
  winnerId: number | null;
  baseLabel: string;
  name: string | null;
  spreadA: string;
  spreadB: string;
  moneylineA: string;
  moneylineB: string;
  winProbA: number;
  winProbB: number;
  weekPlayed: number;
  year: number;
  rankATOG: number;
  rankBTOG: number;
  resultA: string | null;
  resultB: string | null;
  overtime: number;
  quarter?: number;
  clockSecondsLeft?: number;
  scoreA: number | null;
  scoreB: number | null;
  headline: string | null;
  headline_subtitle?: string | null;
  headline_tags?: string[] | null;
  headline_tone?: string | null;
  watchability: number | null;
}

export interface DriveRecord {
  id: number;
  gameId: number;
  driveNum: number;
  offenseId: number;
  defenseId: number;
  startingFP: number;
  result: string;
  points: number;
  points_needed: number;
  scoreAAfter: number;
  scoreBAfter: number;
}

export interface PlayRecord {
  id: number;
  gameId: number;
  driveId: number;
  offenseId: number;
  defenseId: number;
  startingFP: number;
  down: number;
  yardsLeft: number;
  playType: string;
  yardsGained: number;
  result: string;
  text: string;
  header: string;
  scoreA: number;
  scoreB: number;
  quarter?: number;
  clockSecondsLeft?: number;
  playSeconds?: number;
}

export interface GameLogRecord {
  id: number;
  playerId: number;
  gameId: number;
  pass_yards: number;
  pass_attempts: number;
  pass_completions: number;
  pass_touchdowns: number;
  pass_interceptions: number;
  rush_yards: number;
  rush_attempts: number;
  rush_touchdowns: number;
  receiving_yards: number;
  receiving_catches: number;
  receiving_touchdowns: number;
  fumbles: number;
  tackles: number;
  sacks: number;
  interceptions: number;
  fumbles_forced: number;
  fumbles_recovered: number;
  field_goals_made: number;
  field_goals_attempted: number;
  extra_points_made: number;
  extra_points_attempted: number;
}

export interface PlayerRecord {
  id: number;
  teamId: number;
  first: string;
  last: string;
  year: 'fr' | 'so' | 'jr' | 'sr';
  pos: string;
  rating: number;
  rating_fr: number;
  rating_so: number;
  rating_jr: number;
  rating_sr: number;
  stars: number;
  development_trait: number;
  starter: boolean;
  active: boolean;
}
