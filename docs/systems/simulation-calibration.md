# Simulation Calibration

## Purpose

Defines the frozen modern-FBS benchmark, metric denominators, and accepted
runtime comparison contract. Production, score, and margin misses remain
visible diagnostics; replay, state, football relationships, and rating
authority are the hard `eval:sim` gates.

## Frozen Reference

The benchmark pools completed 2023, 2024, and 2025 FBS seasons. Team production
comes from NCAA team-statistics tables. Score distributions use final
FBS-versus-FBS scoreboard contests deduplicated by contest ID.

Field-goal accuracy comes from 429 qualified-kicker rows in the NCAA Field
Goals Per Game tables: 5,745 makes in 7,483 attempts (`76.77%`). Those rows
cover 94.8% of field goals in the complete team-scoring tables, so accuracy is
authoritative but their attempt count is not a volume target.

The compact tracked snapshot represents 5,083 FBS team-games and 2,329
FBS-versus-FBS games. It stores aggregate targets, sample metadata, source
templates, and normalized source checksum `01fba155`; raw NCAA rows and games
are not tracked.

`npm run generate:sim-benchmark` refreshes the snapshot from the network.
`npm run generate:sim-benchmark -- --check` regenerates it in memory and
compares it without writing. Routine simulation audits are offline.

## Metric Denominators

- Scrimmage snaps include runs, pass attempts, sacks, spikes, and kneels. They
  exclude punts, field goals, and tries.
- Completion rate uses pass attempts excluding sacks. Sack rate uses all
  dropbacks. Interception rate uses pass attempts.
- NCAA rushing totals include sacks, so comparable rushing average includes
  sack attempts and losses even though pass share treats sacks as dropbacks.
- Offensive yards and yards per play include every scrimmage result and
  exclude special teams and tries.
- A red-zone trip begins when a drive first snaps from the opponent's 20 or
  closer. A touchdown or made field goal is a score; a touchdown is a touchdown
  trip.
- Third- and fourth-down conversions use pre-snap yards to go. Attempt volume
  is combined team attempts per game.
- Turnovers are interceptions plus lost fumbles. The current model makes every
  fumble a lost fumble.

## Production Targets

| Metric | Target |
|---|---:|
| Scrimmage snaps | 133.697 |
| Offensive yards / yards per play | 771.197 / 5.768 |
| Offensive touchdowns | 6.557 |
| Punts / made field goals | 8.179 / 2.384 |
| Field-goal make rate | 76.77% |
| Turnovers / lost fumbles | 2.685 / 1.080 |
| Pass-play share | 49.00% |
| Completion / sack / interception | 61.75% / 6.14% / 2.61% |
| Rush average | 4.393 |
| Pass yards per attempt / completion | 7.383 / 11.957 |
| Third-down attempts / conversion | 26.971 / 40.04% |
| Fourth-down attempts / conversion | 3.872 / 53.39% |
| Red-zone scoring / touchdown | 84.01% / 61.85% |

Production volume and efficiency use ±5% tolerances. Punts, turnovers, lost
fumbles, and made field goals use ±10%. Rate tolerances are stored explicitly
in the snapshot: pass share, completion, and third downs use ±2 percentage
points; fourth downs and red-zone rates use ±3; sack rate uses ±1; interception
and field-goal make rates use ±0.5 and ±3 points respectively.

The FBS-versus-FBS scoring reference is 53.126 combined points with standard
deviation 16.740 and P10/P25/P50/P75/P90/P95 of 33/41/52/64/75/83. Margin mean
and deviation are 16.304/12.802 with P25/P50/P75/P90/P95 of 6/14/24/34/41.
These reflect real matchup-strength variation and are not direct equal-team
acceptance gates.

## Commands and Acceptance

`npm run eval:sim` is the authoritative single-seed audit. Its default uses
seed `20260809`, 1,000 games at rating differences 0/7/14/21, and exact state,
relationship, rating, and replay gates while reporting production comparisons.
Passing `--rating-differences` with unique comma-separated gaps from `-74`
through `74` runs the same resolver as a diagnostic response grid without
applying or replacing the default checksum baseline. Each gap reports both
teams' yards per play, points per drive, completion rate, sack rate, turnover
rate, explosive-play rate, scoring distribution, win rate, and margin. Extreme
gaps shift the two valid 25–99 team ratings while preserving the requested
difference.

`npm run eval:box-scores` runs the shared production season corpus and measures
every regular-season game across three deterministic roster-and-schedule seeds
by default. It uses the same drive collector and frozen benchmark as
`eval:sim`, but its natural mix of team strengths makes national score and
margin distributions meaningful. It reports pooled metrics, seed-block
variation, and findings grouped as pace, play mix, base efficiency,
explosiveness, turnovers, downs, finishing, kicking, and score distribution.
Structural incompleteness or invalid field position fails the command;
calibration gaps remain diagnostic and do not replace any accepted evaluator.

`npm run eval:season-balance` is the authoritative full-season competitive-
balance audit. It runs production roster generation, scheduling, game
simulation, record updates, and Week 14 rankings through the shared offline
season corpus. Rankings define the reported Top 5, Top 10, and Top 25 cohorts;
their ordering is an independent product result. Every ranked-cohort record
range remains diagnostic so ranking order cannot become an indirect tuning
control. Ranking-independent undefeated and clean-record metrics are the hard
elite-season gates.

The command supports `smoke`, `iterate`, and `acceptance` profiles containing
1, 10, and 40 independently generated seasons. Acceptance also replays one
seed. Structural or replay failures exit `1`; balance gaps are diagnostic in
smoke and iterate, while acceptance gaps exit `2` with `needs_tuning`.

Season-level elite-balance targets intentionally sit between the committed
model and bundled FBS-only history because every simulated team plays twelve
FBS opponents. The modern comparison uses completed 2022, 2023, and 2025,
the available post-NIL non-COVID seasons with bundled game history. Those
seasons average `11.23` FBS games per eligible team, `2.33` undefeated teams,
`7.0` zero-or-one-loss teams, and `0.80` Top 5 losses. Scaling each ranked
team's loss pace to twelve FBS games raises the Top 5 figure only to `0.83`.
The acceptance ranges therefore already allow materially more elite attrition
than the modern reference and should not be loosened in response to conference
consolidation or NIL:

| Metric | Accepted range |
|---|---:|
| Undefeated teams / season | 0.9–1.6 |
| Seasons with no undefeated team | 0–35% |
| Teams with zero or one loss | 5.0–6.5 |
| Top 5 average losses (diagnostic) | 1.1–1.45 |

Top 10 average losses of `1.6–1.9` and Top 25 average losses of `2.4–2.7` are
also contextual diagnostics rather than acceptance gates. This separation
prevents a preferred independent ranking philosophy from forcing unrelated
simulation changes.

The strongest preseason team's schedule-implied expected losses are reported
against an intended `1.0–1.5` range but remain diagnostic. The No. 1 loss
distribution is also diagnostic so the evaluation cannot prescribe ranking
behavior. The audit also reports odds-implied undefeated and clean-team counts
plus Prestige 7 rating mean, rating deviation, loss mean, loss deviation, and
clean-team share. These distinguish schedule difficulty from realized results
and tier averages from within-tier roster-cycle dispersion. Representative-
season margin mean, deviation, and P25/P50/P75/P90 must retain the frozen
score-distribution tolerances above.

The historical report also retains the broader 2014–2025 non-COVID reference
and per-season rows. Historical undefeated and zero-or-one-loss counts are raw
upper context because extra FBS games can only remove teams from those groups.
Ranked-loss twelve-game equivalents are computed per team as
`losses * 12 / FBS games`. Historical ranked cohorts use the bundled final
ranking and remain contextual; they never evaluate or constrain the app's
Week 14 ranking calculation.

`npm run tune:sim` runs the real resolver over three deterministic 200-game
equal-team seeds. It searches 13 bounded global controls from causal and
drive-consistency basins, groups them by calibration stage, and prints the two
refined finalists as a shortlist with the best candidate first. It always
restores committed tuning and never writes `tuning.json`.

`npm run eval:sim-stability` regenerates that candidate, measures committed and
candidate tuning over five disjoint 1,000-game held-out blocks, and evaluates
all ±5% parameter perturbations on three shared 200-game seeds. Each parameter
is labeled with the same causal stage used by the tuner. Production and rating
gaps are findings; malformed data, invariants, nondeterminism, seed overlap, or
leaked tuning fail the command.

Team-rating preservation targets are:

| Rating difference | Win rate | Average margin |
|---:|---:|---:|
| 0 | 49.7% | — |
| +7 | 66.7% | 6.620 |
| +14 | 80.3% | 12.809 |
| +21 | 90.6% | 19.742 |

Win rates allow ±4 percentage points; positive margins allow ±2.5 points and
must remain strictly increasing by rating difference.

These are behavioral regression baselines for the current rating model, not an
empirical mapping from rating difference to modern FBS results. Their win-rate
and margin tolerances are calibration acceptance bands. The representative
box-score corpus supplies the mixed-rating comparison needed to interpret the
frozen national score and margin distributions, but it does not turn those
diagnostics into hard gates.

## Calibration Order

Interpret candidate changes in causal order: pace, play mix, base efficiency,
explosiveness, turnovers, downs, finishing, kicking, and finally the resulting
score distribution. Re-measure downstream groups after an upstream change
because their totals depend on it. A candidate advances only through the
equal-team production audit, representative box-score corpus, rating-response
audit, and existing season-balance acceptance; a local box-score improvement
never justifies loosening another evaluator.

### Extended Rating Response

The diagnostic response grid uses the same resolver without turning granular
gap results into new acceptance targets. A 1,000-game-per-gap audit at seed
`20260809` produced checksum `2314ea43` and the following positive-gap results:

| Rating gap | Stronger YPP | Weaker YPP | YPP difference | Stronger win rate | Average margin |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 5.48 | 5.55 | -0.07 | 52.0% | 0.09 |
| +7 | 5.83 | 5.25 | 0.59 | 69.8% | 7.43 |
| +14 | 6.10 | 4.93 | 1.16 | 82.2% | 13.67 |
| +21 | 6.33 | 4.60 | 1.73 | 89.4% | 18.90 |
| +28 | 6.68 | 4.30 | 2.38 | 96.4% | 26.73 |
| +35 | 7.04 | 4.01 | 3.04 | 98.9% | 33.69 |

The signed negative gaps closely mirror the positive response. The smooth YPP
separation and nonzero extreme upset rate are current product findings, not
granular win-probability promises. Full-season competitive balance remains the
authoritative outcome-level contract.

## Accepted Baseline

The current runtime tuning is the accepted baseline. The simulation checksum
is `c26ef84f`, and the default audit passes all hard gates.
The simulation checksum includes complete drive artifacts, so an intentional
persisted-record shape change advances it even when football metrics and random
sampling remain unchanged.

This is an intentional good-enough baseline, not a claim of exact NCAA
reproduction. Production differences remain visible diagnostics rather than
release failures. Change the baseline only for a concrete game-behavior problem
or a deliberate benchmark refresh, with the stability audit preserving the
rating-model acceptance bands.

A fixed-seed roster comparison found that 112 of 138 programs (`81.1594%`)
have at least one upperclass prestige different from their current tier. The
historical-class model produces the intended roster lag: rising programs carry
weaker older classes, declining programs retain stronger older classes, and
freshmen remain identical to a current-prestige control.

The accepted player, roster, global team-strength, and game-pace model passes the
40-season `eval:season-balance -- --profile acceptance` baseline with checksum
`31f3e57a`. Its deterministic replay matches (`117a67f4`), and it has no
structural violations. The observed elite-season metrics are `1.4` undefeated
teams per season, `22.5%` of seasons without an undefeated team, and `5.9`
zero-or-one-loss teams per season. Ranked-record diagnostics report `1.15`
Top 5 losses, `1.625` Top 10 losses, and `2.72` Top 25 losses. Only the Top
25 value remains modestly above its contextual range. The strongest preseason
team averages `1.4` actual losses and `1.687975` schedule-implied expected
losses.

National margins remain inside every frozen guardrail: mean `15.702446`,
standard deviation `12.37504`, and P25/P50/P75/P90 of `6`, `13`, `22`, and
`33`. Two frozen-formula held-out 40-season families also pass with checksums
`9f895e2e` and `f925bf0e`. Across the standard and held-out families, the 120
seasons average `1.316667` undefeated teams, a `24.1667%` no-undefeated share,
`5.891667` zero-or-one-loss teams, a `15.669394` margin mean, and a `12.404107`
margin standard deviation.

The three-seed representative box-score corpus passes every frozen national
score-distribution tolerance with checksum `8022e041`. Combined scoring is
`51.1264` with standard deviation `16.3418` and P10/P25/P50/P75/P90/P95 of
`31/39/50/62/73/79`. Its only production findings are slightly high lost
fumbles and red-zone touchdown rate; both remain diagnostic.

The representative recruiting evaluation remains structurally valid and
exactly reproducible with checksum `184d5057`. Base capacity and per-team
capacity pass; walk-ons are `0.20098` per team-season against a `0.2` ceiling.
The `30.2696%` prestige-mobility finding is deferred to the separate
prestige-model pass rather than treated as a roster or simulation tuning
control. These remaining findings do not justify looser evaluator targets,
rating noise, ranking changes, or another outcome modifier.
