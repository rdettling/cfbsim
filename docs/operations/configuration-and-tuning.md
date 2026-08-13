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
- Tune/eval scripts run offline via npm scripts. The simulation tuner applies
  candidates only inside its process and never rewrites `tuning.json`.
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

5. **League-news editorial evaluation path**
- `eval:news` runs seeded production schedules and game simulation entirely in
  memory, then writes untracked JSON, JSONL, and Markdown audit artifacts.
- Structural, factual, and replay failures fail the command. Copy repetition,
  angle mix, ranking language, player-position balance, and feed concentration
  remain warning-only diagnostics until an editorial baseline is approved.
- Editorial traces expose verified facts and copy-selection decisions but are
  never persisted in `newsItems` or returned by product loaders.

## Controls

- **High-impact runtime controls (`tuning.json`)**:
  - `conversions.*`: the calibrated fixed 95.5% extra-point probability and the
    automatic late-game two-point decision window/margins. Two-point football
    outcomes continue to use the existing rating/concept/intent model.
  - `defense.*`: automatic intent mixtures, situational multipliers, and the
    explicit defensive-intent/offensive-concept matchup matrix.
  - `concepts.*`: automatic mixtures, situational multipliers, and per-concept
    rate/yardage profiles.
  - `clock.*`: live-ball/runoff ranges, tempo multipliers, out-of-bounds rates,
    first-down/out-of-bounds stop windows, and automatic timeout/spike/kneel
    thresholds.
  - `playcalling.*`: pass/run probability adjustments by situation and the
    fixed field-position/distance thresholds for automatic fourth downs.
  - `outcomes.*`: completion/sack/interception/fumble baselines, yardage
    scaling, the positive-gain-only third-down and red-zone controls, and the
    fixed field-goal curve/accuracy multiplier.
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
  - `eval:sim` is the authoritative read-only simulation audit. It verifies a
    seeded replay checksum, state invariants, rating-difference win rates, and
    aggregate game-balance, offensive-concept, defensive-matchup, causal-clock,
    clock-management, conversion, and overtime-scoring gates without rewriting
    tuning or persisted data. Modern-FBS production and score-distribution
    gaps from the frozen 2023–25 benchmark remain visible diagnostics rather
    than hard failures.
  - `generate:sim-benchmark` is the only benchmark refresh path. It writes the
    compact tracked aggregate when run normally; `--check` compares the
    committed snapshot to current NCAA sources without writing.
  - `tune:sim` runs deterministic full-game coordinate searches from causal and
    drive-consistency seeds over 13 approved play-share, execution, yardage,
    third-down, red-zone, and field-goal-accuracy controls. It prints the baseline,
    candidate, exact parameter changes, and remaining gaps but never writes
    tracked state.
  - `eval:sim-stability` regenerates that candidate in memory, measures
    committed and candidate tuning over five disjoint held-out rating blocks,
    and produces a common-seed ±5% sensitivity matrix for all 13 controls and
    22 production metrics. It is a long-running offline diagnostic and does
    not change the current acceptance contract.
  - Benchmark schema 3 defines 22 production comparisons, including combined
    third- and fourth-down attempt volume. The adopted modern-FBS baseline is
    intentionally close rather than overfit; the accepted runtime checksum is
    `66ccddc7`.
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
  - `src/domain/sim/config.ts` (`SIM_TUNING`, `withSimTuning`)
  - `src/domain/sim/clock.ts`, `playcalling.ts`, `outcomes.ts`, `kickoffs.ts`
  - `src/domain/sim/calibrationMetrics.ts`, `evaluationAudit.ts`, and
    `stabilityStatistics.ts` (shared diagnostic calculations and gates)
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
  - `package.json` scripts: `eval:sim`, `eval:sim-stability`, `tune:sim`,
    `generate:sim-benchmark`, `eval:news`,
    `data:build`, `data:check`, `typecheck`
  - `scripts/eval_sim.ts`, `scripts/eval_sim_stability.ts`, `scripts/tune_sim.ts`,
    `scripts/generate_sim_benchmark.ts`,
    `scripts/eval_news.ts`, `scripts/data_build.ts`,
    `scripts/data_check.ts`

See [Simulation Calibration](../systems/simulation-calibration.md) for the
source methodology, metric denominators, targets, and diagnostic tolerances.

## League News Editorial Evaluation

Production news template version 3 treats only ranks 1–25 as reader-facing
rankings. Its trace distinguishes major underdog wins from material poll
upsets, requires an explicit exceptional-performance qualifier for featured
players, and preserves named postseason identity ahead of supporting context.
Version 3 also uses typed headline and deck syntax metadata, complementary deck
selection, and contextual score placement. These are structural editorial
invariants rather than tunable audit settings.

Newsworthiness is the sum of three typed dimensions. Consequence contains the
existing game-type bases. National relevance adds 12 points for a best
participant rank of 1–5, 9 for 6–10, 6 for 11–15, and 3 for 16–25, plus 4 when
both teams are ranked; rivalry and exceptional-player bonuses also live in this
dimension. Drama contains the existing upset, overtime, late-finish, comeback,
shutout, and decisive-margin bonuses. Rankings are frozen at game time.
Program prestige and user-team identity are not scoring inputs.

The default smoke run is one seed and one season. The representative audit is
three seeds, two seasons per seed, and one replayed seed:

```text
npm run eval:news -- --seed 20260809 --seeds 3 --seasons 2 --replay-seeds 1
```

The command writes only `.artifacts/news-audit/summary.json`,
`stories.jsonl`, and `review.md`. The directory is ignored by Git. It does not
write IndexedDB, runtime configuration, static data, or story templates.

`summary.json` reports a full corpus checksum, a `newsItemChecksum`, a
`newsContentChecksum`, and an `editorialOutcomeChecksum`. The content checksum
excludes only importance, allowing scoring work to prove that copy, angles,
storylines, teams, and featured players did not drift. The committed version 3
content baseline is `b2218e6b`; the accepted representative audit has zero
structural or factual violations.

## Static Data

Static data is an architectural input, not a simulation tuning surface. See
[Static Data System](../architecture/static-data.md) for canonical and
generated ownership, file contracts, deterministic build and check behavior,
CFBD ingestion, runtime validation and caching, and the complete season-update
workflow.
