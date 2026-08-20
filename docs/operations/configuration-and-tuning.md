# Configuration and Tuning

## Purpose

This document identifies the authoritative configuration surfaces, how they
enter runtime behavior, who may mutate them, and the verification risk of
changing them. Subsystem documents own the resulting product rules and
acceptance contracts.

## Configuration Ownership

| Surface | Authority | Runtime path | Mutation rule |
| --- | --- | --- | --- |
| Simulation tuning | `src/domain/sim/tuning.json` | Imported as `SIM_TUNING` by simulation modules | Deliberate tracked model change only |
| Next-season settings | `NextSeasonConfiguration` on `LeagueState` | Historical resolution and offseason commands | Stage-gated command in `realignment` |
| Recruiting and AI rules | `src/domain/recruiting/config.ts` | Pure recruiting engine and AI planners | Deliberate tracked product or balance change |
| Roster shape | `src/domain/rosterConfig.ts` | Bootstrap, recruiting, cuts, and starter selection | Deliberate tracked product change |
| Static-data cache epoch | `STATIC_DATA_VERSION` | `src/db/baseData.ts` | Increment once for a released public-data change |
| Persisted-schema epoch | `DB_VERSION` | `src/db/db.ts` | Increment with an exact current-schema change |

Production constants stay with the domain operation that owns their meaning.
Do not introduce a generic configuration registry, environment override, or
second source of truth.

## Runtime Flows

### Simulation

`src/domain/sim/config.ts` validates and exposes `SIM_TUNING`. Clock,
playcalling, concepts, defensive intent, outcomes, conversions, and kickoffs
read the relevant fields directly. The engine is stochastic, so tuning changes
must be evaluated over seeded samples rather than individual games.

Offline simulation commands reuse the production resolver. `eval:sim` audits
the committed model, `tune:sim` searches bounded candidates in memory,
`eval:sim-stability` measures held-out behavior and sensitivity, and
`generate:sim-benchmark` owns the external benchmark snapshot. None of the
evaluation or tuning commands rewrites `tuning.json` automatically.

[Simulation Calibration](../systems/simulation-calibration.md) owns metric
denominators, accepted values, hard gates, and benchmark refresh behavior.

### League topology

`DEFAULT_NEXT_SEASON_CONFIGURATION` initializes the fully required persisted
settings. The stage-gated update command accepts current user choices only in
`realignment`. Preview and advancement share the historical resolver for
`currentYear + 1`, and advancement verifies that the persisted settings still
match those used for calculation.

Supported postseason topology is 2, 4, or 12 teams. Twelve-team settings may
configure automatic bids and conference-champion top seeds; smaller formats
normalize those fields off. Historical source resolution may use the closest
bundled year when no exact year exists; that is current product behavior, not a
schema fallback.

[Season State Machine](../architecture/season-state-machine.md) owns transition
guards, and [Rankings, Playoff, and Awards](../systems/rankings-playoff-and-awards.md)
owns postseason behavior.

### Recruiting and rosters

Recruiting configuration separates locked product rules from values that may
be deliberately balance-tuned. Class scoring owns public class value;
recruiting configuration owns generation, interest, commitment, and AI
planning; roster configuration owns positional totals, roster capacity, and
starter requirements.

`eval:recruiting-balance` reads these current rules and runs repeated seasons in
memory. It never writes configuration, IndexedDB, or tracked data.

[Recruiting Model](../systems/recruiting-model.md) owns formulas and balance
expectations. [Roster and Recruiting Lifecycle](../systems/roster-and-recruiting.md)
owns persistence and annual flow.

### Static data

Static data is an architectural input rather than a tuning surface. Canonical
inputs, generated projections, ingestion, and cache invalidation are owned by
[Static Data System](../architecture/static-data.md). Any script that rewrites
tracked JSON is a model or data change requiring review of the resulting diff.

## Change Risk

| Change | Risk | Required handling |
| --- | --- | --- |
| Documentation-only correction | Low | Documentation integrity checks |
| One bounded tuning value | Medium | Targeted tests, typecheck, and relevant seeded audit |
| Cross-surface simulation tuning | High | Full simulation audit and stability review |
| Recruiting or roster balance | High | Recruiting evaluation and lifecycle scenarios |
| League/postseason topology | High | Lifecycle and 2/4/12 postseason scenarios |
| Persisted schema | High | Exact validators, repository tests, destructive epoch bump |
| Canonical or generated data | Medium–High | Static-data build/check and affected domain tests |

Use [Validation and Test Strategy](validation-and-test-strategy.md) to select
the concrete commands.

## Invariants

- Every active setting has one production owner.
- Evaluation commands do not silently accept or persist candidates.
- Persisted settings are fully required current-schema records.
- Schema evolution replaces the current epoch; it does not migrate old saves.
- Generated data changes only through its owning deterministic workflow.
- Missing or malformed input is an error, distinct from a valid product-level
  historical resolution.

## Source Map

- `src/domain/sim/config.ts`: simulation tuning boundary.
- `src/domain/recruiting/config.ts`: recruiting and AI rules.
- `src/domain/rosterConfig.ts`: roster shape.
- `src/types/league.ts`: next-season setting contract and defaults.
- `src/domain/league/commands/nextSeasonConfiguration.ts`: stage-gated settings
  command.
- `src/domain/league/historicalData.ts`: historical source resolution.
- `src/db/baseData.ts`: static-data cache epoch.
- `src/db/db.ts`: persisted-schema epoch.
- `package.json`: evaluation, tuning, generation, and verification commands.
