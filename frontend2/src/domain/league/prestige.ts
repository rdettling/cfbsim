import type { LeagueState } from '../../types/league';
import type { Team } from '../../types/domain';
import type { HistoryData, PrestigeConfig, TeamsData } from '../../types/baseData';

type AvgRanks = Record<string, { before: number | null; after: number | null }>;

const calculateTierCounts = (prestigeConfig: PrestigeConfig, totalTeams: number) =>
  Object.fromEntries(
    Object.entries(prestigeConfig).map(([tier, percentage]) => [
      Number(tier),
      Math.floor((percentage / 100) * totalTeams),
    ])
  );

const assignPrestigeTiers = (
  sortedTeams: Array<{ team: Team; avg_rank: number | null }>,
  teamsData: TeamsData,
  tierCounts: Record<number, number>
) => {
  const result: Array<{ team: Team; prestige: number }> = [];
  const teamsInTiers: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  let currentTier = 7;

  for (const entry of sortedTeams) {
    const team = entry.team;
    const teamInfo = teamsData.teams?.[team.name] ?? {};
    const ceiling = teamInfo.ceiling ?? 7;
    const floor = teamInfo.floor ?? 1;

    const targetTier = Math.min(currentTier, ceiling);
    let assignedTier = targetTier;

    if (targetTier < currentTier) {
      for (let tier = targetTier; tier > 0; tier -= 1) {
        if ((teamsInTiers[tier] ?? 0) < (tierCounts[tier] ?? 0)) {
          assignedTier = tier;
          break;
        }
      }
    } else {
      if ((teamsInTiers[currentTier] ?? 0) >= (tierCounts[currentTier] ?? 0)) {
        currentTier -= 1;
        while (currentTier > 0 && (teamsInTiers[currentTier] ?? 0) >= (tierCounts[currentTier] ?? 0)) {
          currentTier -= 1;
        }
        if (currentTier === 0) {
          currentTier = 1;
        }
      }
      assignedTier = currentTier;
    }

    let prestige = Math.min(assignedTier, ceiling);
    prestige = Math.max(prestige, floor);
    teamsInTiers[prestige] = (teamsInTiers[prestige] ?? 0) + 1;

    result.push({ team, prestige });
  }

  return result;
};

const collectRankAverages = (
  league: LeagueState,
  historyData: HistoryData,
  startYear: number,
  endYear: number
) => {
  const ranksByTeam: Record<string, number[]> = {};
  league.teams.forEach(team => {
    ranksByTeam[team.name] = [];
  });

  league.teams.forEach(team => {
    const historyRows = historyData.teams[team.name] ?? [];
    historyRows.forEach(entry => {
      const year = entry[0];
      const rank = entry[2];
      if (year >= startYear && year <= endYear && typeof rank === 'number' && rank > 0) {
        if (year !== league.info.currentYear) {
          ranksByTeam[team.name].push(rank);
        }
      }
    });
  });

  if (league.info.currentYear >= startYear && league.info.currentYear <= endYear) {
    league.teams.forEach(team => {
      if (team.ranking && team.ranking > 0) {
        ranksByTeam[team.name].push(team.ranking);
      }
    });
  }

  const avgByTeam: Record<string, number | null> = {};
  Object.entries(ranksByTeam).forEach(([teamName, ranks]) => {
    avgByTeam[teamName] = ranks.length ? ranks.reduce((sum, value) => sum + value, 0) / ranks.length : null;
  });

  return avgByTeam;
};

export const getPrestigeAvgRanks = (league: LeagueState, historyData: HistoryData): AvgRanks => {
  const currentYear = league.info.currentYear;
  const avgAfter = collectRankAverages(league, historyData, currentYear - 3, currentYear);
  const avgBefore = collectRankAverages(league, historyData, currentYear - 4, currentYear - 1);

  return Object.fromEntries(
    league.teams.map(team => [
      team.name,
      { before: avgBefore[team.name] ?? null, after: avgAfter[team.name] ?? null },
    ])
  );
};

export const calculatePrestigeChanges = (
  league: LeagueState,
  historyData: HistoryData,
  teamsData: TeamsData,
  prestigeConfig: PrestigeConfig
): AvgRanks => {
  const currentYear = league.info.currentYear;
  const avgAfter = collectRankAverages(league, historyData, currentYear - 3, currentYear);
  const avgBefore = collectRankAverages(league, historyData, currentYear - 4, currentYear - 1);

  const teamsWithAvg = league.teams.map(team => ({
    team,
    avg_rank: avgAfter[team.name] ?? null,
  }));

  const sortedTeams = teamsWithAvg.slice().sort((a, b) => {
    const aRank = a.avg_rank ?? Number.POSITIVE_INFINITY;
    const bRank = b.avg_rank ?? Number.POSITIVE_INFINITY;
    return aRank - bRank;
  });

  const tierCounts = calculateTierCounts(prestigeConfig, sortedTeams.length);
  const assigned = assignPrestigeTiers(sortedTeams, teamsData, tierCounts);

  assigned.forEach(entry => {
    const team = entry.team;
    let desired = entry.prestige;

    if (desired > team.prestige) {
      desired = Math.min(team.prestige + 1, desired);
    } else if (desired < team.prestige) {
      desired = Math.max(team.prestige - 1, desired);
    }

    team.prestige_change = desired - team.prestige;
  });

  return Object.fromEntries(
    league.teams.map(team => [
      team.name,
      { before: avgBefore[team.name] ?? null, after: avgAfter[team.name] ?? null },
    ])
  );
};

export const applyPrestigeChanges = (league: LeagueState) => {
  league.teams.forEach(team => {
    if (team.prestige_change) {
      team.prestige += team.prestige_change;
      team.prestige_change = 0;
    }
  });
};
