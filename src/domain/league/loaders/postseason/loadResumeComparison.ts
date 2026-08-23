import { getAllGames } from '../../../../db/simRepo';
import type { ResumeTeamEntry } from '../../../../types/postseason';
import { loadOddsContext } from '../../../odds';
import { loadLeagueOrThrow } from '../../leagueStore';
import { buildResumeComparisonTeams } from '../../utils/resumeComparison';
import { buildLeagueNavigationEnvelope } from '../navigationEnvelope';
import { loadPostseasonContext } from './context';

export const loadResumeComparison = async () => {
  const league = await loadLeagueOrThrow();
  const snapshot = league.resumeSnapshot;
  const toEntry = (team: NonNullable<typeof snapshot>['teams'][number]): ResumeTeamEntry => ({
    name: team.name,
    ranking: team.ranking,
    conference: team.conference,
    record: team.record,
    poll_score: team.pollScore,
    wins_over_expectation_rank: team.winsOverExpectationRank,
    sos_rank: team.sosRank,
    top_25_record: team.top25Record,
    best_win: team.bestWin
      ? { opponent: team.bestWin.opponent, opponent_ranking: team.bestWin.opponentRanking }
      : null,
    worst_loss: team.worstLoss
      ? { opponent: team.worstLoss.opponent, opponent_ranking: team.worstLoss.opponentRanking }
      : null,
    seed: team.seed,
    is_autobid: team.isAutobid,
    has_bye: team.hasBye,
    is_champ: team.isChampion,
  });

  if (snapshot) {
    return {
      ...buildLeagueNavigationEnvelope(league),
      playoff: {
        teams: snapshot.playoff.teams,
        autobids: snapshot.playoff.autobids,
        conf_champ_top_4: snapshot.playoff.conferenceChampionsReceiveTopSeeds,
      },
      is_projection: false,
      is_frozen: true,
      frozen_after_week: snapshot.frozenAfterWeek,
      resume_teams: snapshot.teams.map(toEntry),
    };
  }

  const context = await loadPostseasonContext(league);
  const resumeTeams = buildResumeComparisonTeams({
    league,
    games: await getAllGames(),
    selection: context.selection,
    championIds: new Set(context.champions.map(team => team.id)),
    oddsContext: await loadOddsContext(),
  });

  return {
    ...context.page,
    is_frozen: false,
    frozen_after_week: null,
    resume_teams: resumeTeams.map(toEntry),
  };
};
