import type {
  ConferenceChange,
  NextSeasonPreview,
  PlayoffTeamCount,
  PostseasonChange,
} from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { ResolvedHistoricalData } from './historicalData';

export const buildNextSeasonPreview = (
  league: LeagueState,
  resolved: ResolvedHistoricalData,
): NextSeasonPreview => {
  const assignments = new Map<string, string>();
  Object.entries(resolved.yearData.conferences).forEach(
    ([conferenceName, conference]) => {
      Object.keys(conference.teams).forEach(teamName => {
        assignments.set(teamName, conferenceName);
      });
    },
  );
  Object.keys(resolved.yearData.Independent ?? {}).forEach(teamName => {
    assignments.set(teamName, 'Independent');
  });

  const currentConferences = new Map(
    league.teams.map(team => [
      team.name,
      team.conference || team.confName || 'Independent',
    ]),
  );
  const teamNames = new Set([
    ...currentConferences.keys(),
    ...assignments.keys(),
  ]);
  const conferenceChanges: ConferenceChange[] = [];
  teamNames.forEach(teamName => {
    const fromConference = currentConferences.get(teamName) ?? 'FCS';
    const toConference = assignments.get(teamName);
    if (toConference && fromConference !== toConference) {
      conferenceChanges.push({
        teamName,
        fromConference,
        toConference,
      });
    }
  });
  conferenceChanges.sort((a, b) => a.teamName.localeCompare(b.teamName));

  const current = league.settings;
  const historicalTeams =
    resolved.yearData.playoff.teams as PlayoffTeamCount;
  const historicalAutobids =
    historicalTeams === 12
      ? resolved.yearData.playoff.conf_champ_autobids ?? 0
      : 0;
  const historicalTopSeeds =
    historicalTeams === 12
      ? resolved.yearData.playoff.conf_champ_top_4 ?? false
      : false;
  const postseasonChanges: PostseasonChange[] = [];

  if (current.playoffTeams !== historicalTeams) {
    postseasonChanges.push({
      setting: 'playoffTeams',
      currentValue: current.playoffTeams,
      nextValue: historicalTeams,
    });
  }
  if ((current.playoffAutobids ?? 0) !== historicalAutobids) {
    postseasonChanges.push({
      setting: 'playoffAutobids',
      currentValue: current.playoffAutobids ?? 0,
      nextValue: historicalAutobids,
    });
  }
  if (
    (current.conferenceChampionsReceiveTopSeeds ?? false) !==
    historicalTopSeeds
  ) {
    postseasonChanges.push({
      setting: 'conferenceChampionsReceiveTopSeeds',
      currentValue:
        current.conferenceChampionsReceiveTopSeeds ?? false,
      nextValue: historicalTopSeeds,
    });
  }

  return {
    dataSource: resolved.dataSource,
    historicalPostseason: {
      playoffTeams: historicalTeams,
      playoffAutobids: historicalAutobids,
      conferenceChampionsReceiveTopSeeds: historicalTopSeeds,
    },
    conferenceChanges,
    postseasonChanges,
  };
};
