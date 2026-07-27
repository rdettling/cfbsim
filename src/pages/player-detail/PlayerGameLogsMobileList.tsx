import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Chip, Collapse, IconButton, Link, Paper, Stack, Typography } from '@mui/material';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import type { PlayerGameLog, PlayerStatCategory } from '../../types/player';
import { formatPlayerStat, getGameColumns, getPrimaryGameColumns } from './config';

type PlayerGameLogsMobileListProps = {
  logs: PlayerGameLog[];
  category: PlayerStatCategory;
  onTeamClick: (teamName: string) => void;
};

export const PlayerGameLogsMobileList = ({
  logs,
  category,
  onTeamClick,
}: PlayerGameLogsMobileListProps) => {
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const columns = getGameColumns(category);
  const primaryColumns = getPrimaryGameColumns(category);

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="Player game logs"
      sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
    >
      {logs.map((log, index) => {
        const logKey = `${log.game.id}-${index}`;
        const opponent = log.game.opponent;
        const expanded = expandedGame === logKey;
        const isWin = log.game.result === 'W';
        return (
          <Box
            key={logKey}
            sx={{
              borderBottom: index === logs.length - 1 ? 0 : '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ p: 1.25 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'center',
                }}
              >
                <Typography sx={{ width: 28, textAlign: 'center', fontWeight: 600 }}>
                  {log.game.weekPlayed}
                </Typography>
                {opponent && <TeamLogo name={opponent.name} size={32} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {opponent && <TeamLink name={opponent.name} onTeamClick={onTeamClick} />}
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      display: 'block',
                    }}
                  >
                    {log.game.label}
                  </Typography>
                </Box>
                <Chip
                  label={isWin ? 'W' : 'L'}
                  size="small"
                  color={isWin ? 'success' : 'error'}
                  variant="outlined"
                />
                <Link
                  component={RouterLink}
                  to={`/game/${log.game.id}`}
                  underline="hover"
                  sx={{ fontWeight: 600 }}
                >
                  {log.game.score}
                </Link>
                {columns.length > 0 && (
                  <IconButton
                    size="small"
                    aria-label={`${expanded ? 'Hide' : 'Show'} Week ${log.game.weekPlayed} statistics`}
                    aria-expanded={expanded}
                    onClick={() => setExpandedGame(expanded ? null : logKey)}
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
              {primaryColumns.length > 0 && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${primaryColumns.length}, 1fr)`,
                    gap: 0.75,
                    mt: 1,
                  }}
                >
                  {primaryColumns.map((column) => (
                    <Box key={column.key}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                        }}
                      >
                        {column.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatPlayerStat(log.stats, column)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
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
                        {formatPlayerStat(log.stats, column)}
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
