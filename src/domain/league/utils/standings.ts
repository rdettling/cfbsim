import type { GameRecord } from '../../../types/db';
import type {
  Conference,
  ConferenceFinalStandings,
  ConferenceTiebreaker,
  Team,
} from '../../../types/domain';

type StandingRecord = { wins: number; losses: number };

export type ConferenceStanding = {
  team: Team;
  conferenceWins: number;
  conferenceLosses: number;
  overallWins: number;
  overallLosses: number;
  pollRank: number;
  resolvedBy: ConferenceTiebreaker | null;
};

export type ConferenceChampionResolution = {
  team: Team;
  status: 'projected' | 'actual';
};

type StandingCriterion = {
  name: ConferenceTiebreaker;
  direction: 'asc' | 'desc';
  values: (group: ConferenceStanding[]) => Map<number, number> | null;
};

const percentage = ({ wins, losses }: StandingRecord) => {
  const games = wins + losses;
  return games ? wins / games : 0;
};

const completedRegularSeasonGames = (games: GameRecord[], year: number) =>
  games.filter(game =>
    game.year === year &&
    game.gameType === 'regular_season' &&
    game.winnerId !== null,
  );

const groupByValue = (
  rows: ConferenceStanding[],
  values: Map<number, number>,
  direction: StandingCriterion['direction'],
) => {
  const ordered = rows.slice().sort((left, right) => {
    const leftValue = values.get(left.team.id) ?? 0;
    const rightValue = values.get(right.team.id) ?? 0;
    return direction === 'desc' ? rightValue - leftValue : leftValue - rightValue;
  });
  const groups: ConferenceStanding[][] = [];
  ordered.forEach(row => {
    const previous = groups[groups.length - 1];
    if (previous && values.get(previous[0].team.id) === values.get(row.team.id)) {
      previous.push(row);
    } else {
      groups.push([row]);
    }
  });
  return groups;
};

const refineTiedGroup = (
  group: ConferenceStanding[],
  criteria: StandingCriterion[],
  criterionIndex = 0,
): ConferenceStanding[] => {
  if (group.length <= 1) return group;
  const criterion = criteria[criterionIndex];
  if (!criterion) return group.slice().sort((left, right) => left.team.id - right.team.id);
  const values = criterion.values(group);
  if (!values) return refineTiedGroup(group, criteria, criterionIndex + 1);
  const partitions = groupByValue(group, values, criterion.direction);
  if (partitions.length === 1) {
    return refineTiedGroup(group, criteria, criterionIndex + 1);
  }
  return partitions.flatMap(partition => {
    partition.forEach(row => {
      row.resolvedBy = criterion.name;
    });
    return refineTiedGroup(partition, criteria, criterionIndex + 1);
  });
};

export const buildConferenceStandings = ({
  teams,
  games,
  year,
  finalStandings = null,
}: {
  teams: Team[];
  games: GameRecord[];
  year: number;
  finalStandings?: ConferenceFinalStandings | null;
}): ConferenceStanding[] => {
  const regularGames = completedRegularSeasonGames(games, year);
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const conferenceGames = regularGames.filter(game => {
    const teamA = teamsById.get(game.teamAId);
    const teamB = teamsById.get(game.teamBId);
    return Boolean(
      teamA && teamB &&
      teamA.conference !== 'Independent' &&
      teamA.conference === teamB.conference,
    );
  });
  const rowsById = new Map(teams.map(team => [team.id, {
    team,
    conferenceWins: 0,
    conferenceLosses: 0,
    overallWins: 0,
    overallLosses: 0,
    pollRank: team.ranking,
    resolvedBy: null as ConferenceTiebreaker | null,
  } satisfies ConferenceStanding]));

  regularGames.forEach(game => {
    const teamA = rowsById.get(game.teamAId);
    const teamB = rowsById.get(game.teamBId);
    if (teamA) {
      if (game.winnerId === game.teamAId) teamA.overallWins += 1;
      else teamA.overallLosses += 1;
    }
    if (teamB) {
      if (game.winnerId === game.teamBId) teamB.overallWins += 1;
      else teamB.overallLosses += 1;
    }
  });
  conferenceGames.forEach(game => {
    const teamA = rowsById.get(game.teamAId)!;
    const teamB = rowsById.get(game.teamBId)!;
    if (game.winnerId === game.teamAId) {
      teamA.conferenceWins += 1;
      teamB.conferenceLosses += 1;
    } else {
      teamB.conferenceWins += 1;
      teamA.conferenceLosses += 1;
    }
  });

  if (finalStandings) {
    return finalStandings.entries.map(entry => {
      const row = rowsById.get(entry.teamId);
      if (!row) throw new Error(`Final conference standings reference unknown team ${entry.teamId}.`);
      row.pollRank = entry.pollRank;
      row.resolvedBy = entry.resolvedBy;
      return row;
    });
  }

  const rows = [...rowsById.values()];
  const gameByPair = new Map<string, GameRecord>();
  conferenceGames.forEach(game => {
    const key = [game.teamAId, game.teamBId].sort((a, b) => a - b).join(':');
    gameByPair.set(key, game);
  });
  const conferenceOpponents = new Map<number, Set<number>>(
    teams.map(team => [team.id, new Set<number>()]),
  );
  conferenceGames.forEach(game => {
    conferenceOpponents.get(game.teamAId)?.add(game.teamBId);
    conferenceOpponents.get(game.teamBId)?.add(game.teamAId);
  });

  const criteria: StandingCriterion[] = [
    {
      name: 'head_to_head',
      direction: 'desc',
      values: group => {
        for (let left = 0; left < group.length; left += 1) {
          for (let right = left + 1; right < group.length; right += 1) {
            const key = [group[left].team.id, group[right].team.id]
              .sort((a, b) => a - b)
              .join(':');
            if (!gameByPair.has(key)) return null;
          }
        }
        const records = new Map(group.map(row => [row.team.id, { wins: 0, losses: 0 }]));
        const groupIds = new Set(records.keys());
        conferenceGames.forEach(game => {
          if (!groupIds.has(game.teamAId) || !groupIds.has(game.teamBId)) return;
          records.get(game.winnerId!)!.wins += 1;
          const loserId = game.winnerId === game.teamAId ? game.teamBId : game.teamAId;
          records.get(loserId)!.losses += 1;
        });
        return new Map([...records].map(([teamId, record]) => [teamId, percentage(record)]));
      },
    },
    {
      name: 'common_opponents',
      direction: 'desc',
      values: group => {
        const groupIds = new Set(group.map(row => row.team.id));
        const opponentSets = group.map(row => new Set(
          [...(conferenceOpponents.get(row.team.id) ?? [])]
            .filter(opponentId => !groupIds.has(opponentId)),
        ));
        const common = opponentSets[0]
          ? [...opponentSets[0]].filter(opponentId =>
            opponentSets.every(opponents => opponents.has(opponentId)))
          : [];
        if (!common.length) return null;
        const commonIds = new Set(common);
        return new Map(group.map(row => {
          const record = { wins: 0, losses: 0 };
          conferenceGames.forEach(game => {
            const isTeamA = game.teamAId === row.team.id && commonIds.has(game.teamBId);
            const isTeamB = game.teamBId === row.team.id && commonIds.has(game.teamAId);
            if (!isTeamA && !isTeamB) return;
            if (game.winnerId === row.team.id) record.wins += 1;
            else record.losses += 1;
          });
          return [row.team.id, percentage(record)];
        }));
      },
    },
    {
      name: 'overall_record',
      direction: 'desc',
      values: group => new Map(group.map(row => [
        row.team.id,
        percentage({ wins: row.overallWins, losses: row.overallLosses }),
      ])),
    },
    {
      name: 'poll_rank',
      direction: 'asc',
      values: group => new Map(group.map(row => [row.team.id, row.pollRank])),
    },
  ];
  const conferencePctValues = new Map(rows.map(row => [
    row.team.id,
    percentage({ wins: row.conferenceWins, losses: row.conferenceLosses }),
  ]));
  return groupByValue(rows, conferencePctValues, 'desc')
    .flatMap(group => refineTiedGroup(group, criteria));
};

export const freezeConferenceStandings = (
  year: number,
  standings: ConferenceStanding[],
): ConferenceFinalStandings => ({
  year,
  entries: standings.map(row => ({
    teamId: row.team.id,
    pollRank: row.pollRank,
    resolvedBy: row.resolvedBy,
  })),
});

export const resolveConferenceChampion = ({
  conference,
  standings,
  games,
}: {
  conference: Conference;
  standings: ConferenceStanding[];
  games: GameRecord[];
}): ConferenceChampionResolution | null => {
  if (conference.confName === 'Independent') return null;
  if (conference.championship === null) {
    const leader = standings[0]?.team;
    return leader ? { team: leader, status: 'projected' } : null;
  }
  const game = games.find(candidate => candidate.id === conference.championship);
  if (!game) throw new Error(`${conference.confName} championship game is unavailable.`);
  const firstSeed = standings[0]?.team;
  const secondSeed = standings[1]?.team;
  if (
    !conference.finalStandings ||
    game.year !== conference.finalStandings.year ||
    game.gameType !== 'conference_championship' ||
    !firstSeed ||
    !secondSeed ||
    game.teamAId !== firstSeed.id ||
    game.teamBId !== secondSeed.id
  ) {
    throw new Error(`${conference.confName} championship game is invalid.`);
  }
  const teamId = game.winnerId ?? game.teamAId;
  const team = standings.find(row => row.team.id === teamId)?.team;
  if (!team) throw new Error(`${conference.confName} championship references an unknown team.`);
  return { team, status: game.winnerId === null ? 'projected' : 'actual' };
};
