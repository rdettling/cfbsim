import type { Settings, Team } from '../../../types/domain';
import type { PlayerRecord } from '../../../types/db';
import type { YearData } from '../../../types/baseData';
import { getHistoryData, getPrestigeConfig, getTeamsData, getYearData, setHistoryData } from '../../../db/baseData';
import { saveLeague } from '../../../db/leagueRepo';
import { getAllGames, getAllGameLogs, getAllPlayers, savePlayers, getGameById } from '../../../db/simRepo';
import { buildAwards } from '../awards';
import { DEFAULT_SETTINGS, ensureSettings } from '../../../types/league';
import { loadLeagueOrThrow } from '../leagueStore';
import { advanceToProgression, advanceToRecruitingSummary, advanceToRosterCuts } from '../stages';
import { calculateRecruitingRankings } from '../offseason';
import { applyPrestigeChanges, calculatePrestigeChanges, getPrestigeAvgRanks } from '../prestige';
import { updateHistoryForSeason } from '../history';
import { previewRosterCuts, ensureRosters } from '../../roster';

export const loadAwards = async () => {
  const league = await loadLeagueOrThrow();
  await ensureRosters(league);
  await saveLeague(league);
  const [players, gameLogs, games] = await Promise.all([
    getAllPlayers(),
    getAllGameLogs(),
    getAllGames(),
  ]);

  const playedGameIds = new Set(
    games.filter(game => game.year === league.info.currentYear && game.winnerId !== null).map(game => game.id)
  );
  const yearLogs = gameLogs.filter(log => playedGameIds.has(log.gameId));
  const { favorites, final } = buildAwards(league, players, yearLogs);

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    favorites,
    final: league.info.stage === 'summary' ? final : [],
  };
};

export const loadSeasonSummary = async () => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const [players, gameLogs, games, historyData, teamsData, prestigeConfig] = await Promise.all([
    getAllPlayers(),
    getAllGameLogs(),
    getAllGames(),
    getHistoryData(),
    getTeamsData(),
    getPrestigeConfig(),
  ]);

  const playedGameIds = new Set(
    games.filter(game => game.year === league.info.currentYear && game.winnerId !== null).map(game => game.id)
  );
  const yearLogs = gameLogs.filter(log => playedGameIds.has(log.gameId));
  const { final } = buildAwards(league, players, yearLogs);

  let champion: Team | null = null;
  if (league.playoff?.natty) {
    const nattyGame =
      games.find(game => game.id === league.playoff?.natty) ??
      (await getGameById(league.playoff.natty));
    if (nattyGame?.winnerId) {
      champion = league.teams.find(team => team.id === nattyGame.winnerId) ?? null;
    }
  }

  const avgRanks =
    league.info.stage === 'summary'
      ? calculatePrestigeChanges(
          league,
          historyData,
          teamsData,
          prestigeConfig
        )
      : getPrestigeAvgRanks(league, historyData);

  const shouldUpdateHistory = league.info.stage === 'summary';
  const updatedHistory = shouldUpdateHistory
    ? updateHistoryForSeason(league, historyData)
    : historyData;
  if (shouldUpdateHistory) {
    await setHistoryData(updatedHistory);
  }

  const teamsWithAvgRanks = league.teams.map(team => ({
    ...team,
    avg_rank_before: avgRanks[team.name]?.before ?? null,
    avg_rank_after: avgRanks[team.name]?.after ?? null,
  }));

  await saveLeague(league);

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    champion,
    awards: final,
    teams: teamsWithAvgRanks,
  };
};

export const loadRealignment = async () => {
  const league = await loadLeagueOrThrow();

  const changed = ensureSettings(league);
  if (changed) {
    await saveLeague(league);
  }

  if (league.info.stage === 'summary') {
    applyPrestigeChanges(league);
    league.info.stage = 'realignment';
    await saveLeague(league);
  }

  const nextYear = league.info.currentYear + 1;
  let realignment: Record<string, { old: string; new: string }> = {};
  let playoff_changes: Record<string, { old: any; new: any }> = {};

  try {
    const yearData = (await getYearData(String(nextYear))) as YearData;

    const teamDict: Record<string, { old: string; new?: string }> = {};
    league.teams.forEach(team => {
      teamDict[team.name] = { old: team.conference || 'Independent' };
    });

    Object.entries(yearData.conferences ?? {}).forEach(([confName, confData]) => {
      Object.keys(confData.teams || {}).forEach(teamName => {
        if (teamDict[teamName]) {
          teamDict[teamName].new = confName;
        } else {
          teamDict[teamName] = { old: 'FCS', new: confName };
        }
      });
    });

    Object.keys(yearData.Independent ?? {}).forEach(teamName => {
      if (teamDict[teamName]) {
        teamDict[teamName].new = 'Independent';
      } else {
        teamDict[teamName] = { old: 'FCS', new: 'Independent' };
      }
    });

    realignment = Object.fromEntries(
      Object.entries(teamDict)
        .filter(([, confs]) => confs.new && confs.old !== confs.new)
        .map(([teamName, confs]) => [teamName, { old: confs.old, new: confs.new! }])
    );

    const playoffConfig = yearData.playoff ?? {};
    const current = league.settings ?? { ...DEFAULT_SETTINGS };
    let nextTeams = playoffConfig.teams ?? current.playoff_teams;
    let nextAutobids = playoffConfig.conf_champ_autobids ?? 0;
    let nextTop4 = playoffConfig.conf_champ_top_4 ?? false;

    if (nextTeams === 2 || nextTeams === 4) {
      nextAutobids = 0;
      nextTop4 = false;
    }

    if (current.playoff_teams !== nextTeams) {
      playoff_changes.teams = { old: current.playoff_teams, new: nextTeams };
    }
    if ((current.playoff_autobids ?? 0) !== nextAutobids) {
      playoff_changes.autobids = { old: current.playoff_autobids ?? 0, new: nextAutobids };
    }
    if ((current.playoff_conf_champ_top_4 ?? false) !== nextTop4) {
      playoff_changes.conf_champ_top_4 = {
        old: current.playoff_conf_champ_top_4 ?? false,
        new: nextTop4,
      };
    }
  } catch {
    realignment = {};
    playoff_changes = {};
  }

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    settings: league.settings ?? { ...DEFAULT_SETTINGS },
    realignment,
    playoff_changes,
  };
};

export const updateRealignmentSettings = async (settings: Settings) => {
  const league = await loadLeagueOrThrow();
  league.settings = { ...league.settings, ...settings };
  await saveLeague(league);
};

export const loadRosterProgression = async () => {
  const league = await loadLeagueOrThrow();

  await advanceToProgression(league);
  await ensureRosters(league);
  await saveLeague(league);

  const team = league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0];
  const players = await getAllPlayers();
  const teamPlayers = players.filter(player => player.active && player.teamId === team.id);

  const leaving = teamPlayers.filter(player => player.year === 'sr');
  const progressed = teamPlayers
    .filter(player => player.year !== 'sr')
    .map(player => {
      let next_year: PlayerRecord['year'] = 'sr';
      let next_rating = player.rating_sr;

      if (player.year === 'fr') {
        next_year = 'so';
        next_rating = player.rating_so;
      } else if (player.year === 'so') {
        next_year = 'jr';
        next_rating = player.rating_jr;
      }

      return {
        id: player.id,
        first: player.first,
        last: player.last,
        pos: player.pos,
        year: player.year,
        rating: player.rating,
        next_year,
        next_rating,
        stars: player.stars,
        development_trait: player.development_trait,
      };
    });

  return {
    info: league.info,
    team,
    leaving,
    progressed,
    conferences: league.conferences,
  };
};

export const loadRecruitingSummary = async () => {
  const league = await loadLeagueOrThrow();
  await ensureRosters(league);
  const players = await getAllPlayers();

  const advanced = await advanceToRecruitingSummary(league, players);
  if (advanced) {
    await savePlayers(players);
    await saveLeague(league);
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const freshmen = players.filter(player => player.active && player.year === 'fr');

  const freshmenByTeam: Record<string, { team: Team; players: Array<{ id: number; first: string; last: string; pos: string; rating: number; stars: number }> }> = {};
  freshmen.forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    if (!freshmenByTeam[team.name]) {
      freshmenByTeam[team.name] = { team, players: [] };
    }
    freshmenByTeam[team.name].players.push({
      id: player.id,
      first: player.first,
      last: player.last,
      pos: player.pos,
      rating: player.rating,
      stars: player.stars,
    });
  });

  const team_rankings = calculateRecruitingRankings(freshmenByTeam);

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    team_rankings,
    summary_stats: {
      total_freshmen: freshmen.length,
      avg_rating: freshmen.length
        ? Math.round((freshmen.reduce((sum, player) => sum + player.rating, 0) / freshmen.length) * 10) / 10
        : 0,
      max_rating: freshmen.length ? Math.max(...freshmen.map(player => player.rating)) : 0,
      min_rating: freshmen.length ? Math.min(...freshmen.map(player => player.rating)) : 0,
    },
  };
};

export const loadRosterCuts = async () => {
  const league = await loadLeagueOrThrow();
  await ensureRosters(league);
  const advanced = advanceToRosterCuts(league);
  if (advanced) {
    await saveLeague(league);
  }

  const team = league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0];
  const players = await getAllPlayers();
  const cuts = previewRosterCuts(players, team.id);

  return {
    info: league.info,
    team,
    cuts,
    conferences: league.conferences,
  };
};
