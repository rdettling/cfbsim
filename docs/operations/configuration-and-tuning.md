# Configuration and Tuning

## Purpose

Explains the active configuration and tuning surfaces that shape simulation behavior, what each surface controls, and how to change them safely.

## Configuration Surfaces

Configuration exists at four levels:

1. **Runtime sim tuning constants**: affect in-game behavior (clock, playcalling, outcomes, kickoffs).
2. **Next-season configuration**: affects season topology and lifecycle
   behavior.
3. **Recruiting configuration**: locked product rules and explicitly tunable
   balance defaults used by the pure recruiting engine and AI.
4. **Offline calibration/generation scripts**: produce or calibrate datasets/constants used by runtime.

The tuning model is intentionally stochastic: many mechanisms rely on probabilistic sampling (`Math.random` and Gaussian draws), so changes should be validated statistically, not by single-run outcomes.

## Data Flow

1. **Runtime tuning load path**
- `src/domain/sim/config.ts` imports `tuning.json` as `SIM_TUNING`.
- Sim modules (`clock`, `playcalling`, `outcomes`, `kickoffs`) read these values at execution time.

2. **League settings path**
- `DEFAULT_NEXT_SEASON_CONFIGURATION` defines new-league defaults.
- The fully required configuration is persisted directly on `LeagueState`.
  Upcoming-season topology is edited only in the stage-gated Next Season Setup
  flow.
- Next Season Setup and realignment advancement share one validated historical
  resolver. It targets `currentYear + 1`, uses an exact bundled year when
  available, otherwise uses the closest year, and identifies post-latest-year
  fallback as the historical frontier.
- Postseason week topology (`lastWeek`) is derived from playoff team count.

3. **Calibration script path**
- Tune/eval scripts run offline via npm scripts and can rewrite `tuning.json`.
- Generation scripts create data assets (odds/history) used by app runtime.

4. **Recruiting evaluation path**
- `src/domain/recruiting/config.ts` contains recruiting and AI constants.
- `src/domain/rosterConfig.ts` owns positional totals and derives the
  80-player final size, four-player allowance, and 84-player maximum.
- `src/domain/recruiting/classScoring.ts` owns the current fixed star values
  and class-depth curve; these are scoring behavior, not AI tuning.
- `eval:recruiting-balance` reads those constants and reports a fixed-seed
  repeated-season evaluation without rewriting them.
- Normal commitments require 55 interest and a 10-point lead. AI planning
  targets two oversignings.
- Annual supply is 32 five-stars, 340 four-stars, 2,800 three-stars, and
  200 two-stars.

## Controls

- **High-impact runtime controls (`tuning.json`)**:
  - `clock.*`: play durations, tempo multipliers, first-down/out-of-bounds stop windows.
  - `playcalling.*`: pass/run probability adjustments by situation.
  - `outcomes.*`: completion/sack/interception/fumble baselines, yardage scaling, field-goal probabilities.
  - `kickoffs.*`: touchback vs return behavior and starting field position distribution.
- **League topology controls (`NextSeasonConfiguration`)**:
  - `playoffTeams` determines postseason structure and `lastWeek`.
  - `playoffAutobids` and `conferenceChampionsReceiveTopSeeds` alter 12-team
    seeding.
  - `conferencePolicy` chooses historical conference membership or the current
    alignment.
  - `postseasonPolicy` chooses the historical format or a supported custom
    format.
- **Scripted calibration controls**:
  - `tune:yards` iteratively adjusts yard-distribution-related tuning fields.
  - `eval:winrate` measures win-rate and margin behavior under rating differentials.
  - `tune:winrate` adjusts differential scaling terms for target win-rate curve.
- **Recruiting controls**:
  - Locked rules include six rounds, the 25-player board, prestige budget
    table, meaningful-pursuit minimum, rating-range width, four-player
    oversign allowance, final roster size, and starter constraints.
  - Elite prospects blend 10% ordinary preference fit with 90% squared
    prestige fit. There is no prestige eligibility cutoff.
  - Potentially tunable defaults include commitment threshold and lead,
    initial-interest and linear point-effectiveness coefficients, and AI
    ranking, admission, and allocation constants.
  - The four-player oversign allowance is authoritative legality; the
    two-player AI target controls planning only.
  - Aggregate gates are evaluated independently from structural invariants.
    Signing Day share and low-prestige elite share are informational rather
    than hard gates. Evaluation never rewrites constants automatically.

## Invariants

- `SIM_TUNING` must satisfy the `SimTuning` type contract.
- Extreme tuning changes can destabilize downstream systems (rankings, postseason qualification realism) even when engine still runs.
- Playoff/team settings must remain consistent with postseason assumptions (2/4/12 supported topology).
- Next Season Setup accepts 0–10 automatic bids only for the 12-team format;
  2- and 4-team formats normalize automatic bids and champion top seeds off.
- New-league creation uses the same 0–10 automatic-bid range. Enabling
  conference champions as the top four seeds requires at least four automatic
  bids.
- Missing or malformed historical data is an error, distinct from a valid
  historical year with no conference or postseason changes.
- Configuration writes require the persisted `realignment` stage. Advancement
  compares the settings used for calculation with the persisted settings so a
  concurrent edit cannot produce a mixed transition.
- Any script that rewrites tracked JSON should be treated as a model change requiring regression review.
- Recruiting evaluation never writes IndexedDB, tracked JSON, or configuration.

## Risks

- Over-aggressive clock or playcalling tuning can produce unrealistic possession counts or score distributions.
- Outcome divisor miscalibration can collapse rating differentiation (too flat) or over-amplify favorites (too steep).
- Postseason setting combinations outside supported assumptions may produce confusing bracket expectations.
- Rewritten odds/history artifacts can drift from current sim behavior if not regenerated after major tuning shifts.

## Change Risk

| Change Type | Typical Risk | Recommended Handling |
|---|---|---|
| Documentation-only description updates | Low | No runtime validation needed |
| Small numeric tweak in one tuning subfield | Medium | Run typecheck + targeted eval script + scenario checks |
| Multi-surface tuning changes (clock + outcomes + playcalling) | High | Run full scenario matrix in validation doc |
| Playoff topology/automation default changes | High | Validate lifecycle + postseason scenarios for 2/4/12 |
| Regenerating odds/history data assets | Medium-High | Verify generated files align with current tuned behavior |

## Source Map

- Runtime tuning/config:
  - `src/domain/sim/tuning.json`
  - `src/domain/sim/config.ts` (`SIM_TUNING`, `applySimTuning`)
  - `src/domain/sim/clock.ts`, `playcalling.ts`, `outcomes.ts`, `kickoffs.ts`
- Recruiting tuning/evaluation:
  - `src/domain/recruiting/config.ts`
  - `src/domain/recruiting/classScoring.ts`
  - `src/domain/recruiting/evaluation.ts`
  - `scripts/eval_recruiting_balance.ts`
- League settings:
  - `src/types/league.ts` (`DEFAULT_NEXT_SEASON_CONFIGURATION`)
  - `src/domain/league/historicalData.ts` (historical source resolution)
  - `src/domain/league/nextSeasonPreview.ts` (side-effect-free preview)
  - `src/domain/league/nextSeasonConfiguration.ts` (validation and update
    command)
  - `src/domain/league/postseason.ts` (`getLastWeekByPlayoffTeams`)
  - `src/domain/league/offseason.ts` (policy-driven structural updates)
- Scripts and commands:
  - `package.json` scripts: `tune:yards`, `eval:winrate`, `tune:winrate`, `generate:odds`, `generate:history`, `check:data`, `typecheck`
  - `scripts/tune_yards.ts`, `scripts/eval_winrate.ts`, `scripts/tune_winrate.ts`, `scripts/generate_betting_odds.ts`, `scripts/generate_history.ts`, `scripts/check_data.ts`

## Historical Data Generation

`npm run generate:history` rebuilds `public/data/history.json` from the
repository's `public/data/years/` and `public/data/season-results/`
directories. The latest indexed year may omit a season-results file while its
season is still unplayed; generated history contains only completed seasons.
Every older indexed year must have matching completed results.

Use `npm run check:data` to validate the year index and schemas, metadata and
logo coverage, starting prestige against team bounds and the configured tier
distribution, season results, and the committed history asset without
rewriting it. Year prestige distributions may vary by at most three percentage
points per tier from `prestige_config.json`, preserving curated historical
snapshots while catching broad distribution drift. When public data assets
change, also increment `STATIC_DATA_VERSION` in `src/db/baseData.ts` so
existing installations discard stale cached copies.
