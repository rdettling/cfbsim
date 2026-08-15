import { Box, Stack, Typography } from '@mui/material';

type PlayerStarRatingProps = {
  label: string;
  value: number;
};

const STAR_SLOTS = [1, 2, 3, 4, 5] as const;

export const PlayerStarRating = ({ label, value }: PlayerStarRatingProps) => {
  const normalizedValue = Math.min(Math.max(value, 0), STAR_SLOTS.length);

  return (
    <Stack
      direction="row"
      spacing={0.75}
      role="img"
      aria-label={`${label} ${normalizedValue} out of 5`}
      sx={{ alignItems: 'center' }}
    >
      <Typography
        variant="caption"
        sx={{ width: 78, flexShrink: 0, color: 'text.secondary', fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Stack direction="row" spacing={0.35} aria-hidden="true">
        {STAR_SLOTS.map((slot) => {
          const earned = slot <= normalizedValue;
          return (
            <Box
              key={slot}
              component="img"
              src="/logos/star.png"
              alt=""
              sx={{
                display: 'block',
                width: 14,
                height: 14,
                objectFit: 'contain',
                opacity: earned ? 1 : 0.7,
                filter: earned ? 'none' : 'grayscale(1)',
              }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
};
