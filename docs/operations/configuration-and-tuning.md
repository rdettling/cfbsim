# Configuration and Tuning

## Scope

Explains the active configuration and tuning surfaces that shape simulation behavior, what each surface controls, and how to change them safely.

## System Model

Configuration exists at three levels:

1. **Runtime sim tuning constants**: affect in-game behavior (clock, playcalling, outcomes, kickoffs).
2. **League settings**: affect season topology and lifecycle behavior (playoff format, realignment automation).
3. **Offline calibration/generation scripts**: produce or calibrate datasets/constants used by runtime.

The tuning model is intentionally stochastic: many mechanisms rely on probabilistic sampling (`Math.random` and Gaussian draws), so changes should be validated statistically, not by single-run outcomes.

## Execution Flow

1. **Runtime tuning load path**
- `src/domain/sim/config.ts` imports `tuning.json` as `SIM_TUNING`.
- Sim modules (`clock`, `playcalling`, `outcomes`, `kickoffs`) read these values at execution time.

2. **League settings path**
- `DEFAULT_SETTINGS` defines baseline playoff/realignment behavior.
- Settings are initialized/normalized during league creation/load and can be updated in settings/realignment flows.
- Postseason week topology (`lastWeek`) is derived from playoff team count.

3. **Calibration script path**
- Tune/eval scripts run offline via npm scripts and can rewrite `tuning.json`.
- Generation scripts create data assets (odds/history) used by app runtime.

## Key Mechanics

- **High-impact runtime controls (`tuning.json`)**:
  - `clock.*`: play durations, tempo multipliers, first-down/out-of-bounds stop windows.
  - `playcalling.*`: pass/run probability adjustments by situation.
  - `outcomes.*`: completion/sack/interception/fumble baselines, yardage scaling, field-goal probabilities.
  - `kickoffs.*`: touchback vs return behavior and starting field position distribution.
- **League topology controls (`Settings`)**:
  - `playoff_teams` determines postseason structure and `lastWeek` horizon.
  - `playoff_autobids` and `playoff_conf_champ_top_4` alter 12-team seeding behavior.
  - `auto_realignment` and `auto_update_postseason_format` shape offseason automatic changes.
- **Scripted calibration controls**:
  - `tune:yards` iteratively adjusts yard-distribution-related tuning fields.
  - `eval:winrate` measures win-rate and margin behavior under rating differentials.
  - `tune:winrate` adjusts differential scaling terms for target win-rate curve.

## Invariants and Constraints

- `SIM_TUNING` shape must remain compatible with `SimTuning` type contract.
- Extreme tuning changes can destabilize downstream systems (rankings, postseason qualification realism) even when engine still runs.
- Playoff/team settings must remain consistent with postseason assumptions (2/4/12 supported topology).
- Any script that rewrites tracked JSON should be treated as a model change requiring regression review.

## Failure/Edge Cases

- Over-aggressive clock or playcalling tuning can produce unrealistic possession counts or score distributions.
- Outcome divisor miscalibration can collapse rating differentiation (too flat) or over-amplify favorites (too steep).
- Postseason setting combinations outside supported assumptions may produce confusing bracket expectations.
- Rewritten odds/history artifacts can drift from current sim behavior if not regenerated after major tuning shifts.

## What You Can Observe in the App

- Clock/tempo tuning changes alter game pace and number of drives.
- Outcome tuning changes alter yardage distributions, scoring frequency, and upset rates.
- Playoff setting changes alter season length, postseason rounds, and ranking freeze behavior.
- Realignment/postseason auto-update settings alter offseason structural evolution over years.

## Safe vs Behavior-Shifting Changes

| Change Type | Typical Risk | Recommended Handling |
|---|---|---|
| Documentation-only description updates | Low | No runtime validation needed |
| Small numeric tweak in one tuning subfield | Medium | Run typecheck + targeted eval script + scenario checks |
| Multi-surface tuning changes (clock + outcomes + playcalling) | High | Run full scenario matrix in validation doc |
| Playoff topology/automation default changes | High | Validate lifecycle + postseason scenarios for 2/4/12 |
| Regenerating odds/history data assets | Medium-High | Verify generated files align with current tuned behavior |

## Source Map (file/function references)

- Runtime tuning/config:
  - `src/domain/sim/tuning.json`
  - `src/domain/sim/config.ts` (`SIM_TUNING`, `applySimTuning`)
  - `src/domain/sim/clock.ts`, `playcalling.ts`, `outcomes.ts`, `kickoffs.ts`
- League settings:
  - `src/types/league.ts` (`DEFAULT_SETTINGS`, `ensureSettings`)
  - `src/domain/league/postseason.ts` (`getLastWeekByPlayoffTeams`, postseason state normalization)
  - `src/domain/league/offseason.ts` (auto realignment/postseason updates)
- Scripts and commands:
  - `package.json` scripts: `tune:yards`, `eval:winrate`, `tune:winrate`, `generate:odds`, `generate:history`, `typecheck`
  - `scripts/tune_yards.ts`, `scripts/eval_winrate.ts`, `scripts/tune_winrate.ts`, `scripts/generate_betting_odds.ts`, `scripts/generate_history.ts`
