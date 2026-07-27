import { getDb } from '../../db/db';
import type {
  NextSeasonConfiguration,
  PlayoffTeamCount,
  Settings,
} from '../../types/domain';
import {
  DEFAULT_SETTINGS,
  NextSeasonConfigurationError,
  OffseasonStageMismatchError,
  type LeagueState,
} from '../../types/league';

const isPlayoffTeamCount = (value: number): value is PlayoffTeamCount =>
  value === 2 || value === 4 || value === 12;

export const settingsToNextSeasonConfiguration = (
  settings: Settings,
): NextSeasonConfiguration =>
  normalizeNextSeasonConfiguration({
    conferencePolicy:
      settings.auto_realignment === false ? 'current' : 'historical',
    postseasonPolicy:
      settings.auto_update_postseason_format === false
        ? 'custom'
        : 'historical',
    playoffTeams: settings.playoff_teams as PlayoffTeamCount,
    playoffAutobids: settings.playoff_autobids,
    conferenceChampionsReceiveTopSeeds:
      settings.playoff_conf_champ_top_4,
  });

export const normalizeNextSeasonConfiguration = (
  configuration: NextSeasonConfiguration,
): NextSeasonConfiguration => {
  if (
    configuration.conferencePolicy !== 'historical' &&
    configuration.conferencePolicy !== 'current'
  ) {
    throw new NextSeasonConfigurationError(
      'Choose either historical or current conference alignment.',
    );
  }
  if (
    configuration.postseasonPolicy !== 'historical' &&
    configuration.postseasonPolicy !== 'custom'
  ) {
    throw new NextSeasonConfigurationError(
      'Choose either historical or custom postseason format.',
    );
  }
  if (!isPlayoffTeamCount(configuration.playoffTeams)) {
    throw new NextSeasonConfigurationError(
      'The playoff must contain 2, 4, or 12 teams.',
    );
  }

  if (configuration.playoffTeams !== 12) {
    return {
      ...configuration,
      playoffAutobids: 0,
      conferenceChampionsReceiveTopSeeds: false,
    };
  }

  const playoffAutobids =
    configuration.playoffAutobids ?? DEFAULT_SETTINGS.playoff_autobids ?? 6;
  if (
    !Number.isInteger(playoffAutobids) ||
    playoffAutobids < 0 ||
    playoffAutobids > 10
  ) {
    throw new NextSeasonConfigurationError(
      'A 12-team playoff must use between 0 and 10 automatic bids.',
    );
  }

  return {
    ...configuration,
    playoffAutobids,
    conferenceChampionsReceiveTopSeeds:
      configuration.conferenceChampionsReceiveTopSeeds ??
      DEFAULT_SETTINGS.playoff_conf_champ_top_4 ??
      true,
  };
};

export const configurationToSettings = (
  current: Settings,
  configuration: NextSeasonConfiguration,
): Settings => ({
  ...current,
  auto_realignment: configuration.conferencePolicy === 'historical',
  auto_update_postseason_format:
    configuration.postseasonPolicy === 'historical',
  playoff_teams: configuration.playoffTeams,
  playoff_autobids: configuration.playoffAutobids,
  playoff_conf_champ_top_4:
    configuration.conferenceChampionsReceiveTopSeeds,
});

export const updateNextSeasonConfiguration = async (
  patch: Partial<NextSeasonConfiguration>,
): Promise<NextSeasonConfiguration> => {
  const db = await getDb();
  const tx = db.transaction('league', 'readwrite');

  try {
    const record = await tx.objectStore('league').get('current');
    const league = record?.value as LeagueState | undefined;
    if (!league) {
      throw new Error('No league found. Start a new game from the Home page.');
    }
    if (league.info.stage !== 'realignment') {
      throw new OffseasonStageMismatchError(
        'realignment',
        league.info.stage,
      );
    }

    const current = settingsToNextSeasonConfiguration(
      league.settings ?? { ...DEFAULT_SETTINGS },
    );
    const configuration = normalizeNextSeasonConfiguration({
      ...current,
      ...patch,
    });
    league.settings = configurationToSettings(
      league.settings ?? { ...DEFAULT_SETTINGS },
      configuration,
    );
    await tx.objectStore('league').put({ key: 'current', value: league });
    await tx.done;
    return configuration;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction may already be closed.
    }
    try {
      await tx.done;
    } catch {
      // An explicit abort rejects transaction completion.
    }
    throw error;
  }
};
