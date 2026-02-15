import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { GameRecord } from '../../types/db';
import { DEFAULT_SETTINGS } from '../../types/league';
import { CONFERENCE_CHAMPIONSHIP_WEEK } from '../league/postseason';
import { buildBaseLabel } from '../gameHelpers';
import { buildOddsFields, loadOddsContext } from '../odds';
import { nextId } from './ids';
import { buildWatchability } from './games';
import { getGameById, saveGames } from '../../db/simRepo';

const isConferenceGame = (teamA: Team, teamB: Team) =>
  teamA.conference !== 'Independent' && teamA.conference === teamB.conference;

const updateTeamGameCounts = (teamA: Team, teamB: Team) => {
  if (isConferenceGame(teamA, teamB)) {
    teamA.confGames += 1;
    teamB.confGames += 1;
  } else {
    teamA.nonConfGames += 1;
    teamB.nonConfGames += 1;
  }
};

const createGameRecord = (
  league: LeagueState,
  teamA: Team,
  teamB: Team,
  weekPlayed: number,
  name: string,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  options?: { neutralSite?: boolean; homeTeam?: Team | null; awayTeam?: Team | null }
) => {
  const neutralSite = options?.neutralSite ?? true;
  const homeTeam = neutralSite ? null : options?.homeTeam ?? teamA;
  const awayTeam = neutralSite ? null : options?.awayTeam ?? teamB;
  const oddsFields = buildOddsFields(teamA, teamB, homeTeam, neutralSite, oddsContext);

  const record: GameRecord = {
    id: nextId(league, 'game'),
    teamAId: teamA.id,
    teamBId: teamB.id,
    homeTeamId: homeTeam?.id ?? null,
    awayTeamId: awayTeam?.id ?? null,
    neutralSite,
    winnerId: null,
    baseLabel: buildBaseLabel(teamA, teamB, name),
    name,
    ...oddsFields,
    weekPlayed,
    year: league.info.currentYear,
    rankATOG: teamA.ranking,
    rankBTOG: teamB.ranking,
    resultA: null,
    resultB: null,
    overtime: 0,
    scoreA: null,
    scoreB: null,
    headline: null,
    watchability: null,
  };
  record.watchability = buildWatchability(record, league.teams.length);
  updateTeamGameCounts(teamA, teamB);
  return record;
};

const sortConferenceTeams = (teams: Team[]) => {
  return teams.slice().sort((a, b) => {
    const aGames = a.confWins + a.confLosses;
    const bGames = b.confWins + b.confLosses;
    const aPct = aGames ? a.confWins / aGames : 0;
    const bPct = bGames ? b.confWins / bGames : 0;
    if (bPct !== aPct) return bPct - aPct;
    if (b.confWins !== a.confWins) return b.confWins - a.confWins;
    if (a.ranking !== b.ranking) return a.ranking - b.ranking;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return a.totalLosses - b.totalLosses;
  });
};

const getConferenceChampion = async (
  league: LeagueState,
  conferenceName: string,
  teamsById: Map<number, Team>
) => {
  const conference = league.conferences.find(conf => conf.confName === conferenceName);
  if (!conference || conference.confName === 'Independent') return null;

  if (conference.championship) {
    const game = await getGameById(conference.championship);
    if (game?.winnerId) {
      return teamsById.get(game.winnerId) ?? null;
    }
  }

  const conferenceTeams = league.teams.filter(team => team.conference === conferenceName);
  const sorted = sortConferenceTeams(conferenceTeams);
  return sorted[0] ?? null;
};

const getPlayoffTeamOrder = async (
  league: LeagueState,
  teamsById: Map<number, Team>
) => {
  const playoffAutobids = league.settings?.playoff_autobids ?? DEFAULT_SETTINGS.playoff_autobids ?? 0;
  const playoffConfChampTop4 = league.settings?.playoff_conf_champ_top_4 ?? DEFAULT_SETTINGS.playoff_conf_champ_top_4 ?? false;

  const conferenceNames = league.conferences
    .map(conf => conf.confName)
    .filter(confName => confName !== 'Independent');

  const champions: Team[] = [];
  for (const confName of conferenceNames) {
    const champion = await getConferenceChampion(league, confName, teamsById);
    if (champion) champions.push(champion);
  }

  champions.sort((a, b) => a.ranking - b.ranking);

  const autobids = champions.slice(0, playoffAutobids);
  const autobidIds = new Set(autobids.map(team => team.id));
  const wildCards = league.teams
    .filter(team => !autobidIds.has(team.id))
    .sort((a, b) => a.ranking - b.ranking);

  const cutoff = 8 - (playoffAutobids - 4);
  const nonPlayoffTeams = wildCards.slice(cutoff);
  const wildCardPool = wildCards.slice(0, cutoff);

  let byes: Team[] = [];
  let remainingAutobids: Team[] = [];
  let remainingWildCards: Team[] = [];

  if (playoffConfChampTop4) {
    byes = autobids.slice(0, 4);
    remainingAutobids = autobids.slice(4);
    remainingWildCards = wildCardPool.slice();
  } else {
    const allCandidates = [...autobids, ...wildCardPool].sort((a, b) => a.ranking - b.ranking);
    byes = allCandidates.slice(0, 4);
    const byeIds = new Set(byes.map(team => team.id));
    remainingAutobids = autobids.filter(team => !byeIds.has(team.id));
    remainingWildCards = wildCardPool.filter(team => !byeIds.has(team.id));
  }

  const seededRest = [...remainingWildCards, ...remainingAutobids].sort((a, b) => a.ranking - b.ranking);
  return [...byes, ...seededRest, ...nonPlayoffTeams];
};

const setConferenceChampionships = async (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => {
  const gamesToCreate: GameRecord[] = [];
  league.conferences.forEach(conference => {
    if (conference.confName === 'Independent') return;
    if (conference.championship) return;

    const conferenceTeams = league.teams.filter(team => team.conference === conference.confName);
    const sortedTeams = sortConferenceTeams(conferenceTeams);
    const teamA = sortedTeams[0];
    const teamB = sortedTeams[1];
    if (!teamA || !teamB) return;

    const game = createGameRecord(
      league,
      teamA,
      teamB,
      CONFERENCE_CHAMPIONSHIP_WEEK,
      `${conference.confName} championship`,
      oddsContext,
      { neutralSite: true }
    );
    conference.championship = game.id;
    gamesToCreate.push(game);
  });

  if (gamesToCreate.length) {
    await saveGames(gamesToCreate);
  }
};

const setPlayoffR1 = async (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => {
  if (!league.playoff) {
    league.playoff = { seeds: [] };
  }
  if (league.playoff.left_r1_1 || league.playoff.left_r1_2 || league.playoff.right_r1_1 || league.playoff.right_r1_2) {
    return;
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const teams = await getPlayoffTeamOrder(league, teamsById);
  const seeds = teams.slice(0, 12);
  if (seeds.length < 12) return;

  seeds.forEach((team, index) => {
    team.ranking = index + 1;
  });

  league.playoff.seeds = seeds.map(team => team.id);

  const week = CONFERENCE_CHAMPIONSHIP_WEEK + 1;
  const gamesToCreate = [
    createGameRecord(league, seeds[7], seeds[8], week, 'Playoff round 1', oddsContext, { neutralSite: true }),
    createGameRecord(league, seeds[4], seeds[11], week, 'Playoff round 1', oddsContext, { neutralSite: true }),
    createGameRecord(league, seeds[6], seeds[9], week, 'Playoff round 1', oddsContext, { neutralSite: true }),
    createGameRecord(league, seeds[5], seeds[10], week, 'Playoff round 1', oddsContext, { neutralSite: true }),
  ];

  league.playoff.left_r1_1 = gamesToCreate[0].id;
  league.playoff.left_r1_2 = gamesToCreate[1].id;
  league.playoff.right_r1_1 = gamesToCreate[2].id;
  league.playoff.right_r1_2 = gamesToCreate[3].id;

  await saveGames(gamesToCreate);
};

const setPlayoffQuarter = async (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => {
  if (!league.playoff) return;
  if (league.playoff.left_quarter_1 || league.playoff.left_quarter_2 || league.playoff.right_quarter_1 || league.playoff.right_quarter_2) {
    return;
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const seeds = (league.playoff.seeds ?? [])
    .map(id => teamsById.get(id))
    .filter(Boolean) as Team[];
  if (seeds.length < 4) return;

  const r1Ids = [
    league.playoff.left_r1_1,
    league.playoff.left_r1_2,
    league.playoff.right_r1_1,
    league.playoff.right_r1_2,
  ];
  const r1Games = await Promise.all(r1Ids.map(id => (id ? getGameById(id) : null)));
  if (r1Games.some(game => !game?.winnerId)) return;

  const winners = r1Games.map(game => teamsById.get(game!.winnerId!)).filter(Boolean) as Team[];
  if (winners.length < 4) return;

  const week = CONFERENCE_CHAMPIONSHIP_WEEK + 2;
  const gamesToCreate = [
    createGameRecord(league, seeds[0], winners[0], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true }),
    createGameRecord(league, seeds[3], winners[1], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true }),
    createGameRecord(league, seeds[1], winners[2], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true }),
    createGameRecord(league, seeds[2], winners[3], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true }),
  ];

  league.playoff.left_quarter_1 = gamesToCreate[0].id;
  league.playoff.left_quarter_2 = gamesToCreate[1].id;
  league.playoff.right_quarter_1 = gamesToCreate[2].id;
  league.playoff.right_quarter_2 = gamesToCreate[3].id;

  await saveGames(gamesToCreate);
};

const setPlayoffSemi = async (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => {
  if (!league.playoff) {
    league.playoff = { seeds: [] };
  }
  if (league.playoff.left_semi || league.playoff.right_semi) {
    return;
  }

  const playoffTeams = league.settings?.playoff_teams ?? DEFAULT_SETTINGS.playoff_teams;
  const week = playoffTeams === 4
    ? CONFERENCE_CHAMPIONSHIP_WEEK + 1
    : CONFERENCE_CHAMPIONSHIP_WEEK + 3;

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const gamesToCreate: GameRecord[] = [];

  if (playoffTeams === 4) {
    const seeds = league.teams
      .slice()
      .sort((a, b) => a.ranking - b.ranking)
      .slice(0, 4);
    if (seeds.length < 4) return;
    league.playoff.seeds = seeds.map(team => team.id);

    gamesToCreate.push(
      createGameRecord(league, seeds[0], seeds[3], week, 'Playoff semifinal', oddsContext, { neutralSite: true }),
      createGameRecord(league, seeds[1], seeds[2], week, 'Playoff semifinal', oddsContext, { neutralSite: true })
    );
  } else {
    const quarterIds = [
      league.playoff.left_quarter_1,
      league.playoff.left_quarter_2,
      league.playoff.right_quarter_1,
      league.playoff.right_quarter_2,
    ];
    const quarterGames = await Promise.all(quarterIds.map(id => (id ? getGameById(id) : null)));
    if (quarterGames.some(game => !game?.winnerId)) return;

    const winners = quarterGames.map(game => teamsById.get(game!.winnerId!)).filter(Boolean) as Team[];
    if (winners.length < 4) return;

    gamesToCreate.push(
      createGameRecord(league, winners[0], winners[1], week, 'Playoff semifinal', oddsContext, { neutralSite: true }),
      createGameRecord(league, winners[2], winners[3], week, 'Playoff semifinal', oddsContext, { neutralSite: true })
    );
  }

  league.playoff.left_semi = gamesToCreate[0]?.id;
  league.playoff.right_semi = gamesToCreate[1]?.id;

  if (gamesToCreate.length) {
    await saveGames(gamesToCreate);
  }
};

const setNatty = async (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => {
  if (!league.playoff) {
    league.playoff = { seeds: [] };
  }
  if (league.playoff.natty) {
    return;
  }

  const playoffTeams = league.settings?.playoff_teams ?? DEFAULT_SETTINGS.playoff_teams;
  const week = playoffTeams === 2
    ? CONFERENCE_CHAMPIONSHIP_WEEK + 1
    : playoffTeams === 4
      ? CONFERENCE_CHAMPIONSHIP_WEEK + 2
      : CONFERENCE_CHAMPIONSHIP_WEEK + 4;

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  let teamA: Team | null = null;
  let teamB: Team | null = null;

  if (playoffTeams === 2) {
    const seeds = league.teams
      .slice()
      .sort((a, b) => a.ranking - b.ranking)
      .slice(0, 2);
    league.playoff.seeds = seeds.map(team => team.id);
    [teamA, teamB] = seeds;
  } else {
    const leftSemi = league.playoff.left_semi ? await getGameById(league.playoff.left_semi) : null;
    const rightSemi = league.playoff.right_semi ? await getGameById(league.playoff.right_semi) : null;
    if (!leftSemi?.winnerId || !rightSemi?.winnerId) return;
    teamA = teamsById.get(leftSemi.winnerId) ?? null;
    teamB = teamsById.get(rightSemi.winnerId) ?? null;
  }

  if (!teamA || !teamB) return;
  const game = createGameRecord(league, teamA, teamB, week, 'National Championship', oddsContext, { neutralSite: true });
  league.playoff.natty = game.id;
  await saveGames([game]);
};

export const handleSpecialWeeks = async (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => {
  const playoffTeams = league.settings?.playoff_teams ?? DEFAULT_SETTINGS.playoff_teams;
  const specialActions: Record<number, Record<number, (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => Promise<void>>> = {
    2: {
      14: setConferenceChampionships,
      15: setNatty,
    },
    4: {
      14: setConferenceChampionships,
      15: setPlayoffSemi,
      16: setNatty,
    },
    12: {
      14: setConferenceChampionships,
      15: setPlayoffR1,
      16: setPlayoffQuarter,
      17: setPlayoffSemi,
      18: setNatty,
    },
  };

  const action = specialActions[playoffTeams]?.[league.info.currentWeek];
  if (action) {
    await action(league, oddsContext);
  }
};
