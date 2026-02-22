import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Collapse,
  Divider,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
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
  const [driveFilter, setDriveFilter] = useState<'all' | 'scoring'>('all');

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

  const overtimeByDriveNum = useMemo(() => {
    const mapping = new Map<number, number>();
    let overtimeDriveCount = 0;
    drives.forEach(drive => {
      const firstPlay = drive.plays?.[0];
      if (firstPlay?.quarter === 4 && firstPlay.clockSecondsLeft === 0) {
        const overtimeNumber = Math.floor(overtimeDriveCount / 2) + 1;
        mapping.set(drive.driveNum, overtimeNumber);
        overtimeDriveCount += 1;
      }
    });
    return mapping;
  }, [drives]);

  const getDriveStartTime = (drive: Drive) => {
    const firstPlay = drive.plays?.[0];
    if (!firstPlay) return '';
    const overtimeNumber = overtimeByDriveNum.get(drive.driveNum);
    if (overtimeNumber) {
      return `OT ${overtimeNumber}`;
    }
    return formatPlayTime(firstPlay.quarter, firstPlay.clockSecondsLeft);
  };

  const formatDuration = (seconds: number) => {
    const clamped = Math.max(0, seconds);
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDriveDurationLabel = (drive: Drive) => {
    const hasTimingData = drive.plays.some(play => typeof play.playSeconds === 'number');
    if (!hasTimingData) return '';
    const totalSeconds = drive.plays.reduce(
      (sum, play) => sum + (typeof play.playSeconds === 'number' ? Math.max(play.playSeconds, 0) : 0),
      0
    );
    return formatDuration(totalSeconds);
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
  const visibleDrives = useMemo(
    () => (driveFilter === 'scoring' ? displayDrives.filter(drive => drive.points > 0) : displayDrives),
    [displayDrives, driveFilter]
  );

  useEffect(() => {
    const visibleDriveNums = new Set(visibleDrives.map(drive => drive.driveNum));
    setExpandedDrives(prev => {
      const next = new Set<number>();
      prev.forEach(driveNum => {
        if (visibleDriveNums.has(driveNum)) next.add(driveNum);
      });
      return next;
    });
  }, [visibleDrives]);

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
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 1 }}
        >
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Drive Summary
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={driveFilter}
            exclusive
            onChange={(_, value: 'all' | 'scoring' | null) => {
              if (value) setDriveFilter(value);
            }}
            aria-label="drive filter"
            sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700 } }}
          >
            <ToggleButton value="all">All drives</ToggleButton>
            <ToggleButton value="scoring">Scoring drives</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            pr: 0.25,
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': { width: 7 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.16)',
              borderRadius: 8,
            },
          }}
        >
          {visibleDrives.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {driveFilter === 'scoring'
                ? 'No scoring drives'
                : variant === 'modal'
                  ? 'No completed drives yet'
                  : 'No drives available'}
            </Typography>
          ) : (
            visibleDrives.map((drive, idx) => {
              const hasPlays = Boolean(drive.plays && drive.plays.length > 0);
              const isExpanded = expandedDrives.has(drive.driveNum);
              const driveDuration = getDriveDurationLabel(drive);
              const isCurrentDrive =
                includeCurrentDrive &&
                !isGameComplete &&
                variant === 'modal' &&
                idx === visibleDrives.length - 1;

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
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {getDriveStartTime(drive) || 'Start time unavailable'}
                        </Typography>
                        {hasPlays && (
                          <IconButton size="small" onClick={() => toggleDriveExpansion(drive.driveNum)}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        )}
                      </Stack>
                      {drive.points > 0 && (
                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'success.main' }}>
                          +{drive.points} pts
                        </Typography>
                      )}
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 1 }}>
                      <TeamLogo name={drive.offense} size={22} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {drive.offense}
                      </Typography>
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.85 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {drive.result
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')}
                        {' • '}
                        {drive.plays?.length || 0} plays
                        {drive.yards !== undefined ? ` • ${drive.yards} yards` : ''}
                        {driveDuration ? ` • ${driveDuration}` : ''}
                      </Typography>
                      {scoreA !== undefined && scoreB !== undefined && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {resolvedScore.awayScore}-{resolvedScore.homeScore}
                        </Typography>
                      )}
                    </Stack>

                    {hasPlays && (
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Divider sx={{ my: 1.1 }} />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.8, fontWeight: 700 }}>
                          Plays
                        </Typography>
                        <Stack spacing={0.65}>
                          {drive.plays?.map((play, playIdx) => (
                            <Box key={playIdx} sx={{ pb: 0.55 }}>
                              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                  {play.header}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                  {formatPlayTime(play.quarter, play.clockSecondsLeft)}
                                </Typography>
                              </Stack>
                              <Typography variant="body1" sx={{ mt: 0.2, fontWeight: 500 }}>
                                {play.text}
                              </Typography>
                              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.2 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {play.playType.charAt(0).toUpperCase() + play.playType.slice(1)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color={
                                    play.yardsGained > 0
                                      ? 'success.main'
                                      : play.yardsGained < 0
                                        ? 'error.main'
                                        : 'text.secondary'
                                  }
                                  sx={{ fontWeight: 700 }}
                                >
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
