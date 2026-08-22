import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { GameRecord } from '../../types/db';
import {
  BOWL_WEEK,
  CONFERENCE_CHAMPIONSHIP_WEEK,
} from '../league/postseason';
import { REGULAR_SEASON_WEEKS } from '../schedule/constants';
import { registerMatchup } from '../schedule/matchups';
import { buildBaseLabel } from '../utils/gameLabels';
import { buildOddsFields, loadOddsContext } from '../odds';
import { nextId } from './ids';
import { buildWatchability } from './games';
import {
  getAllGames,
  getGameById,
  getGamesByWeek,
  saveGamesAndLeague,
} from '../../db/simRepo';
import { buildPlayoffSelection } from '../league/utils/playoffSelection';
import { buildResumeComparisonSnapshot } from '../league/utils/resumeComparison';
import { buildBowlMatchups } from '../league/utils/bowlSelection';
import {
  buildConferenceStandings,
  freezeConferenceStandings,
  resolveConferenceChampion,
} from '../league/utils/standings';
import { generatePlayoffFieldNews } from '../news/rankings';
import { finalizeCompletedSeasonIfReady } from './seasonCompletion';

const setBowls = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>
) => {
  const playoffTeams = league.settings.playoffTeams;
  const existing = (await getGamesByWeek(BOWL_WEEK)).filter(
    game => game.year === league.info.currentYear
  );
  if (existing.some(game => game.gameType === 'bowl')) {
    return;
  }

  const playoffTeamIds = new Set<number>(league.playoff.seeds);
  const matchups = buildBowlMatchups({
    teams: league.teams,
    playoffTeamIds,
    year: league.info.currentYear,
    playoffTeams,
    requireEligibility: true,
  });
  if (!matchups.length) return;

  const gamesToCreate = matchups.map(({ name, teamA, teamB }) =>
    createGameRecord(league, teamA, teamB, BOWL_WEEK, name, oddsContext, {
      neutralSite: true,
      gameType: 'bowl',
    })
  );

  await saveGamesAndLeague(gamesToCreate, league);
};

const createGameRecord = (
  league: LeagueState,
  teamA: Team,
  teamB: Team,
  weekPlayed: number,
  name: string,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  options: {
    gameType: import('../../types/news').GameType;
    neutralSite?: boolean;
    homeTeam?: Team | null;
    awayTeam?: Team | null;
  },
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
    venue: null,
    winnerId: null,
    baseLabel: buildBaseLabel(teamA, teamB, name),
    name,
    gameType: options.gameType,
    rivalryKey: null,
    ...oddsFields,
    weekPlayed,
    year: league.info.currentYear,
    rankATOG: teamA.ranking,
    rankBTOG: teamB.ranking,
    resultA: null,
    resultB: null,
    overtime: 0,
    quarter: 1,
    clockSecondsLeft: 900,
    scoreA: null,
    scoreB: null,
    watchability: 0,
  };
  record.watchability = buildWatchability(record, league.teams.length);
  registerMatchup(teamA, teamB);
  return record;
};

const getPostseasonSelectionContext = async (
  league: LeagueState,
  teamsById: Map<number, Team>,
  requireActualChampions = false,
) => {
  const games = await getAllGames();
  const champions: Team[] = [];
  for (const conference of league.conferences) {
    if (conference.confName === 'Independent') continue;
    const conferenceTeams = league.teams.filter(
      team => team.conference === conference.confName,
    );
    const standings = buildConferenceStandings({
      teams: conferenceTeams,
      games,
      year: league.info.currentYear,
      finalStandings: conference.finalStandings,
    });
    const champion = resolveConferenceChampion({ conference, standings, games });
    if (!champion) continue;
    if (requireActualChampions && champion.status !== 'actual') return null;
    champions.push(teamsById.get(champion.team.id) ?? champion.team);
  }

  champions.sort((a, b) => a.ranking - b.ranking);
  return {
    champions,
    selection: buildPlayoffSelection(league, champions),
  };
};

const applyPlayoffCommitteeRankings = (orderedTeams: Team[]) => {
  orderedTeams.forEach((team, index) => {
    team.last_rank = team.ranking;
    team.ranking = index + 1;
  });
};

const setConferenceChampionships = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  const conferences = league.conferences.filter(
    conference => conference.confName !== 'Independent',
  );
  if (conferences.every(conference =>
    conference.championship !== null && conference.finalStandings !== null)) return;
  if (conferences.some(conference =>
    conference.championship !== null || conference.finalStandings !== null)) {
    throw new Error('Conference championship state is only partially initialized.');
  }
  const conferenceTeams = conferences.map(conference => ({
    conference,
    teams: league.teams.filter(team => team.conference === conference.confName),
  }));
  const invalid = conferenceTeams.find(entry => entry.teams.length < 2);
  if (invalid) {
    throw new Error(`${invalid.conference.confName} requires at least two teams for its championship.`);
  }
  const games = await getAllGames();
  const regularSeasonGames = games.filter(game =>
    game.year === league.info.currentYear &&
    game.gameType === 'regular_season' &&
    game.weekPlayed <= REGULAR_SEASON_WEEKS,
  );
  if (
    regularSeasonGames.some(game => game.winnerId === null) ||
    league.info.lastRankingsWeek !== REGULAR_SEASON_WEEKS
  ) return;

  const selections = conferenceTeams.map(({ conference, teams }) => {
    const standings = buildConferenceStandings({
      teams,
      games,
      year: league.info.currentYear,
    });
    return {
      conference,
      standings: freezeConferenceStandings(league.info.currentYear, standings),
      teamA: standings[0]?.team,
      teamB: standings[1]?.team,
    };
  });
  const gamesToCreate: GameRecord[] = [];
  selections.forEach(({ conference, standings, teamA, teamB }) => {
    if (!teamA || !teamB) {
      throw new Error(`${conference.confName} championship participants are unavailable.`);
    }
    const game = createGameRecord(
      league,
      teamA,
      teamB,
      weekOverride ?? CONFERENCE_CHAMPIONSHIP_WEEK,
      `${conference.confName} championship`,
      oddsContext,
      { neutralSite: true, gameType: 'conference_championship' }
    );
    conference.championship = game.id;
    conference.finalStandings = standings;
    gamesToCreate.push(game);
  });

  if (gamesToCreate.length) await saveGamesAndLeague(gamesToCreate, league);
};

const setPlayoffR1 = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  if (league.playoff.left_r1_1 || league.playoff.left_r1_2 || league.playoff.right_r1_1 || league.playoff.right_r1_2) {
    return;
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const context = await getPostseasonSelectionContext(league, teamsById, true);
  if (!context) return;
  const { selection } = context;
  const teams = selection.order;
  applyPlayoffCommitteeRankings(teams);
  const seeds = teams.slice(0, 12);
  if (seeds.length < 12) return;

  league.playoff.seeds = seeds.map(team => team.id);

  const week = weekOverride ?? CONFERENCE_CHAMPIONSHIP_WEEK + 1;
  const gamesToCreate = [
    createGameRecord(league, seeds[7], seeds[8], week, 'Playoff round 1', oddsContext, { neutralSite: false, gameType: 'playoff_first_round' }),
    createGameRecord(league, seeds[4], seeds[11], week, 'Playoff round 1', oddsContext, { neutralSite: false, gameType: 'playoff_first_round' }),
    createGameRecord(league, seeds[6], seeds[9], week, 'Playoff round 1', oddsContext, { neutralSite: false, gameType: 'playoff_first_round' }),
    createGameRecord(league, seeds[5], seeds[10], week, 'Playoff round 1', oddsContext, { neutralSite: false, gameType: 'playoff_first_round' }),
  ];

  league.playoff.left_r1_1 = gamesToCreate[0].id;
  league.playoff.left_r1_2 = gamesToCreate[1].id;
  league.playoff.right_r1_1 = gamesToCreate[2].id;
  league.playoff.right_r1_2 = gamesToCreate[3].id;

  const fieldStory = generatePlayoffFieldNews({
    year: league.info.currentYear,
    week: CONFERENCE_CHAMPIONSHIP_WEEK,
    selectedTeamIds: league.playoff.seeds,
    teamsById,
  }).item;
  await saveGamesAndLeague(gamesToCreate, league, [fieldStory]);
};

const setPlayoffQuarter = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
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

  const week = weekOverride ?? CONFERENCE_CHAMPIONSHIP_WEEK + 2;
  const gamesToCreate = [
    createGameRecord(league, seeds[0], winners[0], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true, gameType: 'playoff_quarterfinal' }),
    createGameRecord(league, seeds[3], winners[1], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true, gameType: 'playoff_quarterfinal' }),
    createGameRecord(league, seeds[1], winners[2], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true, gameType: 'playoff_quarterfinal' }),
    createGameRecord(league, seeds[2], winners[3], week, 'Playoff quarterfinal', oddsContext, { neutralSite: true, gameType: 'playoff_quarterfinal' }),
  ];

  league.playoff.left_quarter_1 = gamesToCreate[0].id;
  league.playoff.left_quarter_2 = gamesToCreate[1].id;
  league.playoff.right_quarter_1 = gamesToCreate[2].id;
  league.playoff.right_quarter_2 = gamesToCreate[3].id;

  await saveGamesAndLeague(gamesToCreate, league);
};

const setPlayoffSemi = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  if (league.playoff.left_semi || league.playoff.right_semi) {
    return;
  }

  const playoffTeams = league.settings.playoffTeams;
  const week = weekOverride ?? (playoffTeams === 4
    ? CONFERENCE_CHAMPIONSHIP_WEEK + 1
    : CONFERENCE_CHAMPIONSHIP_WEEK + 3);

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
      createGameRecord(league, seeds[0], seeds[3], week, 'Playoff semifinal', oddsContext, { neutralSite: true, gameType: 'playoff_semifinal' }),
      createGameRecord(league, seeds[1], seeds[2], week, 'Playoff semifinal', oddsContext, { neutralSite: true, gameType: 'playoff_semifinal' })
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
      createGameRecord(league, winners[0], winners[1], week, 'Playoff semifinal', oddsContext, { neutralSite: true, gameType: 'playoff_semifinal' }),
      createGameRecord(league, winners[2], winners[3], week, 'Playoff semifinal', oddsContext, { neutralSite: true, gameType: 'playoff_semifinal' })
    );
  }

  league.playoff.left_semi = gamesToCreate[0]?.id;
  league.playoff.right_semi = gamesToCreate[1]?.id;

  if (gamesToCreate.length) {
    if (playoffTeams === 4) {
      const fieldStory = generatePlayoffFieldNews({
        year: league.info.currentYear,
        week: CONFERENCE_CHAMPIONSHIP_WEEK,
        selectedTeamIds: league.playoff.seeds,
        teamsById,
      }).item;
      await saveGamesAndLeague(gamesToCreate, league, [fieldStory]);
    } else {
      await saveGamesAndLeague(gamesToCreate, league);
    }
  }
};

const setNatty = async (
  league: LeagueState,
  oddsContext: Awaited<ReturnType<typeof loadOddsContext>>,
  weekOverride?: number
) => {
  if (league.playoff.natty) {
    return;
  }

  const playoffTeams = league.settings.playoffTeams;
  const week = weekOverride ?? (playoffTeams === 2
    ? CONFERENCE_CHAMPIONSHIP_WEEK + 1
    : playoffTeams === 4
      ? CONFERENCE_CHAMPIONSHIP_WEEK + 2
      : CONFERENCE_CHAMPIONSHIP_WEEK + 4);

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
  const game = createGameRecord(league, teamA, teamB, week, 'National Championship', oddsContext, { neutralSite: true, gameType: 'national_championship' });
  league.playoff.natty = game.id;
  if (playoffTeams === 2) {
    const fieldStory = generatePlayoffFieldNews({
      year: league.info.currentYear,
      week: CONFERENCE_CHAMPIONSHIP_WEEK,
      selectedTeamIds: league.playoff.seeds,
      teamsById,
    }).item;
    await saveGamesAndLeague([game], league, [fieldStory]);
  } else {
    await saveGamesAndLeague([game], league);
  }
};

export const handleSpecialWeeks = async (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => {
  const currentWeekGames = (await getGamesByWeek(league.info.currentWeek)).filter(
    game => game.year === league.info.currentYear,
  );
  if (currentWeekGames.some(game => game.winnerId === null)) return;

  const playoffTeams = league.settings.playoffTeams;
  const baseWeek = REGULAR_SEASON_WEEKS;
  const ccWeek = CONFERENCE_CHAMPIONSHIP_WEEK;
  const specialActions: Record<number, Record<number, (league: LeagueState, oddsContext: Awaited<ReturnType<typeof loadOddsContext>>) => Promise<void>>> = {
    2: {
      [baseWeek]: setConferenceChampionships,
      [ccWeek]: async (leagueState, context) => {
        await setNatty(leagueState, context);
        await setBowls(leagueState, context);
      },
    },
    4: {
      [baseWeek]: setConferenceChampionships,
      [ccWeek]: async (leagueState, context) => {
        await setPlayoffSemi(leagueState, context);
        await setBowls(leagueState, context);
      },
      [ccWeek + 1]: setNatty,
    },
    12: {
      [baseWeek]: setConferenceChampionships,
      [ccWeek]: async (leagueState, context) => {
        await setPlayoffR1(leagueState, context);
        await setBowls(leagueState, context);
      },
      [ccWeek + 1]: setPlayoffQuarter,
      [ccWeek + 2]: setPlayoffSemi,
      [ccWeek + 3]: setNatty,
    },
  };

  const action = specialActions[playoffTeams]?.[league.info.currentWeek];
  if (action) {
    if (league.info.currentWeek === ccWeek) {
      const games = await getAllGames();
      const gamesById = new Map(games.map(game => [game.id, game]));
      const championshipConferences = league.conferences.filter(
        conference => conference.confName !== 'Independent',
      );
      const championshipIds = championshipConferences
        .map(conference => conference.championship)
        .filter((id): id is number => Boolean(id));
      const championshipsComplete =
        championshipIds.length === championshipConferences.length &&
        championshipIds.every(id => gamesById.get(id)?.winnerId);
      if (!championshipsComplete) return;
      if (league.resumeSnapshot === null) {
        const teamsById = new Map(league.teams.map(team => [team.id, team]));
        const context = await getPostseasonSelectionContext(league, teamsById, true);
        if (!context) return;
        const { champions, selection } = context;
        league.resumeSnapshot = buildResumeComparisonSnapshot({
          league,
          games,
          selection,
          championIds: new Set(champions.map(team => team.id)),
          oddsContext,
        });
      }
    }
    await action(league, oddsContext);
    await finalizeCompletedSeasonIfReady(league);
    return;
  }

  const currentWeek = league.info.currentWeek;
  if (playoffTeams === 12 && league.playoff) {
    const r1Ids = [
      league.playoff.left_r1_1,
      league.playoff.left_r1_2,
      league.playoff.right_r1_1,
      league.playoff.right_r1_2,
    ];
    const quarterIds = [
      league.playoff.left_quarter_1,
      league.playoff.left_quarter_2,
      league.playoff.right_quarter_1,
      league.playoff.right_quarter_2,
    ];
    const semiIds = [league.playoff.left_semi, league.playoff.right_semi];

    if (!quarterIds.some(Boolean)) {
      const r1Games = await Promise.all(r1Ids.map(id => (id ? getGameById(id) : null)));
      if (r1Games.every(game => game?.winnerId)) {
        await setPlayoffQuarter(league, oddsContext, currentWeek);
      }
      await finalizeCompletedSeasonIfReady(league);
      return;
    }

    if (!semiIds.some(Boolean)) {
      const qGames = await Promise.all(quarterIds.map(id => (id ? getGameById(id) : null)));
      if (qGames.every(game => game?.winnerId)) {
        await setPlayoffSemi(league, oddsContext, currentWeek);
      }
      await finalizeCompletedSeasonIfReady(league);
      return;
    }

    if (!league.playoff.natty) {
      const sGames = await Promise.all(semiIds.map(id => (id ? getGameById(id) : null)));
      if (sGames.every(game => game?.winnerId)) {
        await setNatty(league, oddsContext, currentWeek);
      }
    }
    await finalizeCompletedSeasonIfReady(league);
    return;
  }

  if (playoffTeams === 4 && league.playoff) {
    if (!league.playoff.left_semi && !league.playoff.right_semi) return;
    if (!league.playoff.natty) {
      const semiGames = await Promise.all([
        league.playoff.left_semi ? getGameById(league.playoff.left_semi) : null,
        league.playoff.right_semi ? getGameById(league.playoff.right_semi) : null,
      ]);
      if (semiGames.every(game => game?.winnerId)) {
        await setNatty(league, oddsContext, currentWeek);
      }
    }
    await finalizeCompletedSeasonIfReady(league);
    return;
  }

  await finalizeCompletedSeasonIfReady(league);
};
