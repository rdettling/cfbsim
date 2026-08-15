import type { PlayoffTeamCount, Team } from '../../../types/domain';

const NY6_BOWLS = [
  'Rose Bowl',
  'Sugar Bowl',
  'Orange Bowl',
  'Cotton Bowl',
  'Fiesta Bowl',
  'Peach Bowl',
] as const;

const AT_LARGE_BOWLS = [
  'Alamo Bowl',
  'Citrus Bowl',
  'Holiday Bowl',
  'Gator Bowl',
  'Sun Bowl',
  'Liberty Bowl',
  'Las Vegas Bowl',
  'Music City Bowl',
  'Texas Bowl',
  'Pinstripe Bowl',
  'Camping World Bowl',
  'Cheez-It Bowl',
  'Outback Bowl',
  "Duke's Mayo Bowl",
  'ReliaQuest Bowl',
] as const;

const ALL_BOWLS = new Set<string>(
  [...NY6_BOWLS, ...AT_LARGE_BOWLS].map(name => name.toLowerCase()),
);

const NY6_NAMES = new Set<string>(NY6_BOWLS.map(name => name.toLowerCase()));

const ROTATION_SEMIS: Array<[typeof NY6_BOWLS[number], typeof NY6_BOWLS[number]]> = [
  ['Rose Bowl', 'Sugar Bowl'],
  ['Orange Bowl', 'Cotton Bowl'],
  ['Fiesta Bowl', 'Peach Bowl'],
];

const getAvailableNy6Bowls = (year: number, playoffTeams: PlayoffTeamCount) => {
  if (playoffTeams === 2) return [...NY6_BOWLS];
  const semis = ROTATION_SEMIS[Math.abs(year) % ROTATION_SEMIS.length];
  if (playoffTeams === 4) {
    return NY6_BOWLS.filter(bowl => !semis.includes(bowl));
  }
  return [];
};

const pickBestTeam = (
  teams: Team[],
  usedIds: Set<number>,
  predicate: (team: Team) => boolean,
) => {
  const team = teams.find(entry => !usedIds.has(entry.id) && predicate(entry));
  if (!team) return null;
  usedIds.add(team.id);
  return team;
};

export const isBowlName = (name?: string | null) =>
  Boolean(name && ALL_BOWLS.has(name.toLowerCase()));

export const isNy6Bowl = (name?: string | null) =>
  Boolean(name && NY6_NAMES.has(name.toLowerCase()));

export const buildBowlMatchups = ({
  teams,
  playoffTeamIds,
  year,
  playoffTeams,
  requireEligibility,
}: {
  teams: Team[];
  playoffTeamIds: Set<number>;
  year: number;
  playoffTeams: PlayoffTeamCount;
  requireEligibility: boolean;
}) => {
  const eligible = teams
    .filter(team => !playoffTeamIds.has(team.id))
    .filter(team => !requireEligibility || team.totalWins >= 6)
    .slice()
    .sort((left, right) => left.ranking - right.ranking);
  const usedIds = new Set<number>();
  const takeBest = () => pickBestTeam(eligible, usedIds, () => true);
  const takeConference = (conference: string) =>
    pickBestTeam(eligible, usedIds, team => team.conference === conference);
  const matchups: Array<{ name: string; teamA: Team; teamB: Team }> = [];
  const availableNy6 = getAvailableNy6Bowls(year, playoffTeams);

  if (availableNy6.includes('Rose Bowl')) {
    const teamA = takeConference('Big Ten') ?? takeBest();
    const teamB = takeConference('Pac-12') ?? takeBest();
    if (teamA && teamB) matchups.push({ name: 'Rose Bowl', teamA, teamB });
  }

  if (availableNy6.includes('Sugar Bowl')) {
    const teamA = takeConference('SEC') ?? takeBest();
    const teamB = takeConference('Big 12') ?? takeBest();
    if (teamA && teamB) matchups.push({ name: 'Sugar Bowl', teamA, teamB });
  }

  if (availableNy6.includes('Orange Bowl')) {
    const teamA = takeConference('ACC') ?? takeBest();
    const teamB = takeBest();
    if (teamA && teamB) matchups.push({ name: 'Orange Bowl', teamA, teamB });
  }

  for (const bowl of ['Cotton Bowl', 'Fiesta Bowl', 'Peach Bowl'] as const) {
    if (!availableNy6.includes(bowl)) continue;
    const teamA = takeBest();
    const teamB = takeBest();
    if (teamA && teamB) matchups.push({ name: bowl, teamA, teamB });
  }

  for (const bowl of AT_LARGE_BOWLS) {
    const teamA = takeBest();
    const teamB = takeBest();
    if (!teamA || !teamB) break;
    matchups.push({ name: bowl, teamA, teamB });
  }

  return matchups;
};
