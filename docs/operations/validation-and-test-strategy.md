# Validation and Test Strategy

## Purpose

This document owns repository-wide verification: common gates, statistical
principles, change-to-check selection, and cross-system scenarios. Subsystem
documents own their exact product invariants and accepted baselines.

## Common Gates

| Command | Contract |
| --- | --- |
| `npm test` | Deterministic unit, integration, repository, and loader behavior |
| `npm run typecheck` | Strict application and script contracts |
| `npm run build` | Production module graph and bundling |
| `npm run data:check` | Exact canonical/generated static-data agreement |
| `git diff --check` | Patch whitespace and conflict-marker hygiene |

The complete offline repository check is:

```text
npm run data:check
npm test
npm run typecheck
npm run build
git diff --check
```

Run the checks appropriate to the changed behavior during development. Run the
complete sequence before accepting a broad or cross-system change.

## Statistical and Generated-System Checks

Seeded replay must be exact, while behavioral credibility requires aggregate
samples. Do not treat one stochastic game or season as evidence. Structural,
state, identity, and reproducibility failures are hard errors; distribution
findings may remain diagnostic when the owning subsystem document says so.

| Command | Use |
| --- | --- |
| `npm run eval:sim` | Simulation state, football relationships, rating authority, production diagnostics, and replay |
| `npm run eval:sim-stability` | Held-out tuning stability and parameter sensitivity |
| `npm run tune:sim` | Bounded in-memory candidate search; never automatic acceptance |
| `npm run generate:sim-benchmark -- --check` | Network-backed benchmark regeneration without writes |
| `npm run eval:recruiting-balance -- --seed 20260727 --seeds 3 --seasons 4 --replay-seeds 1` | Representative multi-season recruiting balance and replay |
| `npm run eval:news -- --seed 20260809 --seeds 3 --seasons 2 --replay-seeds 1` | Representative factual, structural, editorial, and replay audit |
| `npm run eval:awards` | Awards scoring and evaluation report |

Use the owning system document for accepted values and failure semantics:
[Simulation Calibration](../systems/simulation-calibration.md),
[Recruiting Model](../systems/recruiting-model.md), and
[League News](../systems/league-news.md).

Do not run a writer—data build, provider refresh, benchmark generation without
`--check`, or any future acceptance workflow—unless the task changes that
writer's authoritative inputs.

## Change-to-Check Matrix

| Change | Minimum verification |
| --- | --- |
| Documentation only | Link/path audit and `git diff --check` |
| Pure domain calculation | Targeted tests, `typecheck` |
| Persisted type, validator, or repository | Targeted repository tests, integration tests, `typecheck`, `build` |
| Command or lifecycle transition | Targeted command/integration tests, affected scenario, `typecheck`, `build` |
| Loader or page contract | Loader/page tests, affected route inspection, `typecheck`, `build` |
| Frontend presentation | Affected tests, responsive/accessibility inspection, `typecheck`, `build` |
| Simulation behavior | Targeted tests, `eval:sim`, then stability audit when tuning is broad |
| Recruiting or roster balance | Targeted tests, representative recruiting evaluation, annual lifecycle scenario |
| News facts, policy, copy, or scoring | Targeted tests and representative news audit |
| Rankings, playoff, or awards | Targeted tests plus 2/4/12 postseason scenarios; `eval:awards` for scoring changes |
| Canonical or generated static data | Owning workflow in the static-data verification matrix |
| Dependency graph | Full offline check, audit review, and production-server smoke test |

## Cross-System Scenario Matrix

Automated tests are preferred. Use manual scenarios for behavior that the test
suite cannot observe directly.

| Scenario | Expected result |
| --- | --- |
| New league | Exact configuration creates one preseason league, roster, origins, and initial schedule atomically |
| New-league failure | Invalid input or commit failure leaves the previous authoritative state unchanged |
| Full annual loop | Every documented stage occurs once in order and reload preserves the authoritative stage |
| Week advancement | All target-week games, details, records, rankings, and news commit coherently |
| Live simulation | The persisted result matches the interactive artifacts and refreshes dependent pages |
| Batch/live equivalence | Both paths produce exact completed games, nested detail, and one game story |
| Postseason formats | 2-, 4-, and 12-team fields advance through their configured rounds into summary |
| Recruiting | Manual input, AI assistance, commitments, Signing Day, and reload preserve public-information boundaries |
| Roster finalization | Stale guards fail; successful cuts, starters, ratings, reset, and cleanup commit once |
| Concurrent offseason action | Only one guarded command commits and no participating store is partially updated |
| Loader gating | On-stage and off-stage routes return their exact typed projection without mutation |
| Static-data refresh | Canonical edits deterministically regenerate projections and invalidate the intended cache epoch |

## Frontend Inspection

For changed routes, use the breakpoints and completion criteria in
[Frontend Principles and Patterns](../frontend/README.md). Verify loading,
failure, empty, populated, disabled, and stale-response states relevant to the
change. Live simulation requires separate inspection from batch advancement.

## Dependency Maintenance

The Node version, direct dependency versions, and install contract are owned by
`.nvmrc`, `package.json`, and `package-lock.json`. Review dependency updates
manually with `npm outdated`, then run `npm audit --omit=dev`, the complete
offline check, and a production-server smoke test. Do not use forced audit fixes
or version overrides to conceal unsupported combinations.

## Invariants

- Verification matches the scope and risk of the change.
- Seeded workflows remain exactly reproducible.
- Statistical findings use adequate samples and declared denominators.
- Read-only checks do not rewrite authoritative code, data, or configuration.
- Generated artifacts are reviewed rather than accepted solely because a
  command produced them.
