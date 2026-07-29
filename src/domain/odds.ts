import { getBettingOddsData } from '../db/baseData';
import type { Team } from '../types/domain';

export const HOME_FIELD_ADVANTAGE = 4;

export type OddsContext = {
  oddsMap: Record<
    string,
    {
      favSpread: string;
      udSpread: string;
      favWinProb: number;
      udWinProb: number;
      favMoneyline: string;
      udMoneyline: string;
    }
  >;
  maxDiff: number;
};

export const buildOddsContext = (value: unknown): OddsContext => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('odds' in value) ||
    typeof value.odds !== 'object' ||
    value.odds === null
  ) {
    throw new Error('The saved betting-odds data is malformed.');
  }
  const source = value as {
    odds: OddsContext['oddsMap'];
    max_diff?: number;
  };
  if (
    source.max_diff !== undefined &&
    (!Number.isFinite(source.max_diff) || source.max_diff < 0)
  ) {
    throw new Error('The saved betting-odds maximum difference is malformed.');
  }
  return {
    oddsMap: source.odds,
    maxDiff: source.max_diff ?? 100,
  };
};

export const loadOddsContext = async (): Promise<OddsContext> => {
  const oddsData = await getBettingOddsData();
  return buildOddsContext(oddsData);
};

export const buildOddsFields = (
  teamA: Team,
  teamB: Team,
  homeTeam: Team | null,
  neutralSite: boolean,
  context: OddsContext
) => {
  let ratingA = teamA.rating;
  let ratingB = teamB.rating;

  if (!neutralSite && homeTeam) {
    if (homeTeam.id === teamA.id) ratingA += HOME_FIELD_ADVANTAGE;
    if (homeTeam.id === teamB.id) ratingB += HOME_FIELD_ADVANTAGE;
  }

  const diff = Math.min(
    context.maxDiff,
    Math.abs(Math.round(ratingA - ratingB))
  );
  const odds =
    context.oddsMap[String(diff)] ??
    context.oddsMap[String(context.maxDiff)] ?? {
      favSpread: '-1.5',
      udSpread: '+1.5',
      favWinProb: 0.6,
      udWinProb: 0.4,
      favMoneyline: '-120',
      udMoneyline: '+120',
    };

  const isTeamAFav = ratingA >= ratingB;

  return {
    spreadA: isTeamAFav ? odds.favSpread : odds.udSpread,
    spreadB: isTeamAFav ? odds.udSpread : odds.favSpread,
    moneylineA: isTeamAFav ? odds.favMoneyline : odds.udMoneyline,
    moneylineB: isTeamAFav ? odds.udMoneyline : odds.favMoneyline,
    winProbA: isTeamAFav ? odds.favWinProb : odds.udWinProb,
    winProbB: isTeamAFav ? odds.udWinProb : odds.favWinProb,
  };
};

export const getWinProbForRatings = (
  ratingA: number,
  ratingB: number,
  context: OddsContext
) => {
  const diff = Math.min(
    context.maxDiff,
    Math.abs(Math.round(ratingA - ratingB))
  );
  const odds =
    context.oddsMap[String(diff)] ??
    context.oddsMap[String(context.maxDiff)] ?? {
      favSpread: '-1.5',
      udSpread: '+1.5',
      favWinProb: 0.6,
      udWinProb: 0.4,
      favMoneyline: '-120',
      udMoneyline: '+120',
    };
  const isFav = ratingA >= ratingB;
  return isFav ? odds.favWinProb : odds.udWinProb;
};
