import { saveLeague } from '../../../db/leagueRepo';
import { getAllPlayers } from '../../../db/simRepo';
import type {
  RosterCutPlayerPreview,
  RosterCutsSummary,
  RosterPositionCutPreview,
} from '../../../types/roster';
import { ensureRosters } from '../../roster';
import { buildRosterCutsPreview } from '../../rosterCuts';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

const EMPTY_SUMMARY: RosterCutsSummary = {
  activePlayers: 0,
  projectedCuts: 0,
  projectedRosterSize: 0,
  positionsOverLimit: 0,
};

export const loadRosterCuts = async () => {
  const league = await loadLeagueOrThrow();

  if (await ensureRosters(league)) {
    await saveLeague(league);
  }

  const envelope = buildLeagueNavigationEnvelope(league);
  const { team } = envelope;
  if (league.info.stage !== 'roster_cuts') {
    return {
      ...envelope,
      cuts: [] as RosterCutPlayerPreview[],
      positions: [] as RosterPositionCutPreview[],
      summary: { ...EMPTY_SUMMARY },
    };
  }

  const preview = buildRosterCutsPreview(
    await getAllPlayers(),
    team.id,
  );

  return {
    ...envelope,
    ...preview,
  };
};
