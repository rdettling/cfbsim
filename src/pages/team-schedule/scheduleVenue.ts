type ScheduleVenue = {
  location?: 'Home' | 'Away' | 'Neutral';
  venue: string | null;
};

export const getScheduleVenueLabel = ({
  location,
  venue,
}: ScheduleVenue): string => {
  if (!location) return '—';
  if (location === 'Neutral' && venue) return `${location} (${venue})`;
  return location;
};
