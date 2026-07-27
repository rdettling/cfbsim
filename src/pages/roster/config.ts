import type { PlayerRecord } from '../../types/db';

export const PLAYER_YEAR_LABELS: Record<PlayerRecord['year'], string> = {
  fr: 'Freshman',
  so: 'Sophomore',
  jr: 'Junior',
  sr: 'Senior',
};
