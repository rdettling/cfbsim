import type {
  HistoricalGame,
  HistoricalGamesForTeam,
  HistoricalGamesIndex,
  HistoricalGamesSeason,
  HistoricalTeamGame,
} from '../types/baseData';

export const GAME_HISTORY_SOURCE = 'CollegeFootballData.com' as const;
export const FIRST_GAME_HISTORY_YEAR = 2000;

const INDEX_KEYS = ['generated_at', 'source', 'years'] as const;
const SEASON_KEYS = ['year', 'games'] as const;
const GAME_KEYS = [
  'sourceId',
  'year',
  'weekPlayed',
  'seasonType',
  'homeTeam',
  'awayTeam',
  'homeScore',
  'awayScore',
  'homeRank',
  'awayRank',
  'neutralSite',
  'venue',
  'name',
  'label',
] as const;
const TEAM_GAMES_KEYS = ['team', 'games'] as const;
const TEAM_GAME_KEYS = [
  'sourceId',
  'year',
  'weekPlayed',
  'opponent',
  'teamScore',
  'opponentScore',
  'label',
] as const;

const TEAM_ALIASES: Readonly<Record<string, string>> = {
  'App State': 'Appalachian State',
  FIU: 'Florida International',
  "Hawai'i": 'Hawaii',
  SMU: 'Southern Methodist',
  'Sam Houston': 'Sam Houston State',
  TCU: 'Texas Christian',
  UAB: 'Alabama Birmingham',
  UCF: 'Central Florida',
  UConn: 'Connecticut',
  UMass: 'Massachusetts',
  'UL Monroe': 'Louisiana Monroe',
  UTEP: 'Texas El Paso',
  UTSA: 'Texas San Antonio',
  'Louisiana-Monroe': 'Louisiana Monroe',
  'Middle Tennessee': 'Middle Tennessee State',
  'Miami (OH)': 'Miami Ohio',
  'San José State': 'San Jose State',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};

export class HistoricalGamesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoricalGamesValidationError';
  }
}

export const canonicalHistoricalTeamName = (name: string) =>
  TEAM_ALIASES[name] ?? name;

const isHistoricalGame = (value: unknown): value is HistoricalGame =>
  isRecord(value) &&
  hasExactKeys(value, GAME_KEYS) &&
  Number.isInteger(value.sourceId) &&
  Number(value.sourceId) > 0 &&
  Number.isInteger(value.year) &&
  Number(value.year) >= FIRST_GAME_HISTORY_YEAR &&
  Number.isInteger(value.weekPlayed) &&
  Number(value.weekPlayed) >= 1 &&
  Number(value.weekPlayed) <= 19 &&
  (value.seasonType === 'regular' || value.seasonType === 'postseason') &&
  typeof value.homeTeam === 'string' &&
  value.homeTeam.length > 0 &&
  typeof value.awayTeam === 'string' &&
  value.awayTeam.length > 0 &&
  value.homeTeam !== value.awayTeam &&
  Number.isInteger(value.homeScore) &&
  Number(value.homeScore) >= 0 &&
  Number.isInteger(value.awayScore) &&
  Number(value.awayScore) >= 0 &&
  Number.isInteger(value.homeRank) &&
  Number(value.homeRank) >= 0 &&
  Number(value.homeRank) <= 25 &&
  Number.isInteger(value.awayRank) &&
  Number(value.awayRank) >= 0 &&
  Number(value.awayRank) <= 25 &&
  typeof value.neutralSite === 'boolean' &&
  (value.venue === null ||
    (typeof value.venue === 'string' && value.venue.length > 0)) &&
  (value.name === null ||
    (typeof value.name === 'string' && value.name.length > 0)) &&
  typeof value.label === 'string' &&
  value.label.length > 0;

const compareGames = (left: HistoricalGame, right: HistoricalGame) =>
  left.weekPlayed - right.weekPlayed ||
  (left.seasonType === right.seasonType
    ? 0
    : left.seasonType === 'regular' ? -1 : 1) ||
  left.sourceId - right.sourceId;

export const compareHistoricalTeamGames = (
  left: HistoricalTeamGame,
  right: HistoricalTeamGame,
) =>
  right.year - left.year ||
  right.weekPlayed - left.weekPlayed ||
  right.sourceId - left.sourceId;

export const getHistoricalTeamGamesFileName = (teamName: string) => {
  if (
    !teamName ||
    teamName.trim() !== teamName ||
    teamName.includes('/') ||
    teamName.includes('\\')
  ) {
    throw new HistoricalGamesValidationError(
      `Historical game team name ${JSON.stringify(teamName)} is invalid.`,
    );
  }
  return `${teamName}.json`;
};

const toHistoricalTeamGame = (
  game: HistoricalGame,
  teamName: string,
): HistoricalTeamGame => {
  const isHome = game.homeTeam === teamName;
  return {
    sourceId: game.sourceId,
    year: game.year,
    weekPlayed: game.weekPlayed,
    opponent: isHome ? game.awayTeam : game.homeTeam,
    teamScore: isHome ? game.homeScore : game.awayScore,
    opponentScore: isHome ? game.awayScore : game.homeScore,
    label: game.label,
  };
};

export const buildHistoricalGamesByTeam = (
  seasons: HistoricalGamesSeason[],
  supportedTeams: ReadonlySet<string>,
): HistoricalGamesForTeam[] => {
  const gamesByTeam = new Map(
    [...supportedTeams]
      .sort((left, right) => left.localeCompare(right))
      .map(team => [team, [] as HistoricalTeamGame[]]),
  );
  for (const season of seasons) {
    for (const game of season.games) {
      const homeGames = gamesByTeam.get(game.homeTeam);
      if (homeGames) homeGames.push(toHistoricalTeamGame(game, game.homeTeam));
      const awayGames = gamesByTeam.get(game.awayTeam);
      if (awayGames) awayGames.push(toHistoricalTeamGame(game, game.awayTeam));
    }
  }
  return [...gamesByTeam].map(([team, games]) => ({
    team,
    games: games.sort(compareHistoricalTeamGames),
  }));
};

const hasValidIndexYears = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    year => Number.isInteger(year) && Number(year) >= FIRST_GAME_HISTORY_YEAR,
  ) &&
  value.every(
    (year, index) =>
      index === 0 || Number(year) > Number(value[index - 1]),
  );

export const validateHistoricalGamesIndex = (
  value: unknown,
): HistoricalGamesIndex => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, INDEX_KEYS) ||
    typeof value.generated_at !== 'string' ||
    Number.isNaN(Date.parse(value.generated_at)) ||
    value.source !== GAME_HISTORY_SOURCE ||
    !hasValidIndexYears(value.years)
  ) {
    throw new HistoricalGamesValidationError(
      'Historical games index does not match the current schema.',
    );
  }
  return value as unknown as HistoricalGamesIndex;
};

export const validateHistoricalGamesSeason = (
  value: unknown,
  expectedYear?: number,
): HistoricalGamesSeason => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, SEASON_KEYS) ||
    !Number.isInteger(value.year) ||
    Number(value.year) < FIRST_GAME_HISTORY_YEAR ||
    !Array.isArray(value.games) ||
    value.games.length === 0
  ) {
    throw new HistoricalGamesValidationError(
      'Historical games season does not match the current schema.',
    );
  }
  const year = Number(value.year);
  if (expectedYear !== undefined && year !== expectedYear) {
    throw new HistoricalGamesValidationError(
      `Historical games season ${year} does not match requested year ${expectedYear}.`,
    );
  }
  if (value.games.some(game => !isHistoricalGame(game))) {
    throw new HistoricalGamesValidationError(
      `Historical games season ${year} contains an invalid game.`,
    );
  }

  const games = value.games as HistoricalGame[];
  const sourceIds = new Set<number>();
  const fingerprints = new Set<string>();
  for (let index = 0; index < games.length; index += 1) {
    const game = games[index];
    if (game.year !== year) {
      throw new HistoricalGamesValidationError(
        `Historical game ${game.sourceId} does not belong to season ${year}.`,
      );
    }
    if (sourceIds.has(game.sourceId)) {
      throw new HistoricalGamesValidationError(
        `Historical game source ID ${game.sourceId} is duplicated.`,
      );
    }
    sourceIds.add(game.sourceId);
    const fingerprint = [
      game.homeTeam,
      game.awayTeam,
      game.homeScore,
      game.awayScore,
    ].join('|');
    if (fingerprints.has(fingerprint)) {
      throw new HistoricalGamesValidationError(
        `Historical game ${game.sourceId} duplicates a matchup result.`,
      );
    }
    fingerprints.add(fingerprint);
    if (index > 0 && compareGames(games[index - 1], game) > 0) {
      throw new HistoricalGamesValidationError(
        `Historical games season ${year} is not in chronological order.`,
      );
    }
  }

  return value as unknown as HistoricalGamesSeason;
};

const isHistoricalTeamGame = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, TEAM_GAME_KEYS) &&
  Number.isInteger(value.sourceId) &&
  Number(value.sourceId) > 0 &&
  Number.isInteger(value.year) &&
  Number(value.year) >= FIRST_GAME_HISTORY_YEAR &&
  Number.isInteger(value.weekPlayed) &&
  Number(value.weekPlayed) >= 1 &&
  Number(value.weekPlayed) <= 19 &&
  typeof value.opponent === 'string' &&
  value.opponent.length > 0 &&
  Number.isInteger(value.teamScore) &&
  Number(value.teamScore) >= 0 &&
  Number.isInteger(value.opponentScore) &&
  Number(value.opponentScore) >= 0 &&
  typeof value.label === 'string' &&
  value.label.length > 0;

export const validateHistoricalGamesForTeam = (
  value: unknown,
  expectedTeam?: string,
  availableYears?: ReadonlySet<number>,
): HistoricalGamesForTeam => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, TEAM_GAMES_KEYS) ||
    typeof value.team !== 'string' ||
    value.team.length === 0 ||
    !Array.isArray(value.games) ||
    value.games.some(game => !isHistoricalTeamGame(game))
  ) {
    throw new HistoricalGamesValidationError(
      'Historical team games do not match the current schema.',
    );
  }
  if (expectedTeam !== undefined && value.team !== expectedTeam) {
    throw new HistoricalGamesValidationError(
      `Historical team games for ${value.team} do not match requested team ${expectedTeam}.`,
    );
  }

  const games = value.games as HistoricalTeamGame[];
  const sourceIds = new Set<number>();
  for (let index = 0; index < games.length; index += 1) {
    const game = games[index];
    if (game.opponent === value.team) {
      throw new HistoricalGamesValidationError(
        `Historical team game ${game.sourceId} repeats ${value.team} as its opponent.`,
      );
    }
    if (availableYears && !availableYears.has(game.year)) {
      throw new HistoricalGamesValidationError(
        `Historical team game ${game.sourceId} belongs to unavailable season ${game.year}.`,
      );
    }
    if (sourceIds.has(game.sourceId)) {
      throw new HistoricalGamesValidationError(
        `Historical team game source ID ${game.sourceId} is duplicated.`,
      );
    }
    sourceIds.add(game.sourceId);
    if (index > 0 && compareHistoricalTeamGames(games[index - 1], game) > 0) {
      throw new HistoricalGamesValidationError(
        `Historical team games for ${value.team} are not in reverse chronological order.`,
      );
    }
  }
  return value as unknown as HistoricalGamesForTeam;
};
