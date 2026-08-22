import type { SeasonMemory, SeasonPlayoffArchive } from '../../types/memory';

export type ArchivedPostseasonGameType =
  | 'conference_championship'
  | 'bowl'
  | 'playoff_first_round'
  | 'playoff_quarterfinal'
  | 'playoff_semifinal'
  | 'national_championship';

export const getArchivedPlayoffGameIds = (
  playoff: SeasonPlayoffArchive,
): number[] => Object.values(playoff.games);

export const getArchivedPostseasonGameType = (
  memory: SeasonMemory | undefined,
  gameId: number,
): ArchivedPostseasonGameType | null => {
  if (!memory) return null;
  const { playoff, conferenceChampions, bowls } = memory.postseason;
  if (playoff.games.championship === gameId) return 'national_championship';
  if (
    playoff.format !== 2 &&
    (playoff.games.leftSemifinal === gameId ||
      playoff.games.rightSemifinal === gameId)
  ) {
    return 'playoff_semifinal';
  }
  if (
    playoff.format === 12 &&
    (playoff.games.leftQuarterfinal1 === gameId ||
      playoff.games.leftQuarterfinal2 === gameId ||
      playoff.games.rightQuarterfinal1 === gameId ||
      playoff.games.rightQuarterfinal2 === gameId)
  ) {
    return 'playoff_quarterfinal';
  }
  if (
    playoff.format === 12 &&
    (playoff.games.leftFirstRound1 === gameId ||
      playoff.games.leftFirstRound2 === gameId ||
      playoff.games.rightFirstRound1 === gameId ||
      playoff.games.rightFirstRound2 === gameId)
  ) {
    return 'playoff_first_round';
  }
  if (conferenceChampions.some(entry => entry.championshipGameId === gameId)) {
    return 'conference_championship';
  }
  if (bowls.some(entry => entry.gameId === gameId)) return 'bowl';
  return null;
};

export const getRetainedArchiveGameIds = (memory: SeasonMemory) =>
  new Set([
    ...getArchivedPlayoffGameIds(memory.postseason.playoff),
    ...memory.postseason.conferenceChampions.map(entry => entry.championshipGameId),
  ]);
