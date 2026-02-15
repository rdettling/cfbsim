import type { Team, Info, ScheduleGame } from './types';
import type { FullGame } from './schedule';
import { fillUserSchedule } from './schedule';
import { getBettingOddsData, getHeadlinesData } from '../db/baseData';
import { loadLeague, saveLeague } from '../db/leagueRepo';
import {
  clearSimArtifacts,
  getGameById,
  getGamesByWeek,
  getAllGames,
  getPlayersByTeam,
  getDrivesByGame,
  getPlaysByGame,
  saveDrives,
  saveGameLogs,
  saveGames,
  savePlays,
} from '../db/simRepo';
import type { GameRecord, DriveRecord, PlayRecord, GameLogRecord, PlayerRecord } from '../db/db';
import type { Drive, Play, GameData } from '../types/game';
import { ensureRosters } from './roster';

const DRIVES_PER_TEAM = 12;
const OT_START_YARD_LINE = 75;
const HOME_FIELD_ADVANTAGE = 4;

const WIN_FACTOR = 1.5;
const LOSS_FACTOR = 1.08;

const BASE_COMP_PERCENT = 0.62;
const BASE_SACK_RATE = 0.07;
const BASE_INT_RATE = 0.07;
const BASE_FUMBLE_RATE = 0.02;

const PASS_BASE_MEAN = 7;
const PASS_STD_DEV = 5.2;
const PASS_ADVANTAGE_FACTOR = 0.1;
const PASS_POSITIVE_MULTIPLIER = 0.004;
const PASS_POSITIVE_POWER = 3.2;

const SACK_BASE_MEAN = -6;
const SACK_STD_DEV = 2;

const RUN_BASE_MEAN = 2.8;
const RUN_STD_DEV = 5.5;
const RUN_ADVANTAGE_FACTOR = 0;
const RUN_POSITIVE_MULTIPLIER = 0.0004;
const RUN_POSITIVE_POWER = 4.2;

const POLL_INERTIA_WIN_BONUS = 172;
const POLL_INERTIA_LOSS_PENALTY = 157;
const RANKING_TOTAL_WEEKS = 14;

interface LeagueState {
  info: Info;
  teams: Team[];
  conferences: unknown[];
  schedule: ScheduleGame[];
  pending_rivalries: unknown[];
  scheduleBuilt?: boolean;
  simInitialized?: boolean;
  idCounters?: {
    game: number;
    drive: number;
    play: number;
    gameLog: number;
    player: number;
  };
}

interface SimGame {
  id: number;
  teamA: Team;
  teamB: Team;
  homeTeam: Team | null;
  awayTeam: Team | null;
  neutralSite: boolean;
  winner: Team | null;
  baseLabel: string;
  name: string | null;
  spreadA: string;
  spreadB: string;
  moneylineA: string;
  moneylineB: string;
  winProbA: number;
  winProbB: number;
  weekPlayed: number;
  year: number;
  rankATOG: number;
  rankBTOG: number;
  resultA: string | null;
  resultB: string | null;
  overtime: number;
  scoreA: number;
  scoreB: number;
  headline: string | null;
  watchability: number | null;
}

interface SimDrive {
  record: DriveRecord;
  plays: PlayRecord[];
  nextFieldPosition: number;
}

interface StartersCache {
  byTeamPos: Map<string, PlayerRecord[]>;
}

const normalizeCounters = (league: LeagueState) => {
  if (!league.idCounters) {
    league.idCounters = { game: 1, drive: 1, play: 1, gameLog: 1, player: 1 };
  }
  return league.idCounters;
};

const nextId = (league: LeagueState, key: keyof LeagueState['idCounters']) => {
  const counters = normalizeCounters(league);
  const value = counters[key] ?? 1;
  counters[key] = value + 1;
  return value;
};

const gaussian = (mean: number, stdDev: number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stdDev + mean;
};

const formatRecord = (team: Team) =>
  `${team.totalWins}-${team.totalLosses} (${team.confWins}-${team.confLosses})`;

const adjustedRatings = (offense: Team, defense: Team, game?: SimGame) => {
  let offenseRating = offense.offense;
  let defenseRating = defense.defense;
  if (game && !game.neutralSite && game.homeTeam) {
    if (game.homeTeam.id === offense.id) offenseRating += HOME_FIELD_ADVANTAGE;
    if (game.homeTeam.id === defense.id) defenseRating += HOME_FIELD_ADVANTAGE;
  }
  return { offenseRating, defenseRating };
};

const passYards = (offense: Team, defense: Team, game?: SimGame) => {
  const { offenseRating, defenseRating } = adjustedRatings(offense, defense, game);
  const ratingDiff = offenseRating - defenseRating;
  const advantageYardage = ratingDiff * PASS_ADVANTAGE_FACTOR;
  const meanYardage = PASS_BASE_MEAN + advantageYardage;
  const rawYardage = gaussian(meanYardage, PASS_STD_DEV);
  if (rawYardage < 0) return Math.round(rawYardage);
  const multiplied = rawYardage + PASS_POSITIVE_MULTIPLIER * (rawYardage ** PASS_POSITIVE_POWER);
  return Math.min(Math.round(multiplied), 99);
};

const sackYards = () => Math.min(Math.round(gaussian(SACK_BASE_MEAN, SACK_STD_DEV)), 0);

const runYards = (offense: Team, defense: Team, game?: SimGame) => {
  const { offenseRating, defenseRating } = adjustedRatings(offense, defense, game);
  const ratingDiff = offenseRating - defenseRating;
  const advantageYardage = ratingDiff * RUN_ADVANTAGE_FACTOR;
  const meanYardage = RUN_BASE_MEAN + advantageYardage;
  const rawYardage = gaussian(meanYardage, RUN_STD_DEV);
  if (rawYardage < 0) return Math.round(rawYardage);
  const multiplied = rawYardage + RUN_POSITIVE_MULTIPLIER * (rawYardage ** RUN_POSITIVE_POWER);
  return Math.min(Math.round(multiplied), 99);
};

const simPass = (fieldPosition: number, offense: Team, defense: Team, game?: SimGame) => {
  const randSack = Math.random();
  const randCompletion = Math.random();
  const randInterception = Math.random();
  const result = { outcome: '', yards: 0 };

  if (randSack < BASE_SACK_RATE) {
    result.outcome = 'sack';
    result.yards = sackYards();
  } else if (randCompletion < BASE_COMP_PERCENT) {
    result.yards = passYards(offense, defense, game);
    if (result.yards + fieldPosition >= 100) {
      result.yards = 100 - fieldPosition;
      result.outcome = 'touchdown';
    } else {
      result.outcome = 'pass';
    }
  } else if (randInterception < BASE_INT_RATE) {
    result.outcome = 'interception';
  } else {
    result.outcome = 'incomplete pass';
  }

  return result;
};

const simRun = (fieldPosition: number, offense: Team, defense: Team, game?: SimGame) => {
  const randFumble = Math.random();
  const result = { outcome: '', yards: 0 };
  if (randFumble < BASE_FUMBLE_RATE) {
    result.outcome = 'fumble';
  } else {
    result.yards = runYards(offense, defense, game);
    if (result.yards + fieldPosition >= 100) {
      result.yards = 100 - fieldPosition;
      result.outcome = 'touchdown';
    } else {
      result.outcome = 'run';
    }
  }
  return result;
};

const fieldGoal = (fieldPosition: number) => {
  const yardLine = 100 - fieldPosition;
  const distance = yardLine + 17;
  if (distance < 37) return true;
  if (distance < 47) return 0.9 - (distance - 37) * 0.05 > Math.random();
  if (distance < 57) return 0.75 - (distance - 47) * 0.05 > Math.random();
  if (distance >= 57) return 0.55 - (distance - 57) * 0.03 > Math.random();
  return false;
};

const pointsNeeded = (lead: number, driveNum: number) => {
  if (lead >= 0) return 0;
  const drivesLeft = Math.max(1, DRIVES_PER_TEAM - driveNum);
  const deficit = Math.abs(lead);
  const possibleScores = [3, 6, 7, 8];
  const maxScore = Math.max(...possibleScores);
  if (deficit <= (drivesLeft - 1) * maxScore) return 0;
  if (drivesLeft === 1) {
    for (const points of possibleScores) {
      if (points >= deficit) return points;
    }
  }
  for (const points of possibleScores) {
    if (deficit - points <= (drivesLeft - 1) * maxScore) return points;
  }
  return 9;
};

const decideFourthDown = (fieldPosition: number, yardsLeft: number, needed: number) => {
  let decision = 'punt';
  if (fieldPosition <= 40) decision = 'punt';
  else if (fieldPosition <= 50) decision = yardsLeft === 1 ? 'go' : 'punt';
  else if (fieldPosition <= 62) decision = yardsLeft <= 2 ? 'go' : 'punt';
  else decision = yardsLeft <= 3 ? 'go' : 'field_goal';

  if (needed > 0) {
    if (decision === 'punt') decision = 'go';
    if (decision === 'field_goal' && needed > 3) decision = 'go';
  }
  return decision;
};

const setPlayHeader = (play: PlayRecord, offense: Team, defense: Team) => {
  let location = '';
  if (play.startingFP < 50) {
    location = `${offense.abbreviation} ${play.startingFP}`;
  } else if (play.startingFP > 50) {
    location = `${defense.abbreviation} ${100 - play.startingFP}`;
  } else {
    location = `${play.startingFP}`;
  }

  const goalToGo = play.startingFP + play.yardsLeft >= 100;
  const downSuffix = play.down === 1 ? 'st' : play.down === 2 ? 'nd' : play.down === 3 ? 'rd' : 'th';
  if (goalToGo) {
    play.header = `${play.down}${downSuffix} and goal at ${location}`;
  } else {
    play.header = `${play.down}${downSuffix} and ${play.yardsLeft} at ${location}`;
  }
};

const weightedChoice = <T,>(items: Array<{ item: T; weight: number }>) => {
  const total = items.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)]?.item ?? null;
  let threshold = Math.random() * total;
  for (const entry of items) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry.item;
  }
  return items[items.length - 1]?.item ?? null;
};

const chooseReceiver = (candidates: PlayerRecord[], ratingExponent = 4) => {
  if (!candidates.length) return null;
  const posBias: Record<string, number> = { wr: 1.4, te: 1.0, rb: 0.6 };
  const weighted = candidates.map(candidate => ({
    item: candidate,
    weight: (candidate.rating ** ratingExponent) * (posBias[candidate.pos.toLowerCase()] ?? 1),
  }));
  return weightedChoice(weighted);
};

const formatPlayText = (
  play: PlayRecord,
  offense: Team,
  defense: Team,
  starters: StartersCache
) => {
  const rb = starters.byTeamPos.get(`${offense.id}:rb`) ?? [];
  const qb = starters.byTeamPos.get(`${offense.id}:qb`) ?? [];
  const wr = starters.byTeamPos.get(`${offense.id}:wr`) ?? [];
  const te = starters.byTeamPos.get(`${offense.id}:te`) ?? [];
  const k = starters.byTeamPos.get(`${offense.id}:k`) ?? [];
  const p = starters.byTeamPos.get(`${offense.id}:p`) ?? [];

  if (play.playType === 'run') {
    const runner = rb[Math.floor(Math.random() * rb.length)];
    if (!runner) {
      play.text = 'Run play';
      return;
    }
    if (play.result === 'fumble') {
      play.text = `${runner.first} ${runner.last} fumbled`;
    } else if (play.result === 'touchdown') {
      play.text = `${runner.first} ${runner.last} ran ${play.yardsGained} yards for a touchdown`;
    } else {
      play.text = `${runner.first} ${runner.last} ran for ${play.yardsGained} yards`;
    }
  } else if (play.playType === 'pass') {
    const qbStarter = qb[0];
    if (!qbStarter) {
      play.text = 'Pass play';
      return;
    }
    if (play.result === 'sack') {
      play.text = `${qbStarter.first} ${qbStarter.last} was sacked for a loss of ${Math.abs(play.yardsGained)} yards`;
    } else if (play.result === 'interception') {
      play.text = `${qbStarter.first} ${qbStarter.last}'s pass was intercepted`;
    } else if (play.result === 'incomplete pass') {
      play.text = `${qbStarter.first} ${qbStarter.last}'s pass was incomplete`;
    } else {
      const receiver = chooseReceiver([...wr, ...te, ...rb]);
      if (!receiver) {
        play.text = `${qbStarter.first} ${qbStarter.last} completed a pass for ${play.yardsGained} yards`;
      } else if (play.result === 'touchdown') {
        play.text = `${qbStarter.first} ${qbStarter.last} pass complete to ${receiver.first} ${receiver.last} for ${play.yardsGained} yards for a touchdown`;
      } else {
        play.text = `${qbStarter.first} ${qbStarter.last} pass complete to ${receiver.first} ${receiver.last} for ${play.yardsGained} yards`;
      }
    }
  } else if (play.playType === 'field goal') {
    const kicker = k[0];
    const distance = 100 - play.startingFP + 17;
    if (!kicker) {
      play.text = `Field goal attempt from ${distance} yards`;
      return;
    }
    if (play.result === 'made field goal') {
      play.text = `${kicker.first} ${kicker.last}'s ${distance} yard field goal is good`;
    } else {
      play.text = `${kicker.first} ${kicker.last}'s ${distance} yard field goal is no good`;
    }
  } else if (play.playType === 'punt') {
    const punter = p[0];
    play.text = punter ? `${punter.first} ${punter.last} punted` : 'Punt';
  }
};

const updateDriveScoreAfter = (game: SimGame, drive: DriveRecord, offense: Team) => {
  if (drive.result !== 'safety') {
    if (offense.id === game.teamA.id) {
      drive.scoreAAfter += drive.points;
    } else {
      drive.scoreBAfter += drive.points;
    }
  } else {
    if (offense.id === game.teamA.id) {
      drive.scoreBAfter += 2;
    } else {
      drive.scoreAAfter += 2;
    }
  }
};

const simDrive = (
  league: LeagueState,
  game: SimGame,
  fieldPosition: number,
  lead: number,
  offense: Team,
  defense: Team,
  driveNum: number,
  starters: StartersCache
): SimDrive => {
  const driveIndex = driveNum % 2 === 0 ? driveNum / 2 : (driveNum - 1) / 2;
  const needed = pointsNeeded(lead, driveIndex);
  const driveId = nextId(league, 'drive');

  const drive: DriveRecord = {
    id: driveId,
    gameId: game.id,
    driveNum,
    offenseId: offense.id,
    defenseId: defense.id,
    startingFP: fieldPosition,
    result: '',
    points: 0,
    points_needed: needed,
    scoreAAfter: game.scoreA,
    scoreBAfter: game.scoreB,
  };

  const plays: PlayRecord[] = [];
  let yardsLeft = 10;

  while (!drive.result) {
    for (let down = 1; down <= 4; down += 1) {
      const playId = nextId(league, 'play');
      if (down === 1) {
        yardsLeft = fieldPosition >= 90 ? 100 - fieldPosition : 10;
      }

      const play: PlayRecord = {
        id: playId,
        gameId: game.id,
        driveId: driveId,
        offenseId: offense.id,
        defenseId: defense.id,
        startingFP: fieldPosition,
        down,
        yardsLeft,
        playType: '',
        yardsGained: 0,
        result: '',
        text: '',
        header: '',
        scoreA: game.scoreA,
        scoreB: game.scoreB,
      };

      setPlayHeader(play, offense, defense);

      if (down === 4) {
        const decision = decideFourthDown(fieldPosition, yardsLeft, needed);
        if (decision === 'field_goal') {
          play.playType = 'field goal';
          play.yardsGained = 0;
          if (fieldGoal(fieldPosition)) {
            play.result = 'made field goal';
            drive.result = 'made field goal';
            drive.points = 3;
            updateDriveScoreAfter(game, drive, offense);
          } else {
            play.result = 'missed field goal';
            drive.result = 'missed field goal';
          }
          formatPlayText(play, offense, defense, starters);
          plays.push(play);
          return {
            record: drive,
            plays,
            nextFieldPosition: play.result === 'made field goal' ? 20 : 100 - fieldPosition,
          };
        }
        if (decision === 'punt') {
          play.playType = 'punt';
          play.result = 'punt';
          play.yardsGained = 0;
          drive.result = 'punt';
          drive.points = 0;
          formatPlayText(play, offense, defense, starters);
          plays.push(play);
          return {
            record: drive,
            plays,
            nextFieldPosition: 100 - (fieldPosition + 40),
          };
        }
      }

      const playType = Math.random() < 0.5 ? 'run' : 'pass';
      const result = playType === 'run'
        ? simRun(fieldPosition, offense, defense, game)
        : simPass(fieldPosition, offense, defense, game);

      play.playType = playType;
      play.yardsGained = result.yards;
      play.result = result.outcome;
      fieldPosition += result.yards;
      yardsLeft -= result.yards;
      play.yardsLeft = yardsLeft;

      formatPlayText(play, offense, defense, starters);
      plays.push(play);

      if (result.outcome === 'touchdown') {
        drive.result = 'touchdown';
        drive.points = 7;
        updateDriveScoreAfter(game, drive, offense);
        return { record: drive, plays, nextFieldPosition: 20 };
      }
      if (result.outcome === 'interception') {
        drive.result = 'interception';
        return { record: drive, plays, nextFieldPosition: 100 - fieldPosition };
      }
      if (result.outcome === 'fumble') {
        drive.result = 'fumble';
        return { record: drive, plays, nextFieldPosition: 100 - fieldPosition };
      }
      if (fieldPosition < 1) {
        drive.result = 'safety';
        drive.points = 0;
        updateDriveScoreAfter(game, drive, offense);
        return { record: drive, plays, nextFieldPosition: 20 };
      }
      if (down === 4 && yardsLeft > 0) {
        drive.result = 'turnover on downs';
        return { record: drive, plays, nextFieldPosition: 100 - fieldPosition };
      }

      if (yardsLeft <= 0) {
        down = 0;
        yardsLeft = fieldPosition >= 90 ? 100 - fieldPosition : 10;
        break;
      }
    }
  }

  return { record: drive, plays, nextFieldPosition: 20 };
};

const simGame = (
  league: LeagueState,
  game: SimGame,
  starters: StartersCache
) => {
  game.scoreA = 0;
  game.scoreB = 0;
  game.overtime = 0;
  const totalDrives = DRIVES_PER_TEAM * 2;
  const drives: SimDrive[] = [];

  let fieldPosition = 20;
  for (let i = 0; i < totalDrives; i += 1) {
    const isTeamA = i % 2 === 0;
    const offense = isTeamA ? game.teamA : game.teamB;
    const defense = isTeamA ? game.teamB : game.teamA;
    const lead = isTeamA ? game.scoreA - game.scoreB : game.scoreB - game.scoreA;

    if (i === 0 || i === DRIVES_PER_TEAM) {
      fieldPosition = 20;
    }

    const driveResult = simDrive(
      league,
      game,
      fieldPosition,
      lead,
      offense,
      defense,
      i,
      starters
    );
    fieldPosition = driveResult.nextFieldPosition;

    game.scoreA = driveResult.record.scoreAAfter;
    game.scoreB = driveResult.record.scoreBAfter;
    drives.push(driveResult);
  }

  if (game.scoreA === game.scoreB) {
    let driveNum = DRIVES_PER_TEAM * 2 + 1;
    while (game.scoreA === game.scoreB) {
      game.overtime += 1;
      for (let possession = 0; possession < 2; possession += 1) {
        const isTeamA = possession === 0;
        const offense = isTeamA ? game.teamA : game.teamB;
        const defense = isTeamA ? game.teamB : game.teamA;
        const lead = isTeamA ? game.scoreA - game.scoreB : game.scoreB - game.scoreA;
        const driveResult = simDrive(
          league,
          game,
          OT_START_YARD_LINE,
          lead,
          offense,
          defense,
          driveNum,
          starters
        );
        game.scoreA = driveResult.record.scoreAAfter;
        game.scoreB = driveResult.record.scoreBAfter;
        drives.push(driveResult);
        driveNum += 1;
        if (possession === 1 && game.scoreA !== game.scoreB) {
          break;
        }
      }
    }
  }

  if (game.scoreA > game.scoreB) {
    game.winner = game.teamA;
    game.resultA = 'W';
    game.resultB = 'L';
  } else {
    game.winner = game.teamB;
    game.resultA = 'L';
    game.resultB = 'W';
  }

  return drives;
};

const updateTeamRecords = (games: SimGame[]) => {
  const updates = new Map<number, {
    team: Team;
    confWins: number;
    confLosses: number;
    nonConfWins: number;
    nonConfLosses: number;
    totalWins: number;
    totalLosses: number;
    strength: number;
    gamesPlayed: number;
  }>();

  games.forEach(game => {
    const teamA = game.teamA;
    const teamB = game.teamB;
    const isConfGame = isConferenceGame(teamA, teamB);

    const ensure = (team: Team) => {
      if (!updates.has(team.id)) {
        updates.set(team.id, {
          team,
          confWins: 0,
          confLosses: 0,
          nonConfWins: 0,
          nonConfLosses: 0,
          totalWins: 0,
          totalLosses: 0,
          strength: 0,
          gamesPlayed: 0,
        });
      }
      return updates.get(team.id)!;
    };

    const teamAUpdate = ensure(teamA);
    const teamBUpdate = ensure(teamB);
    teamAUpdate.gamesPlayed += 1;
    teamBUpdate.gamesPlayed += 1;

    const winner = game.winner?.id === teamA.id ? teamA : teamB;
    const loser = winner.id === teamA.id ? teamB : teamA;

    const winnerUpdate = ensure(winner);
    const loserUpdate = ensure(loser);

    if (isConfGame) {
      winnerUpdate.confWins += 1;
      loserUpdate.confLosses += 1;
    } else {
      winnerUpdate.nonConfWins += 1;
      loserUpdate.nonConfLosses += 1;
    }

    winnerUpdate.totalWins += 1;
    loserUpdate.totalLosses += 1;

    const winnerResumeAdd = loser.rating ** WIN_FACTOR;
    const loserResumeAdd = winner.rating ** LOSS_FACTOR;
    winnerUpdate.strength += winnerResumeAdd;
    loserUpdate.strength += loserResumeAdd;
  });

  updates.forEach(update => {
    const team = update.team;
    team.confWins += update.confWins;
    team.confLosses += update.confLosses;
    team.nonConfWins += update.nonConfWins;
    team.nonConfLosses += update.nonConfLosses;
    team.totalWins += update.totalWins;
    team.totalLosses += update.totalLosses;
    team.strength_of_record += update.strength;
    team.gamesPlayed += update.gamesPlayed;
    team.record = formatRecord(team);
  });
};

const updateRankings = (info: Info, teams: Team[], weekGames: SimGame[]) => {
  const teamGames = new Map<number, SimGame>();
  weekGames.forEach(game => {
    teamGames.set(game.teamA.id, game);
    teamGames.set(game.teamB.id, game);
  });

  teams.forEach(team => {
    team.last_rank = team.ranking;
    const gamesPlayed = team.totalWins + team.totalLosses;
    const baseScore = team.strength_of_record / Math.max(1, gamesPlayed);
    if (info.currentWeek === info.lastWeek) {
      team.poll_score = Math.round(baseScore * 10) / 10;
    } else {
      const weeksLeft = Math.max(0, RANKING_TOTAL_WEEKS - info.currentWeek);
      const inertiaScale = weeksLeft / RANKING_TOTAL_WEEKS;
      const teamGame = teamGames.get(team.id);
      const inertiaFactor = teamGame && teamGame.winner?.id === team.id
        ? POLL_INERTIA_WIN_BONUS
        : POLL_INERTIA_LOSS_PENALTY;
      const inertiaValue = Math.max(0, inertiaFactor * (teams.length - team.ranking) * inertiaScale);
      team.poll_score = Math.round((baseScore + inertiaValue) * 10) / 10;
    }
  });

  const sorted = [...teams].sort((a, b) => {
    if (b.poll_score !== a.poll_score) return b.poll_score - a.poll_score;
    return (a.last_rank ?? a.ranking) - (b.last_rank ?? b.ranking);
  });
  sorted.forEach((team, index) => {
    team.ranking = index + 1;
  });
};

const buildWatchability = (game: GameRecord, numTeams: number) => {
  const rankingWeight = 0.9;
  const combinedRanking = (game.rankATOG + game.rankBTOG) / 2;
  const rankingScore = Math.max(0, numTeams - combinedRanking);
  const competitiveness = 1 - Math.abs(game.winProbA - game.winProbB);
  const maxRankingScore = numTeams - 1.5;
  const maxPossible = rankingWeight * maxRankingScore + (1 - rankingWeight) * numTeams;
  const watchability = (rankingWeight * rankingScore + (1 - rankingWeight) * competitiveness * numTeams);
  return Math.round((watchability / maxPossible) * 1000) / 10;
};

const buildBaseLabel = (team: Team, opponent: Team, name?: string | null) => {
  if (name) return name;
  const teamConf = team.conference;
  const oppConf = opponent.conference;
  if (teamConf && oppConf && teamConf === oppConf) {
    return `Conference: ${teamConf}`;
  }
  const teamLabel = teamConf || 'Independent';
  const oppLabel = oppConf || 'Independent';
  return `Non-Conference: ${teamLabel} vs ${oppLabel}`;
};

const isConferenceGame = (teamA: Team, teamB: Team) =>
  teamA.conference !== 'Independent' && teamA.conference === teamB.conference;

const hydrateGame = (game: GameRecord, teamsById: Map<number, Team>): SimGame => ({
  id: game.id,
  teamA: teamsById.get(game.teamAId)!,
  teamB: teamsById.get(game.teamBId)!,
  homeTeam: game.homeTeamId ? teamsById.get(game.homeTeamId)! : null,
  awayTeam: game.awayTeamId ? teamsById.get(game.awayTeamId)! : null,
  neutralSite: game.neutralSite,
  winner: game.winnerId ? teamsById.get(game.winnerId)! : null,
  baseLabel: game.baseLabel,
  name: game.name,
  spreadA: game.spreadA,
  spreadB: game.spreadB,
  moneylineA: game.moneylineA,
  moneylineB: game.moneylineB,
  winProbA: game.winProbA,
  winProbB: game.winProbB,
  weekPlayed: game.weekPlayed,
  year: game.year,
  rankATOG: game.rankATOG,
  rankBTOG: game.rankBTOG,
  resultA: game.resultA,
  resultB: game.resultB,
  overtime: game.overtime,
  scoreA: game.scoreA ?? 0,
  scoreB: game.scoreB ?? 0,
  headline: game.headline,
  watchability: game.watchability,
});

const createGameLogsFromPlays = (
  league: LeagueState,
  game: SimGame,
  plays: PlayRecord[],
  starters: StartersCache
) => {
  const logs: GameLogRecord[] = [];
  const logByPlayerId = new Map<number, GameLogRecord>();
  const desiredPositions = ['qb', 'rb', 'wr', 'te', 'k', 'dl', 'lb', 'cb', 's'];

  const seedLogs = (team: Team) => {
    desiredPositions.forEach(pos => {
      const startersForPos = starters.byTeamPos.get(`${team.id}:${pos}`) ?? [];
      startersForPos.forEach(player => {
        if (logByPlayerId.has(player.id)) return;
        const log: GameLogRecord = {
          id: nextId(league, 'gameLog'),
          playerId: player.id,
          gameId: game.id,
          pass_yards: 0,
          pass_attempts: 0,
          pass_completions: 0,
          pass_touchdowns: 0,
          pass_interceptions: 0,
          rush_yards: 0,
          rush_attempts: 0,
          rush_touchdowns: 0,
          receiving_yards: 0,
          receiving_catches: 0,
          receiving_touchdowns: 0,
          fumbles: 0,
          tackles: 0,
          sacks: 0,
          interceptions: 0,
          fumbles_forced: 0,
          fumbles_recovered: 0,
          field_goals_made: 0,
          field_goals_attempted: 0,
          extra_points_made: 0,
          extra_points_attempted: 0,
        };
        logs.push(log);
        logByPlayerId.set(player.id, log);
      });
    });
  };

  seedLogs(game.teamA);
  seedLogs(game.teamB);

  const defendersByTeam = (team: Team) => {
    const defenders: PlayerRecord[] = [];
    ['dl', 'lb', 'cb', 's'].forEach(pos => {
      defenders.push(...(starters.byTeamPos.get(`${team.id}:${pos}`) ?? []));
    });
    return defenders;
  };

  const defenderCache = new Map<number, PlayerRecord[]>();
  defenderCache.set(game.teamA.id, defendersByTeam(game.teamA));
  defenderCache.set(game.teamB.id, defendersByTeam(game.teamB));

  const chooseWeighted = (players: PlayerRecord[], bias: Record<string, number>) => {
    if (!players.length) return null;
    const weighted = players.map(player => ({
      item: player,
      weight: (Math.max(player.rating, 0) + 5) * (bias[player.pos.toLowerCase()] ?? 1),
    }));
    return weightedChoice(weighted);
  };

  plays.forEach(play => {
    const offense = play.offenseId === game.teamA.id ? game.teamA : game.teamB;
    const defense = play.defenseId === game.teamA.id ? game.teamA : game.teamB;
    const rb = starters.byTeamPos.get(`${offense.id}:rb`) ?? [];
    const qb = starters.byTeamPos.get(`${offense.id}:qb`) ?? [];
    const wr = starters.byTeamPos.get(`${offense.id}:wr`) ?? [];
    const te = starters.byTeamPos.get(`${offense.id}:te`) ?? [];
    const k = starters.byTeamPos.get(`${offense.id}:k`) ?? [];
    const defenders = defenderCache.get(defense.id) ?? [];

    if (play.playType === 'run') {
      const runner = chooseWeighted(rb, { rb: 1.2 });
      if (runner) {
        const log = logByPlayerId.get(runner.id);
        if (log) {
          log.rush_attempts += 1;
          log.rush_yards += play.yardsGained;
          if (play.result === 'touchdown') log.rush_touchdowns += 1;
          if (play.result === 'fumble') log.fumbles += 1;
        }
      }
      const tackler = chooseWeighted(defenders, { dl: 1.2, lb: 1.1, cb: 0.8, s: 0.9 });
      if (tackler) {
        const log = logByPlayerId.get(tackler.id);
        if (log) log.tackles += 1;
      }
    } else if (play.playType === 'pass') {
      const qbPlayer = qb[0];
      if (qbPlayer) {
        const qbLog = logByPlayerId.get(qbPlayer.id);
        if (qbLog) qbLog.pass_attempts += 1;
      }
      if (play.result === 'sack') {
        const sackDef = chooseWeighted(defenders, { dl: 1.4, lb: 1.1 });
        if (sackDef) {
          const log = logByPlayerId.get(sackDef.id);
          if (log) log.sacks += 1;
        }
      } else if (play.result === 'interception') {
        if (qbPlayer) {
          const qbLog = logByPlayerId.get(qbPlayer.id);
          if (qbLog) qbLog.pass_interceptions += 1;
        }
        const interceptor = chooseWeighted(defenders, { cb: 1.3, s: 1.3, lb: 0.8 });
        if (interceptor) {
          const log = logByPlayerId.get(interceptor.id);
          if (log) log.interceptions += 1;
        }
      } else if (play.result === 'pass' || play.result === 'touchdown') {
        const receiver = chooseReceiver([...wr, ...te, ...rb]);
        if (qbPlayer) {
          const qbLog = logByPlayerId.get(qbPlayer.id);
          if (qbLog) {
            qbLog.pass_completions += 1;
            qbLog.pass_yards += play.yardsGained;
            if (play.result === 'touchdown') qbLog.pass_touchdowns += 1;
          }
        }
        if (receiver) {
          const recLog = logByPlayerId.get(receiver.id);
          if (recLog) {
            recLog.receiving_catches += 1;
            recLog.receiving_yards += play.yardsGained;
            if (play.result === 'touchdown') recLog.receiving_touchdowns += 1;
          }
        }
      }
    } else if (play.playType === 'field goal') {
      const kicker = chooseWeighted(k, { k: 1.2 });
      if (kicker) {
        const log = logByPlayerId.get(kicker.id);
        if (log) {
          log.field_goals_attempted += 1;
          if (play.result === 'made field goal') log.field_goals_made += 1;
        }
      }
    }
  });

  return logs;
};

const getBestPerformance = (
  logs: GameLogRecord[],
  playersById: Map<number, PlayerRecord>,
  winningTeamId: number
) => {
  let best: { first: string; last: string; stat_value: number; stat_type: string } | null = null;
  let bestScore = 0;

  logs.forEach(log => {
    const player = playersById.get(log.playerId);
    if (!player || player.teamId !== winningTeamId) return;

    if (player.pos === 'qb' && log.pass_attempts > 0) {
      const score = log.pass_yards + log.pass_touchdowns * 50 - log.pass_interceptions * 25;
      if (score > bestScore && log.pass_yards >= 200) {
        bestScore = score;
        best = { first: player.first, last: player.last, stat_value: log.pass_yards, stat_type: 'passing yards' };
      }
      if (log.pass_touchdowns >= 3) {
        const tdScore = log.pass_touchdowns * 100;
        if (tdScore > bestScore) {
          bestScore = tdScore;
          best = { first: player.first, last: player.last, stat_value: log.pass_touchdowns, stat_type: 'passing touchdowns' };
        }
      }
    }

    if (['rb', 'qb'].includes(player.pos) && log.rush_attempts > 0) {
      const score = log.rush_yards + log.rush_touchdowns * 60;
      if (score > bestScore && log.rush_yards >= 100) {
        bestScore = score;
        best = { first: player.first, last: player.last, stat_value: log.rush_yards, stat_type: 'rushing yards' };
      }
      if (log.rush_touchdowns >= 2) {
        const tdScore = log.rush_touchdowns * 80;
        if (tdScore > bestScore) {
          bestScore = tdScore;
          best = { first: player.first, last: player.last, stat_value: log.rush_touchdowns, stat_type: 'rushing touchdowns' };
        }
      }
    }

    if (['wr', 'te', 'rb'].includes(player.pos) && log.receiving_catches > 0) {
      const score = log.receiving_yards + log.receiving_touchdowns * 60;
      if (score > bestScore && log.receiving_yards >= 100) {
        bestScore = score;
        best = { first: player.first, last: player.last, stat_value: log.receiving_yards, stat_type: 'receiving yards' };
      }
      if (log.receiving_touchdowns >= 2) {
        const tdScore = log.receiving_touchdowns * 80;
        if (tdScore > bestScore) {
          bestScore = tdScore;
          best = { first: player.first, last: player.last, stat_value: log.receiving_touchdowns, stat_type: 'receiving touchdowns' };
        }
      }
    }
  });

  return best;
};

const generateHeadlines = async (
  games: SimGame[],
  gameLogsByGameId: Map<number, GameLogRecord[]>,
  playersById: Map<number, PlayerRecord>
) => {
  const headlinesData = await getHeadlinesData();
  games.forEach(game => {
    const winner = game.winner?.id === game.teamA.id ? game.teamA : game.teamB;
    const loser = winner.id === game.teamA.id ? game.teamB : game.teamA;
    const winnerScore = winner.id === game.teamA.id ? game.scoreA : game.scoreB;
    const loserScore = winner.id === game.teamA.id ? game.scoreB : game.scoreA;
    const winProb = winner.id === game.teamA.id ? game.winProbA : game.winProbB;
    const score = `${winnerScore}-${loserScore}`;

    let headlineTemplate = '';
    if (game.overtime > 0) {
      headlineTemplate = headlinesData.overtime[Math.floor(Math.random() * headlinesData.overtime.length)];
    } else if (winProb < 0.1) {
      headlineTemplate = headlinesData.upset[Math.floor(Math.random() * headlinesData.upset.length)];
      const spread = winner.id === game.teamA.id ? game.spreadB : game.spreadA;
      headlineTemplate = headlineTemplate.replace('<spread>', spread);
    } else if (winnerScore > loserScore + 20) {
      headlineTemplate = headlinesData.blowout[Math.floor(Math.random() * headlinesData.blowout.length)];
    } else if (winnerScore < loserScore + 10) {
      headlineTemplate = headlinesData.close[Math.floor(Math.random() * headlinesData.close.length)];
    } else {
      const logs = gameLogsByGameId.get(game.id);
      const performance = logs ? getBestPerformance(logs, playersById, winner.id) : null;
      if (performance && headlinesData.individual?.length) {
        headlineTemplate = headlinesData.individual[Math.floor(Math.random() * headlinesData.individual.length)];
        headlineTemplate = headlineTemplate
          .replace('<player>', `${performance.first} ${performance.last}`)
          .replace('<stat_value>', `${performance.stat_value}`)
          .replace('<stat_type>', performance.stat_type);
      } else {
        headlineTemplate = headlinesData.close[Math.floor(Math.random() * headlinesData.close.length)];
      }
    }

    const headline = headlineTemplate
      .replace('<winner>', winner.name)
      .replace('<loser>', loser.name)
      .replace('<score>', score)
      .replace('<mascot>', winner.mascot);
    game.headline = headline;
  });
};

const updateUserScheduleFromGame = (schedule: ScheduleGame[], game: SimGame, userTeam: Team) => {
  if (game.weekPlayed <= 0 || game.weekPlayed > schedule.length) return;
  if (game.teamA.id !== userTeam.id && game.teamB.id !== userTeam.id) return;

  const slot = schedule[game.weekPlayed - 1];
  if (!slot) return;

  const isTeamA = game.teamA.id === userTeam.id;
  const userScore = isTeamA ? game.scoreA : game.scoreB;
  const oppScore = isTeamA ? game.scoreB : game.scoreA;
  slot.score = `${userScore}-${oppScore}`;
  slot.result = isTeamA ? (game.resultA ?? '') : (game.resultB ?? '');
  slot.spread = isTeamA ? game.spreadA : game.spreadB;
  slot.moneyline = isTeamA ? game.moneylineA : game.moneylineB;
};

const updateUserSchedulePreviewFromRecord = (
  schedule: ScheduleGame[],
  game: GameRecord,
  userTeam: Team
) => {
  if (game.weekPlayed <= 0 || game.weekPlayed > schedule.length) return;
  if (game.teamAId !== userTeam.id && game.teamBId !== userTeam.id) return;
  const slot = schedule[game.weekPlayed - 1];
  if (!slot) return;
  const isTeamA = game.teamAId === userTeam.id;
  slot.spread = isTeamA ? game.spreadA : game.spreadB;
  slot.moneyline = isTeamA ? game.moneylineA : game.moneylineB;
};

const buildStartersCache = async (teams: Team[]) => {
  const byTeamPos = new Map<string, PlayerRecord[]>();
  for (const team of teams) {
    const players = await getPlayersByTeam(team.id);
    players.filter(player => player.active && player.starter).forEach(player => {
      const key = `${team.id}:${player.pos}`;
      const list = byTeamPos.get(key) ?? [];
      list.push(player);
      byTeamPos.set(key, list);
    });
  }
  return { byTeamPos };
};

const loadPlayersMap = async (teams: Team[]) => {
  const map = new Map<number, PlayerRecord>();
  for (const team of teams) {
    const players = await getPlayersByTeam(team.id);
    players.forEach(player => map.set(player.id, player));
  }
  return map;
};


export const initializeSimData = async (league: LeagueState, fullGames: FullGame[]) => {
  const counters = normalizeCounters(league);
  await ensureRosters(league);
  await clearSimArtifacts();

  const oddsData = await getBettingOddsData();
  const oddsMap = oddsData.odds ?? {};
  const maxDiff = oddsData.max_diff ?? 100;

  const gameRecords: GameRecord[] = [];
  fullGames.forEach(game => {
    const homeTeam = game.homeTeam;
    const awayTeam = game.awayTeam;
    let ratingA = game.teamA.rating;
    let ratingB = game.teamB.rating;
    if (homeTeam) {
      if (homeTeam.id === game.teamA.id) ratingA += HOME_FIELD_ADVANTAGE;
      if (homeTeam.id === game.teamB.id) ratingB += HOME_FIELD_ADVANTAGE;
    }
    const diff = Math.min(maxDiff, Math.abs(Math.round(ratingA - ratingB)));
    const odds = oddsMap[String(diff)] ?? oddsMap[String(maxDiff)] ?? {
      favSpread: '-1.5',
      udSpread: '+1.5',
      favWinProb: 0.6,
      udWinProb: 0.4,
      favMoneyline: '-120',
      udMoneyline: '+120',
    };
    const isTeamAFav = ratingA >= ratingB;
    const record: GameRecord = {
      id: counters.game,
      teamAId: game.teamA.id,
      teamBId: game.teamB.id,
      homeTeamId: homeTeam?.id ?? null,
      awayTeamId: awayTeam?.id ?? null,
      neutralSite: false,
      winnerId: null,
      baseLabel: buildBaseLabel(game.teamA, game.teamB, game.name),
      name: game.name ?? null,
      spreadA: isTeamAFav ? odds.favSpread : odds.udSpread,
      spreadB: isTeamAFav ? odds.udSpread : odds.favSpread,
      moneylineA: isTeamAFav ? odds.favMoneyline : odds.udMoneyline,
      moneylineB: isTeamAFav ? odds.udMoneyline : odds.favMoneyline,
      winProbA: isTeamAFav ? odds.favWinProb : odds.udWinProb,
      winProbB: isTeamAFav ? odds.udWinProb : odds.favWinProb,
      weekPlayed: game.weekPlayed,
      year: league.info.currentYear,
      rankATOG: game.teamA.ranking,
      rankBTOG: game.teamB.ranking,
      resultA: null,
      resultB: null,
      overtime: 0,
      scoreA: null,
      scoreB: null,
      headline: null,
      watchability: null,
    };
    record.watchability = buildWatchability(record, league.teams.length);
    gameRecords.push(record);
    counters.game += 1;
  });

  const userTeam = league.teams.find(team => team.name === league.info.team);
  if (userTeam) {
    gameRecords.forEach(game => updateUserSchedulePreviewFromRecord(league.schedule, game, userTeam));
  }

  await saveGames(gameRecords);

  league.simInitialized = true;
  await saveLeague(league);
};

export const getGamesToLiveSim = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) throw new Error('No league found. Start a new game.');
  const games = await getGamesByWeek(league.info.currentWeek);
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const unplayed = games.filter(game => !game.winnerId);
  unplayed.sort((a, b) => (b.watchability ?? 0) - (a.watchability ?? 0));

  const userTeam = league.teams.find(team => team.name === league.info.team);
  const userGames: typeof unplayed = [];
  const otherGames: typeof unplayed = [];
  unplayed.forEach(game => {
    if (userTeam && (game.teamAId === userTeam.id || game.teamBId === userTeam.id)) {
      userGames.push(game);
    } else {
      otherGames.push(game);
    }
  });

  const gamesData = [...userGames, ...otherGames].map(game => {
    const teamA = teamsById.get(game.teamAId)!;
    const teamB = teamsById.get(game.teamBId)!;
    return {
      id: game.id,
      teamA: { name: teamA.name, ranking: game.rankATOG, record: teamA.record },
      teamB: { name: teamB.name, ranking: game.rankBTOG, record: teamB.record },
      label: game.baseLabel,
      watchability: game.watchability ?? 0,
      is_user_game: userTeam ? (game.teamAId === userTeam.id || game.teamBId === userTeam.id) : false,
    };
  });

  return { games: gamesData, week: league.info.currentWeek };
};

export const liveSimGame = async (gameId: number) => {
  const league = await loadLeague<LeagueState>();
  if (!league) throw new Error('No league found. Start a new game.');
  const record = await getGameById(gameId);
  if (!record) throw new Error('Game not found.');

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const userTeam = league.teams.find(team => team.name === league.info.team);

  if (record.winnerId) {
    const drives = await getDrivesByGame(gameId);
    const plays = await getPlaysByGame(gameId);
    return {
      drives: buildDriveResponse(drives, plays, teamsById),
      game: buildGameData(record, teamsById),
      is_user_game: userTeam ? (record.teamAId === userTeam.id || record.teamBId === userTeam.id) : false,
    };
  }

  const preRecordA = teamsById.get(record.teamAId)?.record ?? '';
  const preRecordB = teamsById.get(record.teamBId)?.record ?? '';

  const starters = await buildStartersCache(league.teams);
  const playersById = await loadPlayersMap(league.teams);
  const simGameObj = hydrateGame(record, teamsById);
  const simDrives = simGame(league, simGameObj, starters);
  const driveRecords = simDrives.map(drive => drive.record);
  const playRecords = simDrives.flatMap(drive => drive.plays);
  const logs = createGameLogsFromPlays(league, simGameObj, playRecords, starters);

  const updatedRecord: GameRecord = {
    ...record,
    scoreA: simGameObj.scoreA,
    scoreB: simGameObj.scoreB,
    winnerId: simGameObj.winner?.id ?? null,
    resultA: simGameObj.resultA,
    resultB: simGameObj.resultB,
    overtime: simGameObj.overtime,
    headline: simGameObj.headline ?? null,
  };

  updateTeamRecords([simGameObj]);
  await generateHeadlines([simGameObj], new Map([[simGameObj.id, logs]]), playersById);

  updatedRecord.headline = simGameObj.headline;
  await saveGames([updatedRecord]);
  await saveDrives(driveRecords);
  await savePlays(playRecords);
  await saveGameLogs(logs);

  if (userTeam) updateUserScheduleFromGame(league.schedule, simGameObj, userTeam);
  league.teams.forEach(team => (team.record = formatRecord(team)));
  await saveLeague(league);

  const gameData = buildGameData(updatedRecord, teamsById);
  gameData.teamA.record = preRecordA;
  gameData.teamB.record = preRecordB;

  return {
    drives: buildDriveResponse(driveRecords, playRecords, teamsById),
    game: gameData,
    is_user_game: userTeam ? (record.teamAId === userTeam.id || record.teamBId === userTeam.id) : false,
  };
};

export const advanceWeeks = async (destWeek: number) => {
  const league = await loadLeague<LeagueState>();
  if (!league) throw new Error('No league found. Start a new game.');
  if (!league.scheduleBuilt) throw new Error('Schedule not built yet.');
  if (!league.simInitialized) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const fullGames = fillUserSchedule(league.schedule, userTeam, league.teams);
    await initializeSimData(league, fullGames);
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const starters = await buildStartersCache(league.teams);
  const playersById = await loadPlayersMap(league.teams);
  const userTeam = league.teams.find(team => team.name === league.info.team);

  const drivesToSave: DriveRecord[] = [];
  const playsToSave: PlayRecord[] = [];
  const logsToSave: GameLogRecord[] = [];

  while (league.info.currentWeek < destWeek) {
    const weekGames = await getGamesByWeek(league.info.currentWeek);
    const unplayed = weekGames.filter(game => !game.winnerId);
    const simGames: SimGame[] = [];
    const gameLogsByGame = new Map<number, GameLogRecord[]>();

    unplayed.forEach(gameRecord => {
      const simGameObj = hydrateGame(gameRecord, teamsById);
      const simDrives = simGame(league, simGameObj, starters);
      simGames.push(simGameObj);

      const driveRecords = simDrives.map(drive => drive.record);
      const playRecords = simDrives.flatMap(drive => drive.plays);
      const logs = createGameLogsFromPlays(league, simGameObj, playRecords, starters);

      drivesToSave.push(...driveRecords);
      playsToSave.push(...playRecords);
      logsToSave.push(...logs);
      gameLogsByGame.set(simGameObj.id, logs);

      gameRecord.scoreA = simGameObj.scoreA;
      gameRecord.scoreB = simGameObj.scoreB;
      gameRecord.winnerId = simGameObj.winner?.id ?? null;
      gameRecord.resultA = simGameObj.resultA;
      gameRecord.resultB = simGameObj.resultB;
      gameRecord.overtime = simGameObj.overtime;
    });

    if (simGames.length) {
      updateTeamRecords(simGames);
      await generateHeadlines(simGames, gameLogsByGame, playersById);
      simGames.forEach(simGameObj => {
        const gameRecord = unplayed.find(game => game.id === simGameObj.id);
        if (gameRecord) gameRecord.headline = simGameObj.headline;
      });
      if (userTeam) {
        simGames.forEach(game => updateUserScheduleFromGame(league.schedule, game, userTeam));
      }
      updateRankings(league.info, league.teams, simGames);

      const futureGames = await getAllGames();
      const updatedById = new Map(unplayed.map(game => [game.id, game]));
      futureGames.forEach(game => {
        const updated = updatedById.get(game.id);
        if (updated) {
          Object.assign(game, updated);
        }
        if (game.winnerId) return;
        const teamA = teamsById.get(game.teamAId);
        const teamB = teamsById.get(game.teamBId);
        if (!teamA || !teamB) return;
        game.rankATOG = teamA.ranking;
        game.rankBTOG = teamB.ranking;
      });

      await saveGames(futureGames);
    }

    league.info.currentWeek += 1;
  }

  await saveDrives(drivesToSave);
  await savePlays(playsToSave);
  await saveGameLogs(logsToSave);
  await saveLeague(league);
};

const buildDriveResponse = (
  drives: DriveRecord[],
  plays: PlayRecord[],
  teamsById: Map<number, Team>
): Drive[] => {
  const playsByDrive = new Map<number, PlayRecord[]>();
  plays.forEach(play => {
    const list = playsByDrive.get(play.driveId) ?? [];
    list.push(play);
    playsByDrive.set(play.driveId, list);
  });

  return drives
    .sort((a, b) => a.driveNum - b.driveNum)
    .map(drive => {
      const offense = teamsById.get(drive.offenseId);
      const defense = teamsById.get(drive.defenseId);
      const drivePlays = (playsByDrive.get(drive.id) ?? [])
        .sort((a, b) => a.id - b.id)
        .map(play => ({
        id: play.id,
        down: play.down,
        yardsLeft: play.yardsLeft,
        startingFP: play.startingFP,
        playType: play.playType,
        yardsGained: play.yardsGained,
        text: play.text,
        header: play.header,
        result: play.result,
        scoreA: play.scoreA,
        scoreB: play.scoreB,
      }));
      const yards = drivePlays.reduce((sum, play) => sum + play.yardsGained, 0);
      return {
        driveNum: drive.driveNum,
        offense: offense?.name ?? '',
        defense: defense?.name ?? '',
        startingFP: drive.startingFP,
        result: drive.result,
        points: drive.points,
        scoreAAfter: drive.scoreAAfter,
        scoreBAfter: drive.scoreBAfter,
        plays: drivePlays,
        yards,
      };
    });
};

const buildGameData = (game: GameRecord, teamsById: Map<number, Team>): GameData => {
  const teamA = teamsById.get(game.teamAId)!;
  const teamB = teamsById.get(game.teamBId)!;
  return {
    id: game.id,
    base_label: game.baseLabel,
    headline: game.headline,
    teamA: { id: teamA.id, name: teamA.name, record: teamA.record },
    teamB: { id: teamB.id, name: teamB.name, record: teamB.record },
    scoreA: game.scoreA ?? 0,
    scoreB: game.scoreB ?? 0,
  };
};
