import type { TeamScheduleGame } from './types';

type ScheduleVenue = Pick<TeamScheduleGame, 'location' | 'venue'>;

export const getScheduleVenueLabel = ({
  location,
  venue,
}: ScheduleVenue): string => {
  if (!location) return '—';
  if (location === 'Neutral' && venue) return `${location} (${venue})`;
  return location;
};
