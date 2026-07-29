import { getDb } from '../../db/db';
import type {
  NextSeasonConfiguration,
  PlayoffTeamCount,
} from '../../types/domain';
import {
  NextSeasonConfigurationError,
  OffseasonStageMismatchError,
} from '../../types/league';
import { assertCurrentLeagueState } from '../../db/leagueRepo';

const isPlayoffTeamCount = (value: number): value is PlayoffTeamCount =>
  value === 2 || value === 4 || value === 12;

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

  const playoffAutobids = configuration.playoffAutobids;
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
      configuration.conferenceChampionsReceiveTopSeeds,
  };
};

export const updateNextSeasonConfiguration = async (
  patch: Partial<NextSeasonConfiguration>,
): Promise<NextSeasonConfiguration> => {
  const db = await getDb();
  const tx = db.transaction('league', 'readwrite');

  try {
    const record = await tx.objectStore('league').get('current');
    if (!record) {
      throw new Error('No league found. Start a new game from the Home page.');
    }
    assertCurrentLeagueState(record.value);
    const league = record.value;
    if (league.info.stage !== 'realignment') {
      throw new OffseasonStageMismatchError(
        'realignment',
        league.info.stage,
      );
    }

    const configuration = normalizeNextSeasonConfiguration({
      ...league.settings,
      ...patch,
    });
    league.settings = configuration;
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
