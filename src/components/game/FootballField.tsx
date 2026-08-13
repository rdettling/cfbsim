import { alpha, Box, Typography } from '@mui/material';

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
  yardsToGo: number;
};

const END_ZONE_YARDS = 10;
const TOTAL_FIELD_YARDS = 120;
const YARD_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90];

const clampYard = (yard: number) => Math.max(0, Math.min(100, yard));
const yardToPercent = (yard: number) =>
  ((END_ZONE_YARDS + clampYard(yard)) / TOTAL_FIELD_YARDS) * 100;

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
  yardsToGo,
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
        aspectRatio: '120 / 53',
        minHeight: 150,
        maxHeight: 310,
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

      <Box
        sx={{
          position: 'absolute',
          inset: '0 auto 0 0',
          width: `${(END_ZONE_YARDS / TOTAL_FIELD_YARDS) * 100}%`,
          display: 'grid',
          placeItems: 'center',
          backgroundColor: leftEndZoneTeam.colorPrimary || 'primary.dark',
          color: leftEndZoneTeam.colorSecondary || 'common.white',
        }}
      >
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1rem', sm: '1.3rem', md: '1.5rem' },
            transform: 'rotate(-90deg)',
            whiteSpace: 'nowrap',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {leftEndZoneTeam.name}
        </Typography>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          inset: '0 0 0 auto',
          width: `${(END_ZONE_YARDS / TOTAL_FIELD_YARDS) * 100}%`,
          display: 'grid',
          placeItems: 'center',
          backgroundColor: homeTeam.colorPrimary || 'primary.dark',
          color: homeTeam.colorSecondary || 'common.white',
        }}
      >
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1rem', sm: '1.3rem', md: '1.5rem' },
            transform: 'rotate(90deg)',
            whiteSpace: 'nowrap',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {rightEndZoneLabel}
        </Typography>
      </Box>

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

      <FieldLine left={yardToPercent(0)} color="common.white" />
      <FieldLine left={yardToPercent(100)} color="common.white" />
      <FieldLine left={ballPosition} color="primary.light" width={3} />
      <FieldLine left={firstDownPosition} color="warning.main" width={3} />

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
