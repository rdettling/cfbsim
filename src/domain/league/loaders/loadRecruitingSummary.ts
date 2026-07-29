import { loadRecruitingLifecycleSnapshot } from '../../../db/recruitingRepo';
import type { RecruitingResults } from '../../../types/recruiting';
import { requireFinalizedRecruitingState } from '../recruiting';
import { buildRecruitingResults } from '../recruitingResults';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

const EMPTY_RESULTS: RecruitingResults = {
  teamRankings: [],
  playerRankings: [],
  positions: [],
  userTeam: null,
  summary: {
    totalRecruits: 0,
  },
};

export const loadRecruitingSummary = async () => {
  const { league, recruiting } =
    await loadRecruitingLifecycleSnapshot();

  const envelope = buildLeagueNavigationEnvelope(league);
  const { team } = envelope;

  if (league.info.stage !== 'recruiting_summary') {
    return {
      ...envelope,
      ...structuredClone(EMPTY_RESULTS),
    };
  }

  const finalizedRecruiting = requireFinalizedRecruitingState(
    recruiting,
    league.info.currentYear,
  );
  return {
    ...envelope,
    ...buildRecruitingResults(
      league.teams,
      finalizedRecruiting.prospects,
      team.id,
    ),
  };
};
