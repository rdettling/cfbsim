export interface RecruitingPlayerResult {
  rank: number;
  id: number;
  first: string;
  last: string;
  position: string;
  rating: number;
  stars: number;
  teamId: number;
  teamName: string;
}

export interface RecruitingStarCounts {
  five: number;
  four: number;
  three: number;
  two: number;
  one: number;
}

export interface RecruitingTeamResult {
  rank: number;
  teamId: number;
  teamName: string;
  conference: string;
  prestige: number;
  recruits: RecruitingPlayerResult[];
  totalRecruits: number;
  averageRating: number;
  averageStars: number;
  starCounts: RecruitingStarCounts;
  classScore: number;
}

export interface RecruitingResultsSummary {
  totalRecruits: number;
  averageRating: number;
  highestRating: number;
}

export interface RecruitingResults {
  teamRankings: RecruitingTeamResult[];
  playerRankings: RecruitingPlayerResult[];
  positions: string[];
  userTeam: RecruitingTeamResult | null;
  summary: RecruitingResultsSummary;
}
