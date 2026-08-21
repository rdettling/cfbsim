# Program Prestige

This document owns the program-prestige calculation, its inputs, and its
annual persistence lifecycle. Prestige is an integer tier from 1 through 7;
higher numbers represent stronger programs.

## Sources and Bounds

The selected canonical season file supplies every program's starting prestige
when a league is created. Those embedded tiers are materialized by the shared
evaluator and are not manually tuned.

Each persisted team also carries the program floor and ceiling from
`public/data/teams.json`. The invariant is:

```text
1 <= floor <= prestige <= ceiling <= 7
```

The floor and ceiling limit the result for that program only. They never alter
league ordering, band sizes, or another program's raw tier. The target share
for each raw tier comes from `public/data/prestige_config.json`.

## Performance Windows

At the end of season `Y`, each usable final national rank is normalized for
the number of participating programs in that season:

```text
season score = 100 * (team count - final rank) / (team count - 1)
```

A one-team season receives a score of 100. The evaluator averages the
unrounded season scores and separately averages the final ranks. It uses every
available observation when fewer than four seasons exist; a missing finish is
not replaced with zero.

## Starting-Season Calculation

For starting season `Y`, the generator collects each active program's finishes
from `Y-4` through `Y-1`. If fewer than four prior finishes exist and `Y` has
completed results, it also includes the program's `Y` finish. This gives the
earliest seasons and new programs every available result without exceeding
four observations. A scheduled season cannot contribute its unfinished result.

The committed `results.rank` is the performance input. Its ordering puts the
final AP Top 25 first and orders position 26 onward by SRS. Each observation is
normalized with the complete team count from its own result season.

If a program has no prior or current result, its starting tier is the rounded
midpoint of its floor and ceiling. The generator then runs the same score,
league-band, tie-break, and bounds evaluation as dynamic prestige. It
materializes the result into the existing season topology without changing
conference membership, playoff configuration, or results.

`npm run generate:starting-prestige` audits without writing. `--check` fails
when a materialized value is stale, while `--write` stages and atomically
replaces the complete season directory.

## Dynamic Calculation

Season Summary presents two windows:

- before: `Y-4` through `Y-1`;
- after: `Y-3` through `Y`.

The after window alone determines the next prestige. A canonical history row
for `Y` is ignored during the preview and replaced by the current league's
authoritative final rank, so repeated loading produces the same projection.

## League-Relative Tier Assignment

Programs with an after-window score are sorted by the unrounded average score,
highest first. Equal scores are resolved by the current season's final rank,
then by canonical program name.

Raw tier bands are allocated from tier 7 down through tier 1. For each tier,
the cumulative configured percentage is multiplied by league size and rounded
to the nearest league position. The positions since the previous boundary
receive that tier; the final tier receives every remaining program. This
cumulative method supports zero-percent tiers and guarantees that every
program receives exactly one raw tier without rounding leftovers.

The evaluator then clamps each raw tier to that program's persisted floor and
ceiling. A program with no usable after-window finish preserves its current
clamped prestige. The complete bounded target is applied immediately; there is
no one-tier-per-season movement cap.

## Summary and Persistence Lifecycle

Season Summary is read-only. Its team projection derives:

- `next_prestige` and `prestige_change`;
- before/after four-year score;
- before/after average finish;
- before/after observation count.

These projection fields are not part of persisted `Team`. When the user leaves
Summary, the command recalculates the same targets from authoritative league,
history, and configuration records. In one transaction it archives the
completed season using the old prestige, applies each full target for the next
season, updates history, and advances the lifecycle. A stale or repeated
transition fails before any participating record is partially written.

The newly assigned prestige therefore affects the following offseason and
recruiting cycle, while the completed season permanently retains the prestige
under which it was played.

## Ownership

- `src/domain/league/prestige.ts` owns the pure evaluator and the history-to-
  observation adapter.
- `scripts/generate_starting_prestige.ts` owns starting-window observations,
  midpoint fallback, materialization, and the audit/check/write workflow.
- `src/domain/league/loaders/seasonSummary.ts` owns the read-only presentation
  projection.
- `src/domain/league/commands/stages.ts` owns recalculation and atomic annual
  application.
- `src/db/leagueStateValidation.ts` and `src/db/seasonMemoryRepo.ts` own the
  persisted tier-range invariants.

The pure evaluator accepts program bounds, finish observations with team
counts, and the tier distribution. Starting and dynamic adapters supply their
respective lifecycle windows to that one evaluator.
