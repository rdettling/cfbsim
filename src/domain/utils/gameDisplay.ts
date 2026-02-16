import type { Team, ScheduleGame } from '../../types/domain';

type GameSideFields = {
  scoreA?: number | null;
  scoreB?: number | null;
  spreadA?: string | null;
  spreadB?: string | null;
  moneylineA?: string | null;
  moneylineB?: string | null;
  rankATOG?: number | null;
  rankBTOG?: number | null;
  resultA?: string | null;
  resultB?: string | null;
  teamA: Team;
  teamB: Team;
};

type GameHomeAway<T extends { id: number }> = {
  teamA: T;
  teamB: T;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  neutralSite?: boolean | null;
};

export const resolveHomeAway = <T extends { id: number }>(game: GameHomeAway<T>) => {
  const neutral = Boolean(game.neutralSite) || !game.homeTeamId;
  if (game.homeTeamId) {
    const home = game.teamA.id === game.homeTeamId ? game.teamA : game.teamB;
    const away = home.id === game.teamA.id ? game.teamB : game.teamA;
    return { home, away, neutral };
  }
  if (game.awayTeamId) {
    const away = game.teamA.id === game.awayTeamId ? game.teamA : game.teamB;
    const home = away.id === game.teamA.id ? game.teamB : game.teamA;
    return { home, away, neutral };
  }
  return { home: game.teamA, away: game.teamB, neutral };
};

export const resolveTeamSide = (game: GameSideFields, teamId: number) => {
  const isTeamA = game.teamA.id === teamId;
  return {
    rank: isTeamA ? game.rankATOG ?? 0 : game.rankBTOG ?? 0,
    score: isTeamA ? game.scoreA ?? 0 : game.scoreB ?? 0,
    spread: isTeamA ? game.spreadA ?? '' : game.spreadB ?? '',
    moneyline: isTeamA ? game.moneylineA ?? '' : game.moneylineB ?? '',
    result: isTeamA ? game.resultA ?? '' : game.resultB ?? '',
  };
};

export const resolveHomeAwayScores = <T extends { id: number }>(
  game: GameHomeAway<T>,
  scoreA: number | null | undefined,
  scoreB: number | null | undefined
) => {
  const { home, away } = resolveHomeAway(game);
  const awayScore = away.id === game.teamA.id ? (scoreA ?? 0) : (scoreB ?? 0);
  const homeScore = home.id === game.teamA.id ? (scoreA ?? 0) : (scoreB ?? 0);
  return { awayScore, homeScore };
};

export const formatMatchup = (homeName: string, awayName: string, neutral: boolean) =>
  neutral ? `${awayName} vs ${homeName}` : `${awayName} at ${homeName}`;

export const formatOpponentPrefix = (location?: ScheduleGame['location']) => {
  if (location === 'Away') return '@';
  if (location === 'Neutral') return 'vs (N)';
  if (location === 'Home') return 'vs';
  return '';
};
