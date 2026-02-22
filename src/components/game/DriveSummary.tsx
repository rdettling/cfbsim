import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TeamLogo } from '../team/TeamComponents';
import type { DriveSummaryProps } from '../../types/components';
import type { Drive } from '../../types/game';

const DriveSummary = ({
  drives,
  currentPlayIndex = 0,
  totalPlays: _totalPlays = 0,
  isGameComplete = false,
  variant = 'page',
  includeCurrentDrive = false,
  matchup,
  panelHeight,
}: DriveSummaryProps) => {
  const [expandedDrives, setExpandedDrives] = useState<Set<number>>(new Set());

  const formatClock = (secondsLeft?: number) => {
    if (typeof secondsLeft !== 'number') return '';
    const clamped = Math.max(0, secondsLeft);
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPlayTime = (quarter?: number, clockSecondsLeft?: number) => {
    if (typeof quarter !== 'number') return '';
    const clock = formatClock(clockSecondsLeft);
    return clock ? `Q${quarter} ${clock}` : `Q${quarter}`;
  };

  const toggleDriveExpansion = (driveNum: number) => {
    setExpandedDrives(prev => {
      const next = new Set(prev);
      if (next.has(driveNum)) next.delete(driveNum);
      else next.add(driveNum);
      return next;
    });
  };

  const getCompletedDrives = () => {
    const completed: Drive[] = [];
    let playCount = 0;
    for (const drive of drives) {
      const driveEndIndex = playCount + (drive.plays?.length || 0) - 1;
      if (driveEndIndex < currentPlayIndex) {
        completed.push(drive);
        playCount += drive.plays?.length || 0;
        continue;
      }
      if (includeCurrentDrive) completed.push(drive);
      break;
    }
    return completed;
  };

  const displayDrives = variant === 'modal' ? getCompletedDrives() : drives;

  const containerSx =
    variant === 'page'
      ? { height: panelHeight ?? '100%', display: 'flex', flexDirection: 'column' }
      : { height: '100%', display: 'flex', flexDirection: 'column' };

  return (
    <Card sx={containerSx}>
      <CardContent
        sx={
          variant === 'modal'
            ? { flex: 1, overflow: 'auto' }
            : { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }
        }
      >
        <Typography variant="h5" gutterBottom>
          Drive Summary
        </Typography>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {displayDrives.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {variant === 'modal' ? 'No completed drives yet' : 'No drives available'}
            </Typography>
          ) : (
            displayDrives.map((drive, idx) => {
              const hasPlays = Boolean(drive.plays && drive.plays.length > 0);
              const isExpanded = expandedDrives.has(drive.driveNum);
              const isCurrentDrive =
                includeCurrentDrive &&
                !isGameComplete &&
                variant === 'modal' &&
                idx === displayDrives.length - 1;

              const scoreA = isCurrentDrive && matchup ? matchup.currentScoreA : drive.scoreAAfter;
              const scoreB = isCurrentDrive && matchup ? matchup.currentScoreB : drive.scoreBAfter;
              const resolvedScore = matchup
                ? matchup.awayIsTeamA
                  ? { awayScore: scoreA ?? 0, homeScore: scoreB ?? 0 }
                  : { awayScore: scoreB ?? 0, homeScore: scoreA ?? 0 }
                : { awayScore: scoreA ?? 0, homeScore: scoreB ?? 0 };

              return (
                <Card key={idx} variant="outlined" sx={{ mb: 1.25 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip label={`Drive #${drive.driveNum + 1}`} size="small" />
                        {hasPlays && (
                          <IconButton size="small" onClick={() => toggleDriveExpansion(drive.driveNum)}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        )}
                      </Stack>
                      <Chip label={drive.points > 0 ? `+${drive.points} pts` : 'No score'} size="small" />
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 1 }}>
                      <TeamLogo name={drive.offense} size={22} />
                      <Typography variant="body1">{drive.offense}</Typography>
                    </Stack>

                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {drive.result
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {drive.plays?.length || 0} plays{drive.yards !== undefined ? `, ${drive.yards} yards` : ''}
                      </Typography>
                      {scoreA !== undefined && scoreB !== undefined && (
                        <Typography variant="caption" color="text.secondary">
                          {resolvedScore.awayScore}-{resolvedScore.homeScore}
                        </Typography>
                      )}
                    </Stack>

                    {hasPlays && (
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          Plays
                        </Typography>
                        <Stack spacing={0.75}>
                          {drive.plays?.map((play, playIdx) => (
                            <Box key={playIdx}>
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" color="text.secondary">
                                  {play.header}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatPlayTime(play.quarter, play.clockSecondsLeft)}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" sx={{ mt: 0.25 }}>
                                {play.text}
                              </Typography>
                              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.25 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {play.playType.charAt(0).toUpperCase() + play.playType.slice(1)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {play.yardsGained > 0 ? '+' : ''}
                                  {play.yardsGained} yards
                                </Typography>
                              </Stack>
                              {playIdx !== (drive.plays?.length || 0) - 1 && <Divider sx={{ mt: 0.75 }} />}
                            </Box>
                          ))}
                        </Stack>
                      </Collapse>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default DriveSummary;
