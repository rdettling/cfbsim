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

`npm run tune:sim` runs the real resolver over three deterministic 200-game
equal-team seeds. It searches 13 bounded global controls from causal and
drive-consistency basins, prints a candidate, and always restores committed
tuning. It never writes `tuning.json`.

`npm run eval:sim-stability` regenerates that candidate, measures committed and
candidate tuning over five disjoint 1,000-game held-out blocks, and evaluates
all ±5% parameter perturbations on three shared 200-game seeds. Production and
rating gaps are findings; malformed data, invariants, nondeterminism, seed
overlap, or leaked tuning fail the command.

Team-rating preservation targets are:

| Rating difference | Win rate | Average margin |
|---:|---:|---:|
| 0 | 49.7% | — |
| +7 | 66.7% | 6.620 |
| +14 | 80.3% | 12.809 |
| +21 | 90.6% | 19.742 |

Win rates allow ±4 percentage points; positive margins allow ±2.5 points and
must remain strictly increasing by rating difference.

These are compatibility targets inherited from the established simulator, not
an empirical mapping from rating difference to modern FBS results. The frozen
national score and margin distributions include mixed real-world matchup
strength, but the current calibration does not construct a representative
mixed-rating slate or use those distributions as hard gates.

## Current Status

The holistic tuner candidate is adopted. The accepted simulation checksum is
`1b914e9a`, and the accepted representative news-content checksum is
`b2218e6b`. The default audit passes all hard gates.
The simulation checksum includes complete drive artifacts, so an intentional
persisted-record shape change advances it even when football metrics and random
sampling remain unchanged.

The 1,000-game equal-team comparison aligns 17 of 22 production metrics. It
reports five diagnostic gaps: red-zone touchdown rate is high; made field
goals, touchdowns, and passing yards per attempt/completion are low. The
five-block stability audit passes the unchanged rating-preservation tolerances;
changing the remaining controls still tends to exchange production gaps
instead of resolving them together.

This is an intentional good-enough baseline, not a claim of exact NCAA
reproduction. Further tuning should begin only in response to a concrete game
behavior problem or a deliberately refreshed benchmark cycle. Mixed-rating
calibration remains an optional future exercise rather than unfinished work.
