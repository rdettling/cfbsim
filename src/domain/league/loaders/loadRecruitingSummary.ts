import { saveLeague } from '../../../db/leagueRepo';
import { getAllPlayers } from '../../../db/simRepo';
import type { RecruitingResults } from '../../../types/recruiting';
import { ensureRosters } from '../../roster';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildRecruitingResults } from '../recruitingResults';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

const EMPTY_RESULTS: RecruitingResults = {
  teamRankings: [],
  playerRankings: [],
  positions: [],
  userTeam: null,
  summary: {
    totalRecruits: 0,
    averageRating: 0,
    highestRating: 0,
  },
};

export const loadRecruitingSummary = async () => {
  const league = await loadLeagueOrThrow();

  if (await ensureRosters(league)) {
    await saveLeague(league);
  }

  const envelope = buildLeagueNavigationEnvelope(league);
  const { team } = envelope;

  if (league.info.stage !== 'recruiting_summary') {
    return {
      ...envelope,
      ...structuredClone(EMPTY_RESULTS),
    };
  }

  return {
    ...envelope,
    ...buildRecruitingResults(
      league.teams,
      await getAllPlayers(),
      team.id,
    ),
  };
};
