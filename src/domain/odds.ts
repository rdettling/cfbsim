import { getBettingOddsData } from '../db/baseData';
import { validateBettingOddsData } from './baseDataValidation';
import type { BettingOddsEntry } from '../types/baseData';
import type { Team } from '../types/domain';

export const HOME_FIELD_ADVANTAGE = 4;

export type OddsContext = {
  oddsMap: Record<string, BettingOddsEntry>;
  maxDiff: number;
};

export const buildOddsContext = (value: unknown): OddsContext => {
  const source = validateBettingOddsData(value, 'saved betting-odds data');
  return {
    oddsMap: source.odds,
    maxDiff: source.max_diff,
  };
};

export const loadOddsContext = async (): Promise<OddsContext> => {
  const oddsData = await getBettingOddsData();
  return buildOddsContext(oddsData);
};

export const favoriteSpread = (spread: string) => spread.startsWith('-') ? spread : null;

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
