import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSchedule, fillUserSchedule } from '../src/domain/schedule';
import type { FullGame } from '../src/types/schedule';
import type { Team } from '../src/types/domain';

const loadJson = <T,>(filePath: string): T =>
  JSON.parse(readFileSync(resolve(filePath), 'utf-8')) as T;

const pickYear = () => {
  const yearsIndex = loadJson<{ years: string[] }>('public/data/years/index.json');
  return yearsIndex.years[0];
};

const buildTeamsAndConferencesLocal = (year: string) => {
  const yearData = loadJson<any>(`public/data/years/${year}.json`);
  const teamsData = loadJson<any>('public/data/teams.json');
  const conferencesData = loadJson<any>('public/data/conferences.json');

  const teams: Team[] = [];
  let teamId = 1;

  const makeTeam = (teamName: string, prestige: number, conferenceName: string | null, confGames: number): Team => {
    const meta = teamsData.teams[teamName];
    const team: Team = {
      id: teamId,
      name: teamName,
      abbreviation: meta.abbreviation,
      confGames: 0,
      confLimit: confGames,
      nonConfGames: 0,
      nonConfLimit: 12 - confGames,
      prestige,
      prestige_change: 0,
      ceiling: meta.ceiling,
      floor: meta.floor,
      mascot: meta.mascot,
      ranking: 0,
      offense: 90,
      defense: 90,
      colorPrimary: meta.colorPrimary,
      colorSecondary: meta.colorSecondary,
      conference: conferenceName ?? 'Independent',
      confName: conferenceName ?? 'Independent',
      confWins: 0,
      confLosses: 0,
      nonConfWins: 0,
      nonConfLosses: 0,
      rating: 90,
      totalWins: 0,
      totalLosses: 0,
      gamesPlayed: 0,
      record: '0-0 (0-0)',
      movement: 0,
      poll_score: 0,
      strength_of_record: 0,
      last_game: null,
      next_game: null,
    };
    teamId += 1;
    return team;
  };

  Object.entries(yearData.conferences || {}).forEach(([confName, confData]) => {
    const confGames = confData.games ?? 8;
    Object.entries(confData.teams || {}).forEach(([teamName, prestige]) => {
      teams.push(makeTeam(teamName, prestige as number, confName, confGames));
    });
  });

  Object.entries(yearData.Independent || {}).forEach(([teamName, prestige]) => {
    teams.push(makeTeam(teamName, prestige as number, null, 0));
  });

  return { teams, conferences: conferencesData };
};

const applyRivalriesToScheduleLocal = async (schedule: ReturnType<typeof buildSchedule>, userTeam: Team, teams: Team[]) => {
  const rivalries = loadJson<{ rivalries: [string, string, number | null, string | null][] }>('public/data/rivalries.json');
  const teamByName = new Map(teams.map(team => [team.name, team]));

  rivalries.rivalries.forEach(([teamA, teamB, week, name]) => {
    if (teamA !== userTeam.name && teamB !== userTeam.name) return;
    const opponentName = teamA === userTeam.name ? teamB : teamA;
    const opponent = teamByName.get(opponentName);
    if (!opponent) return;
    if (!week) return;
    const slot = schedule[week - 1];
    if (!slot.opponent) {
      slot.opponent = {
        name: opponent.name,
        rating: opponent.rating,
        ranking: opponent.ranking,
        record: opponent.record,
      };
      slot.label = name ?? 'Rivalry';
      slot.id = `${userTeam.name}-vs-${opponent.name}-week-${week}`;
    }
  });
};

const buildRivalryFixedGames = async (teamsByName: Map<string, any>): Promise<FullGame[]> => {
  const rivalries = loadJson<{ rivalries: [string, string, number | null, string | null][] }>('public/data/rivalries.json');
  const seen = new Set<string>();
  const games: FullGame[] = [];

  rivalries.rivalries.forEach(([teamAName, teamBName, week, name]) => {
    if (!week) return;
    const teamA = teamsByName.get(teamAName);
    const teamB = teamsByName.get(teamBName);
    if (!teamA || !teamB) return;
    const key = [teamA.id, teamB.id].sort((a, b) => a - b).join('-') + `-${week}`;
    if (seen.has(key)) return;
    seen.add(key);
    games.push({
      teamA,
      teamB,
      weekPlayed: week,
      homeTeam: null,
      awayTeam: null,
      name: name ?? null,
    });
  });

  return games;
};

const analyzeSchedule = (games: FullGame[], teams: Array<{ id: number; name: string }>) => {
  const byTeamWeek = new Map<number, Map<number, number>>();
  const byTeamTotal = new Map<number, number>();
  const duplicateGames = new Map<string, number>();

  games.forEach(game => {
    const key = `${Math.min(game.teamA.id, game.teamB.id)}-${Math.max(game.teamA.id, game.teamB.id)}-${game.weekPlayed}`;
    duplicateGames.set(key, (duplicateGames.get(key) ?? 0) + 1);

    [game.teamA.id, game.teamB.id].forEach(teamId => {
      const weekMap = byTeamWeek.get(teamId) ?? new Map<number, number>();
      weekMap.set(game.weekPlayed, (weekMap.get(game.weekPlayed) ?? 0) + 1);
      byTeamWeek.set(teamId, weekMap);
      byTeamTotal.set(teamId, (byTeamTotal.get(teamId) ?? 0) + 1);
    });
  });

  const multiWeekTeams: Array<{ teamId: number; week: number; count: number }> = [];
  byTeamWeek.forEach((weekMap, teamId) => {
    weekMap.forEach((count, week) => {
      if (count > 1) multiWeekTeams.push({ teamId, week, count });
    });
  });

  const totalByTeam = teams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    games: byTeamTotal.get(team.id) ?? 0,
  }));

  const duplicatePairs = Array.from(duplicateGames.entries())
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));

  return { multiWeekTeams, totalByTeam, duplicatePairs };
};

const main = async () => {
  const year = pickYear();
  const { teams } = buildTeamsAndConferencesLocal(year);
  const userTeam = teams[0];
  const teamsByName = new Map(teams.map(team => [team.name, team]));

  const schedule = buildSchedule();
  await applyRivalriesToScheduleLocal(schedule, userTeam, teams);

  // Phase 1: non-con rivalry games saved early
  const preexistingGames = await buildRivalryFixedGames(teamsByName);

  // Phase 2: full schedule build (like initializeSimData) without clearing existing games
  const fullGames = fillUserSchedule(schedule, userTeam, teams, preexistingGames);
  const combinedGames = [...preexistingGames, ...fullGames];

  console.log(`Year: ${year}`);
  console.log(`Preexisting rivalry games: ${preexistingGames.length}`);
  console.log(`Full schedule games: ${fullGames.length}`);
  console.log(`Combined games: ${combinedGames.length}`);

  const { multiWeekTeams, totalByTeam, duplicatePairs } = analyzeSchedule(combinedGames, teams);
  const badTotals = totalByTeam.filter(entry => entry.games !== 12);

  if (duplicatePairs.length) {
    console.log('Duplicate game entries (same teams, same week):');
    duplicatePairs.forEach(entry => console.log(`  ${entry.key}: ${entry.count}`));
  } else {
    console.log('No duplicate game entries found.');
  }

  if (multiWeekTeams.length) {
    console.log('Teams with multiple games in the same week:');
    multiWeekTeams.forEach(entry => console.log(`  teamId=${entry.teamId} week=${entry.week} count=${entry.count}`));
  } else {
    console.log('No teams with multiple games in a week.');
  }

  if (badTotals.length) {
    console.log('Teams with non-12 total games:');
    badTotals.forEach(entry => console.log(`  ${entry.teamName} (${entry.teamId}): ${entry.games}`));
  } else {
    console.log('All teams have 12 games.');
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
