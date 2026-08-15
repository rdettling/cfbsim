import { useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
import type { PlayerCareerSeason, PlayerStatCategory } from '../../types/player';
import { formatPlayerStat, getCareerColumns } from './config';

type PlayerCareerMobileListProps = {
  seasons: Array<{ year: number; season: PlayerCareerSeason }>;
  category: PlayerStatCategory;
};

export const PlayerCareerMobileList = ({
  seasons,
  category,
}: PlayerCareerMobileListProps) => {
  const [expandedYear, setExpandedYear] = useState<number | null>(seasons[0]?.year ?? null);
  const columns = getCareerColumns(category);

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="Career statistics"
      sx={{
        display: { xs: 'block', md: 'none' },
        overflow: 'hidden',
        border: 0,
        borderRadius: 0,
      }}
    >
      {seasons.map(({ year, season }, index) => {
        const expanded = expandedYear === year;
        return (
          <Box
            key={year}
            sx={{
              borderBottom: index === seasons.length - 1 ? 0 : '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                p: 1.25,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {year} · {season.classYear.toUpperCase()}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {season.games} games · Rating {season.rating}
                </Typography>
              </Box>
              {columns.length > 0 && (
                <IconButton
                  size="small"
                  aria-label={`${expanded ? 'Hide' : 'Show'} ${year} career statistics`}
                  aria-expanded={expanded}
                  onClick={() => setExpandedYear(expanded ? null : year)}
                >
                  <ExpandMoreIcon
                    sx={{
                      transform: expanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms',
                    }}
                  />
                </IconButton>
              )}
            </Stack>
            {columns.length > 0 && (
              <Collapse in={expanded}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 0.75,
                    px: 1.5,
                    pb: 1.5,
                  }}
                >
                  {columns.map((column) => (
                    <Box
                      key={column.key}
                      sx={{ p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                        }}
                      >
                        {column.mobileLabel}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatPlayerStat(season.stats, column)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            )}
          </Box>
        );
      })}
    </Paper>
  );
};
