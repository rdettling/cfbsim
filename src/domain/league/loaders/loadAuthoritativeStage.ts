import { loadLeagueOrThrow } from '../leagueStore';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

export const loadAuthoritativeStage = async () =>
  buildLeagueNavigationEnvelope(await loadLeagueOrThrow());
