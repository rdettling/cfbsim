import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TeamLogo } from '../team/TeamLogo';
import type { DriveSummaryProps } from '../../types/components';
import type { Drive } from '../../types/game';
import type { PlayTiming, RegulationClockEvent } from '../../types/db';
import { CONCEPT_LABELS } from '../../domain/sim/concepts';
import { DEFENSIVE_INTENT_LABELS } from '../../domain/sim/defensiveIntents';
import {
  CLOCK_MANAGEMENT_LABELS,
  CLOCK_TEMPO_LABELS,
} from '../../domain/sim/clockManagement';

export const CLOCK_EVENT_LABELS: Record<RegulationClockEvent, string> = {
  two_minute_timeout: 'Two-Minute Timeout',
  end_of_quarter: 'End of Quarter',
  halftime: 'Halftime',
  end_of_regulation: 'End of Regulation',
};

const formatClock = (secondsLeft: number) => {
  const clamped = Math.max(0, secondsLeft);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatPlayTiming = (timing: PlayTiming) => {
  if (timing.kind === 'overtime') return `OT ${timing.period}`;
  if (timing.kind === 'try') {
    return timing.context === 'overtime'
      ? `OT ${timing.period}`
      : `Q${timing.quarter} ${formatClock(timing.secondsLeft)}`;
  }
  return `Q${timing.start.quarter} ${formatClock(timing.start.secondsLeft)}`;
};

const DriveSummary = ({
  drives,
  currentPlayIndex = 0,
  totalPlays: _totalPlays = 0,
  isGameComplete = false,
  variant = 'page',
  includeCurrentDrive = false,
  matchup,
  embedded = false,
}: DriveSummaryProps) => {
  const [expandedDrives, setExpandedDrives] = useState<Set<number>>(new Set());
  const [driveFilter, setDriveFilter] = useState<'all' | 'scoring'>('all');

  const getDriveStartTime = (drive: Drive) => {
    const firstPlay = drive.plays?.[0];
    if (!firstPlay) return '';
    return formatPlayTiming(firstPlay.timing);
  };

  const formatDuration = (seconds: number) => {
    const clamped = Math.max(0, seconds);
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDriveDurationLabel = (drive: Drive) => {
    const totalSeconds = drive.plays.reduce(
      (sum, play) => sum + (
        play.timing.kind === 'regulation' ? Math.max(play.timing.elapsedSeconds, 0) : 0
      ),
      0,
    );
    return totalSeconds > 0 ? formatDuration(totalSeconds) : '';
  };

  const toggleDriveExpansion = (driveNum: number) => {
    setExpandedDrives((prev) => {
      const next = new Set(prev);
      if (next.has(driveNum)) next.delete(driveNum);
      else next.add(driveNum);
      return next;
    });
  };

  const displayDrives = useMemo(() => {
    if (variant !== 'modal') return drives;

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
  }, [currentPlayIndex, drives, includeCurrentDrive, variant]);

  const visibleDrives = useMemo(
    () =>
      driveFilter === 'scoring' ? displayDrives.filter((drive) => drive.points > 0) : displayDrives,
    [displayDrives, driveFilter],
  );
  const chargedTimeoutLabels = useMemo(() => {
    const used = new Map<string, number>();
    const labels = new Map<number, string>();
    [...drives]
      .sort((left, right) => left.driveNum - right.driveNum)
      .forEach(drive => drive.plays.forEach(play => {
        if (play.timing.kind !== 'regulation' || !play.timing.chargedTimeoutAfter) return;
        const team = play.timing.chargedTimeoutAfter === 'offense'
          ? drive.offense
          : drive.defense;
        const half = play.timing.start.quarter <= 2 ? 1 : 2;
        const key = `${half}:${team}`;
        const nextUsed = (used.get(key) ?? 0) + 1;
        used.set(key, nextUsed);
        labels.set(play.id, `${team} Timeout · ${Math.max(0, 3 - nextUsed)} remaining`);
      }));
    return labels;
  }, [drives]);

  useEffect(() => {
    const visibleDriveNums = new Set(visibleDrives.map((drive) => drive.driveNum));
    setExpandedDrives((prev) => {
      const next = new Set<number>();
      prev.forEach((driveNum) => {
        if (visibleDriveNums.has(driveNum)) next.add(driveNum);
      });
      const unchanged =
        next.size === prev.size && Array.from(next).every((driveNum) => prev.has(driveNum));
      return unchanged ? prev : next;
    });
  }, [visibleDrives]);

  const containerSx = {
    height: embedded ? 'auto' : '100%',
    display: 'flex',
    flexDirection: 'column',
    ...(variant === 'page' && { minHeight: 0 }),
    ...(embedded && { bgcolor: 'transparent' }),
  } as const;

  return (
    <Paper
      variant={variant === 'page' && !embedded ? 'outlined' : undefined}
      elevation={embedded ? 0 : undefined}
      sx={containerSx}
    >
      <Box
        sx={
          variant === 'modal'
            ? { flex: 1, overflow: embedded ? 'visible' : 'auto' }
            : {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                p: embedded ? 0 : 1.5,
                '&:last-child': { pb: 1.5 },
              }
        }
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            justifyContent: embedded ? 'flex-end' : 'space-between',
            mb: 1,
          }}
        >
          {!embedded && (
            <Typography
              component={variant === 'page' ? 'h2' : 'div'}
              variant={variant === 'page' ? 'h6' : 'h5'}
              sx={{ fontWeight: variant === 'page' ? 600 : 800 }}
            >
              Drive Summary
            </Typography>
          )}
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
            overflowY: embedded ? 'visible' : 'auto',
            pr: 0.25,
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': { width: 7 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: variant === 'page' ? 'divider' : 'rgba(0,0,0,0.16)',
              borderRadius: 8,
            },
          }}
        >
          {visibleDrives.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {driveFilter === 'scoring'
                ? 'No scoring drives'
                : variant === 'modal'
                  ? 'No completed drives yet'
                  : 'No drives are available for this game.'}
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
                <Box
                  key={drive.driveNum}
                  sx={{
                    py: 1.1,
                    borderTop: idx === 0 ? 0 : '1px solid',
                    borderColor: 'divider',
                  }}
                >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          alignItems: 'center',
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 700,
                          }}
                        >
                          {getDriveStartTime(drive) || 'Start time unavailable'}
                        </Typography>
                        {hasPlays && (
                          <IconButton
                            size="small"
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} drive ${drive.driveNum + 1}`}
                            aria-expanded={isExpanded}
                            aria-controls={`drive-${drive.driveNum}-plays`}
                            onClick={() => toggleDriveExpansion(drive.driveNum)}
                          >
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

                    <Stack
                      direction="row"
                      spacing={1.25}
                      sx={{
                        alignItems: 'center',
                        mt: 1,
                      }}
                    >
                      <TeamLogo name={drive.offense} size={22} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {drive.offense}
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 0.85,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 600,
                        }}
                      >
                        {drive.result
                          .split(' ')
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')}
                        {' • '}
                        {drive.plays?.length || 0} plays
                        {drive.yards !== undefined ? ` • ${drive.yards} yards` : ''}
                        {driveDuration ? ` • ${driveDuration}` : ''}
                      </Typography>
                      {scoreA !== undefined && scoreB !== undefined && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 700,
                          }}
                        >
                          {resolvedScore.awayScore}-{resolvedScore.homeScore}
                        </Typography>
                      )}
                    </Stack>

                    {hasPlays && (
                      <Collapse
                        id={`drive-${drive.driveNum}-plays`}
                        in={isExpanded}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Divider sx={{ my: 1.1 }} />
                        <Typography
                          variant="subtitle2"
                          sx={{
                            color: 'text.secondary',
                            mb: 0.8,
                            fontWeight: 700,
                          }}
                        >
                          Plays
                        </Typography>
                        <Stack spacing={0.65}>
                          {drive.plays?.map((play, playIdx) => (
                            <Box key={playIdx} sx={{ pb: 0.55 }}>
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'text.secondary',
                                  }}
                                >
                                  {play.header}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'text.secondary',
                                    fontWeight: 700,
                                  }}
                                >
                                  {formatPlayTiming(play.timing)}
                                </Typography>
                              </Stack>
                              <Typography variant="body1" sx={{ mt: 0.2, fontWeight: 500 }}>
                                {play.text}
                              </Typography>
                              <Stack
                                direction="row"
                                sx={{
                                  justifyContent: 'space-between',
                                  mt: 0.2,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'text.secondary',
                                  }}
                                >
                                  {(() => {
                                    const callLabel = play.call.kind === 'scrimmage'
                                      ? `${CONCEPT_LABELS[play.call.offense]} · ${DEFENSIVE_INTENT_LABELS[play.call.defense]}`
                                      : play.call.kind === 'clock_management'
                                        ? CLOCK_MANAGEMENT_LABELS[play.call.action]
                                        : play.call.kind === 'try'
                                          ? play.call.attempt === 'extra_point'
                                            ? 'Extra Point'
                                            : `Two-Point Try · ${CONCEPT_LABELS[play.call.offense]} · ${DEFENSIVE_INTENT_LABELS[play.call.defense]}`
                                          : play.call.concept === 'field_goal'
                                            ? 'Field Goal'
                                            : 'Punt';
                                    const tempoLabel = play.timing.kind === 'regulation'
                                      && play.timing.tempo !== 'normal'
                                      ? ` · ${CLOCK_TEMPO_LABELS[play.timing.tempo]}`
                                      : '';
                                    return `${callLabel}${tempoLabel}`;
                                  })()}
                                </Typography>
                                {play.call.kind !== 'try' && (
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
                                )}
                              </Stack>
                              {play.timing.kind === 'regulation' && play.timing.eventAfter && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    mt: 0.65,
                                    py: 0.35,
                                    borderTop: '1px solid',
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    color: 'text.secondary',
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  {CLOCK_EVENT_LABELS[play.timing.eventAfter]}
                                </Typography>
                              )}
                              {play.timing.kind === 'regulation'
                                && play.timing.chargedTimeoutAfter
                                && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      display: 'block',
                                      mt: 0.65,
                                      py: 0.35,
                                      borderTop: '1px solid',
                                      borderBottom: '1px solid',
                                      borderColor: 'divider',
                                      color: 'text.secondary',
                                      fontWeight: 800,
                                      textAlign: 'center',
                                      textTransform: 'uppercase',
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    {chargedTimeoutLabels.get(play.id)}
                                  </Typography>
                                )}
                              {playIdx !== (drive.plays?.length || 0) - 1 && (
                                <Divider sx={{ mt: 0.75 }} />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Collapse>
                    )}
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default DriveSummary;
