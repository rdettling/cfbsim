import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import {
  CONCEPT_LABELS,
  PASS_CONCEPTS,
  RUN_CONCEPTS,
} from '../../domain/sim/concepts';
import {
  DEFENSIVE_INTENTS,
  DEFENSIVE_INTENT_LABELS,
} from '../../domain/sim/defensiveIntents';
import type {
  SimulationDecision,
  SimulationDecisionPrompt,
} from './gameSimTypes';

type GameSimDecisionControlsProps = {
  decisionPrompt: SimulationDecisionPrompt | null;
  disabled: boolean;
  onDecision: (decision: SimulationDecision) => void;
};

const ChoiceGroup = ({
  label,
  ariaLabel,
  icon,
  children,
  singleLine = false,
  secondary = false,
}: {
  label: string;
  ariaLabel: string;
  icon?: ReactNode;
  children: ReactNode;
  singleLine?: boolean;
  secondary?: boolean;
}) => (
  <Stack
    spacing={{ xs: 0.6, lg: 0.35 }}
    role="group"
    aria-label={ariaLabel}
    sx={{
      gridColumn: { lg: secondary ? '1 / -1' : 'auto' },
      flexDirection: { lg: 'row' },
      alignItems: { lg: 'center' },
      gap: { lg: 0.5 },
      minWidth: 0,
    }}
  >
    <Typography
      variant="caption"
      sx={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: 'text.secondary' }}
    >
      {icon}{label}
    </Typography>
    <Stack
      direction="row"
      spacing={singleLine ? 0.5 : 0.75}
      useFlexGap
      sx={{
        flex: { lg: 1 },
        minWidth: 0,
        flexWrap: singleLine ? 'nowrap' : 'wrap',
        '& .MuiButton-root': {
          minHeight: { lg: 30 },
          py: { lg: 0.25 },
          px: { lg: 0.75 },
          lineHeight: { lg: 1.35 },
        },
        ...(singleLine && {
          '& .MuiButton-root': {
            minWidth: 0,
            flex: '1 1 auto',
            px: { xs: 0.65, lg: 0.5 },
            minHeight: { lg: 30 },
            py: { lg: 0.25 },
            lineHeight: { lg: 1.35 },
            whiteSpace: 'nowrap',
          },
        }),
      }}
    >
      {children}
    </Stack>
  </Stack>
);

const GameSimDecisionControls = ({
  decisionPrompt,
  disabled,
  onDecision,
}: GameSimDecisionControlsProps) => {
  const isTry = decisionPrompt?.type === 'try';
  const showDecisionHeading = !decisionPrompt || (isTry && decisionPrompt.side === 'defense');

  return (
    <Box
      component="section"
      aria-label="Current decision"
      sx={{
        p: { xs: 1.25, sm: 1.5, lg: 1 },
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'action.hover',
      }}
    >
      <Stack
        spacing={{ xs: 1.25, lg: 0 }}
        sx={{
          display: { lg: 'grid' },
          gridTemplateColumns: {
            lg: showDecisionHeading
              ? 'minmax(175px, 0.55fr) minmax(0, 2fr)'
              : 'minmax(0, 1fr)',
          },
          alignItems: { lg: 'center' },
          columnGap: { lg: 1.25 },
          rowGap: { lg: 0.75 },
        }}
      >
        {showDecisionHeading && (
          <Box>
            <Typography
              variant="h6"
              sx={{ fontSize: { lg: '1rem' }, lineHeight: { lg: 1.25 } }}
            >
              {decisionPrompt?.side === 'defense'
                ? 'Defend the two-point try'
                : 'No call required'}
            </Typography>
          </Box>
        )}

        {decisionPrompt?.side === 'offense' && (
          <Stack
            spacing={{ xs: 1.1, lg: 0 }}
            aria-label="Offensive play calls"
            sx={{
              display: { lg: 'grid' },
              gridTemplateColumns: { lg: 'minmax(205px, 0.65fr) minmax(0, 1.35fr)' },
              alignItems: { lg: 'end' },
              gap: { lg: 0.75 },
              minWidth: 0,
            }}
          >
            <ChoiceGroup
              label="Run"
              ariaLabel="Run play calls"
              icon={<DirectionsRunIcon sx={{ mr: 0.5, fontSize: 17 }} />}
            >
              {RUN_CONCEPTS.map(concept => (
                <Button
                  key={concept}
                  variant="outlined"
                  size="small"
                  disabled={disabled}
                  onClick={() => onDecision(isTry
                    ? { kind: 'try_offense', concept }
                    : { kind: 'offense', concept })}
                >
                  {CONCEPT_LABELS[concept]}
                </Button>
              ))}
            </ChoiceGroup>
            <ChoiceGroup
              label="Pass"
              ariaLabel="Pass play calls"
              icon={<SportsFootballIcon sx={{ mr: 0.5, fontSize: 17 }} />}
              singleLine
            >
              {PASS_CONCEPTS.map(concept => (
                <Button
                  key={concept}
                  variant="outlined"
                  size="small"
                  disabled={disabled}
                  onClick={() => onDecision(isTry
                    ? { kind: 'try_offense', concept }
                    : { kind: 'offense', concept })}
                >
                  {CONCEPT_LABELS[concept]}
                </Button>
              ))}
            </ChoiceGroup>
            {decisionPrompt.type === 'fourth_down' && (
              <ChoiceGroup
                label="Special teams"
                ariaLabel="Special teams calls"
                secondary
              >
                <Button
                  variant="outlined"
                  size="small"
                  disabled={disabled}
                  onClick={() => onDecision({ kind: 'special_teams', concept: 'punt' })}
                >
                  Punt
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={disabled}
                  onClick={() => onDecision({ kind: 'special_teams', concept: 'field_goal' })}
                >
                  Field Goal
                </Button>
              </ChoiceGroup>
            )}
            {isTry && decisionPrompt.allowExtraPoint && (
              <ChoiceGroup label="Kick" ariaLabel="Kick calls" secondary>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={disabled}
                  onClick={() => onDecision({ kind: 'try', attempt: 'extra_point' })}
                >
                  Kick Extra Point
                </Button>
              </ChoiceGroup>
            )}
          </Stack>
        )}

        {decisionPrompt?.side === 'defense' && (
          <ChoiceGroup label="Defensive intent" ariaLabel="Defensive intent calls">
            {DEFENSIVE_INTENTS.map(intent => (
              <Button
                key={intent}
                variant="outlined"
                size="small"
                disabled={disabled}
                onClick={() => onDecision(isTry
                  ? { kind: 'try_defense', intent }
                  : { kind: 'defense', intent })}
              >
                {DEFENSIVE_INTENT_LABELS[intent]}
              </Button>
            ))}
          </ChoiceGroup>
        )}
      </Stack>
    </Box>
  );
};

export default GameSimDecisionControls;
