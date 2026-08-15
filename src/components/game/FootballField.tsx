import { alpha, Box, Typography } from '@mui/material';
import { useLayoutEffect, useRef, useState } from 'react';

type FieldTeam = {
  name: string;
  mascot?: string;
  colorPrimary?: string;
  colorSecondary?: string;
};

type FootballFieldProps = {
  currentYardLine: number;
  homeTeam: FieldTeam;
  awayTeam: FieldTeam;
  neutralSite: boolean;
  isOffenseLeftToRight: boolean;
  down: number;
  yardsToGo: number;
  previousPlayYards?: number;
};

const END_ZONE_YARDS = 10;
const TOTAL_FIELD_YARDS = 120;
const YARD_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const END_ZONE_CROSS_AXIS_FILL = 0.7;
const END_ZONE_INLINE_AXIS_FILL = 0.82;
const END_ZONE_FALLBACK_FONT_SIZE = 16;

const clampYard = (yard: number) => Math.max(0, Math.min(100, yard));
const yardToPercent = (yard: number) =>
  ((END_ZONE_YARDS + clampYard(yard)) / TOTAL_FIELD_YARDS) * 100;

const formatDown = (down: number) => {
  if (down === 1) return '1st';
  if (down === 2) return '2nd';
  if (down === 3) return '3rd';
  return '4th';
};

type EndZoneWordmarkMetrics = {
  endZoneWidth: number;
  endZoneHeight: number;
  measuredFontSize: number;
  measuredTextWidth: number;
};

export const calculateEndZoneWordmarkFontSize = ({
  endZoneWidth,
  endZoneHeight,
  measuredFontSize,
  measuredTextWidth,
}: EndZoneWordmarkMetrics) => {
  const values = [endZoneWidth, endZoneHeight, measuredFontSize, measuredTextWidth];
  if (values.some(value => !Number.isFinite(value) || value <= 0)) return null;

  const crossAxisLimit = endZoneWidth * END_ZONE_CROSS_AXIS_FILL;
  const inlineAxisLimit = measuredFontSize
    * ((endZoneHeight * END_ZONE_INLINE_AXIS_FILL) / measuredTextWidth);
  return Math.round(Math.min(crossAxisLimit, inlineAxisLimit) * 10) / 10;
};

const EndZoneWordmark = ({
  team,
  label,
  side,
}: {
  team: FieldTeam;
  label: string;
  side: 'left' | 'right';
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(END_ZONE_FALLBACK_FONT_SIZE);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const labelElement = labelRef.current;
    if (!container || !labelElement) return undefined;

    let active = true;
    const measure = () => {
      const measuredFontSize = Number.parseFloat(getComputedStyle(labelElement).fontSize);
      const nextFontSize = calculateEndZoneWordmarkFontSize({
        endZoneWidth: container.clientWidth,
        endZoneHeight: container.clientHeight,
        measuredFontSize,
        measuredTextWidth: labelElement.scrollWidth,
      });
      if (nextFontSize === null || !active) return;
      setFontSize(current => Math.abs(current - nextFontSize) < 0.1
        ? current
        : nextFontSize);
    };

    measure();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
    } else {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(container);
    }

    void document.fonts.ready.then(() => {
      if (active) measure();
    });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [label]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        inset: side === 'left' ? '0 auto 0 0' : '0 0 0 auto',
        width: `${(END_ZONE_YARDS / TOTAL_FIELD_YARDS) * 100}%`,
        overflow: 'hidden',
        backgroundColor: team.colorPrimary || 'primary.dark',
        color: team.colorSecondary || 'common.white',
      }}
    >
      <Typography
        ref={labelRef}
        component="span"
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          display: 'inline-block',
          color: 'inherit',
          fontSize: `${fontSize}px`,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: { xs: '0.055em', sm: '0.075em' },
          textTransform: 'uppercase',
          textShadow: theme =>
            `0 1px 1px ${alpha(theme.palette.common.black, 0.62)}, 0 0 4px ${alpha(theme.palette.common.black, 0.3)}`,
          WebkitTextStroke: theme => `0.75px ${alpha(theme.palette.common.black, 0.5)}`,
          paintOrder: 'stroke fill',
          transform: side === 'left'
            ? 'translate(-50%, -50%) rotate(-90deg)'
            : 'translate(-50%, -50%) rotate(90deg)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

const FieldLine = ({
  left,
  color,
  width = 2,
}: {
  left: number;
  color: string;
  width?: number;
}) => (
  <Box
    sx={{
      position: 'absolute',
      left: `${left}%`,
      top: 0,
      bottom: 0,
      width,
      transform: 'translateX(-50%)',
      backgroundColor: color,
      zIndex: 4,
    }}
  />
);

const FootballField = ({
  currentYardLine,
  homeTeam,
  awayTeam,
  neutralSite,
  isOffenseLeftToRight,
  down,
  yardsToGo,
  previousPlayYards = 0,
}: FootballFieldProps) => {
  const displayYardLine = isOffenseLeftToRight
    ? currentYardLine
    : 100 - currentYardLine;
  const firstDownYardLine = Math.min(100, currentYardLine + yardsToGo);
  const displayFirstDown = isOffenseLeftToRight
    ? firstDownYardLine
    : 100 - firstDownYardLine;
  const ballPosition = yardToPercent(displayYardLine);
  const firstDownPosition = yardToPercent(displayFirstDown);
  const previousPosition = yardToPercent(
    displayYardLine - previousPlayYards * (isOffenseLeftToRight ? 1 : -1),
  );
  const previousPlayLeft = Math.min(previousPosition, ballPosition);
  const previousPlayWidth = Math.abs(previousPosition - ballPosition);
  const previousPlayMovesRight = ballPosition > previousPosition;
  const leftEndZoneTeam = neutralSite ? awayTeam : homeTeam;
  const rightEndZoneLabel = neutralSite
    ? homeTeam.name
    : homeTeam.mascot || homeTeam.name;

  return (
    <Box
      role="img"
      aria-label={`Football field showing the ball at yard line ${currentYardLine}`}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 815,
        mx: 'auto',
        alignSelf: 'center',
        aspectRatio: '120 / 53',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        backgroundColor: 'success.dark',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: theme =>
            `repeating-linear-gradient(
              0deg,
              ${alpha(theme.palette.common.white, 0.035)},
              ${alpha(theme.palette.common.white, 0.035)} 12px,
              transparent 12px,
              transparent 24px
            )`,
        }}
      />

      <EndZoneWordmark team={leftEndZoneTeam} label={leftEndZoneTeam.name} side="left" />
      <EndZoneWordmark team={homeTeam} label={rightEndZoneLabel} side="right" />

      {YARD_LINES.map(yard => (
        <Box
          key={yard}
          sx={{
            position: 'absolute',
            left: `${yardToPercent(yard)}%`,
            top: 0,
            bottom: 0,
            width: '1px',
            transform: 'translateX(-50%)',
            backgroundColor: theme => alpha(theme.palette.common.white, 0.62),
            zIndex: 2,
          }}
        >
          <Typography
            component="span"
            sx={{
              position: 'absolute',
              top: 5,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'common.white',
              fontSize: { xs: '0.65rem', sm: '0.8rem' },
              fontWeight: 700,
            }}
          >
            {yard <= 50 ? yard : 100 - yard}
          </Typography>
        </Box>
      ))}

      {!neutralSite && (
        <Box
          component="img"
          src={`/logos/teams/${homeTeam.name}.png`}
          alt=""
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: { xs: 58, sm: 88, md: 110 },
            height: { xs: 58, sm: 88, md: 110 },
            transform: 'translate(-50%, -50%)',
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}

      {previousPlayYards !== 0 && (
        <Box
          aria-label={`Previous play: ${Math.abs(previousPlayYards)}-yard ${previousPlayYards > 0 ? 'gain' : 'loss'}`}
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: `${previousPlayLeft}%`,
              bottom: '18%',
              width: `${previousPlayWidth}%`,
              height: 3,
              borderRadius: 999,
              backgroundColor: theme => alpha(
                previousPlayYards > 0
                  ? theme.palette.success.light
                  : theme.palette.error.light,
                0.72,
              ),
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: `${previousPosition}%`,
              bottom: 'calc(18% - 2px)',
              width: 7,
              height: 7,
              transform: 'translateX(-50%)',
              border: '1px solid',
              borderColor: theme => alpha(theme.palette.common.white, 0.7),
              borderRadius: '50%',
              backgroundColor: previousPlayYards > 0 ? 'success.main' : 'error.main',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: `${ballPosition}%`,
              bottom: 'calc(18% - 3px)',
              width: 8,
              height: 9,
              transform: previousPlayMovesRight ? 'translateX(-100%)' : 'none',
              clipPath: previousPlayMovesRight
                ? 'polygon(0 0, 100% 50%, 0 100%)'
                : 'polygon(100% 0, 0 50%, 100% 100%)',
              backgroundColor: previousPlayYards > 0 ? 'success.main' : 'error.main',
            }}
          />
        </Box>
      )}

      <FieldLine left={yardToPercent(0)} color="common.white" />
      <FieldLine left={yardToPercent(100)} color="common.white" />
      <FieldLine left={ballPosition} color="primary.light" width={3} />
      <FieldLine left={firstDownPosition} color="warning.main" width={3} />

      <Box
        sx={{
          position: 'absolute',
          left: `${ballPosition}%`,
          top: '25%',
          minWidth: 48,
          px: 0.75,
          py: 0.25,
          transform: 'translate(-50%, -50%)',
          border: '1px solid',
          borderColor: theme => alpha(theme.palette.common.white, 0.5),
          borderRadius: 999,
          backgroundColor: theme => alpha(theme.palette.common.black, 0.72),
          color: 'common.white',
          textAlign: 'center',
          boxShadow: theme => `0 1px 3px ${alpha(theme.palette.common.black, 0.35)}`,
          zIndex: 6,
        }}
      >
        <Typography
          component="span"
          sx={{
            display: 'block',
            fontSize: { xs: '0.6rem', sm: '0.7rem' },
            lineHeight: 1.25,
            fontWeight: 700,
          }}
        >
          {formatDown(down)} &amp; {yardsToGo}
        </Typography>
      </Box>

      <Box
        component="img"
        src="/logos/football.png"
        alt=""
        sx={{
          position: 'absolute',
          left: `${ballPosition}%`,
          top: '50%',
          width: { xs: 20, sm: 26 },
          height: { xs: 20, sm: 26 },
          transform: 'translate(-50%, -50%)',
          objectFit: 'contain',
          zIndex: 7,
        }}
      />
    </Box>
  );
};

export default FootballField;
