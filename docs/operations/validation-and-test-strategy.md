# Validation and Test Strategy

## Scope

Defines a practical validation strategy for checking lifecycle correctness,
simulation integrity, and interface consistency after application changes.

## System Model

Validation is layered:

1. **Static sanity**: repository/build-level checks to catch accidental breakage.
2. **Lifecycle scenario checks**: confirm stage transitions and seasonal loop integrity.
3. **Simulation behavior checks**: confirm game-level mechanics and statistical behavior remain plausible.
4. **Subsystem consistency checks**: rankings/playoff/awards and roster/recruiting coherence.
5. **Interface checks**: exact on-stage and off-stage loader contracts still
   match UI expectations.

Because the simulator is stochastic, validation uses scenario sets and aggregated expectations, not single deterministic scores.

## Execution Flow

1. **Pre-checks**
- Confirm the intended diff scope.
- Run type safety/build sanity command.

2. **Lifecycle matrix execution**
- Drive through stage transitions with representative league settings.
- Confirm expected stage, data persistence, and page outputs after each transition.

3. **Simulation and postseason matrix execution**
- Exercise week advancement and postseason creation for 2/4/12 formats.
- Validate bracket progression and summary-stage transition behavior.

4. **Roster/recruiting + awards/rankings checks**
- Confirm offseason progression effects and downstream ranking/awards behavior align with expected mechanics.

5. **Interface/refresh checks**
- Confirm live sim and `pageDataRefresh`-based page synchronization is
  consistent. Background refresh must preserve shell feedback for stale or
  conflicting offseason actions.

## Key Mechanics

- **Available command checks**:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`
  - `npm run eval:winrate`
  - `npm run eval:recruiting-balance -- --seed <seed> --seeds <count> --seasons <count> --replay-seeds <count>`
  - `npm run tune:yards` (calibration run; use carefully because it can rewrite tuning)
  - `npm run tune:winrate` (calibration run; rewrites tuning)
- **Manual scenario checks are required** where automated integration tests are absent.
- **Statistical checks** should compare trend/direction and distribution ranges, not exact single-run values.

`eval:recruiting-balance` integrates the public-information AI cycle with
production progression, freshman conversion, walk-ons, cuts, starters, roster
ratings, history, and prestige feedback. The default is a one-seed, one-year
smoke run without a duplicate replay. The representative validation uses root
seed `20260727`, three keyed seeds, four seasons, and one replayed seed:

```text
npm run eval:recruiting-balance -- --seed 20260727 --seeds 3 --seasons 4 --replay-seeds 1
```

Structural failures—reproducibility, capacity, duplicate commitments or IDs,
freshman cuts, roster size, and starter coverage—fail validation. Aggregate
ranges produce separate stable balance-violation codes and also fail the
command. Signing Day share, low-prestige elite share, supply distributions,
informational warnings, and rating-spread diagnostics do not fail it.
The JSON includes configuration, gates, class-score distribution, exact and
displayed tie rates, top-25 composition and appearance rates by prestige,
measured values, checksums, and runtime; the command never rewrites
configuration or persistence. Larger samples are explicit offline analysis,
not routine validation.

The representative checksum records the current 80-player economy,
active-pursuit strategy, recruit supply, public-rank talent model, and
nonlinear elite-prestige
hierarchy. Passing it establishes reproducibility; distribution diagnostics
and a user season review establish product credibility. See
[Recruiting Hierarchy](../design/recruiting-hierarchy.md) and
[Roster and Recruit Supply](../design/roster-and-recruit-supply.md).
The representative checksum is `8476564c`.

## Invariants and Constraints

- Validation should preserve year scoping (`currentYear`) and stage ordering invariants.
- Scenario runs should avoid conflating doc edits with tuning/data rewrites unless explicitly intended.
- Reproducibility is limited due to stochastic simulation; use sample sizes and repeated runs for confidence.

## Failure/Edge Cases

- Passing `typecheck` does not guarantee behavioral integrity.
- Single-run anomalies are possible; suspicious behavior requires repeated scenario replay.
- Postseason catch-up logic can mask missed-week assumptions unless explicitly tested.
- Live sim completion path must be validated separately from batch progression path.

## What You Can Observe in the App

- Correct lifecycle behavior appears as predictable stage progression and route availability changes.
- Integrity issues often appear as missing playoff rounds, stale rankings, broken game pages, or inconsistent roster states after offseason.
- Interface mismatches appear as pages loading but rendering incomplete/undefined slices.

## Scenario Matrix

| Area | Scenario | Expected Outcome | Verification Method |
|---|---|---|---|
| Lifecycle | New league creation | stage starts at `preseason`; non-con schedule exists; league persisted | Home/Noncon flow + reload check |
| New-league failure | preparation or multi-store commit fails | previous league and every simulation artifact remain intact; same configuration can retry | Fake-IndexedDB command/repository tests + Home retry |
| New-league validation | unsupported year/team or invalid playoff input | creation stops before replacement with an actionable error | Loader tests + Home configuration checks |
| Lifecycle | Full annual loop | `preseason -> season -> summary -> realignment -> progression -> recruiting -> recruiting_summary -> roster_cuts -> preseason` | Navigate stage pages and execute recruiting commands in sequence |
| Week advancement | Simulate multi-week jump | games complete through destination week; rankings/standings update | Use Season banner advance + inspect schedule/rankings |
| Postseason (2) | 2-team format run | conference championships, natty, bowls generated in expected week windows | Inspect Playoff + week schedule after CC week |
| Postseason (4) | 4-team format run | semis then natty generated; summary after natty winner | Inspect Playoff + summary transition |
| Postseason (12) | 12-team format run | R1 -> quarters -> semis -> natty sequence with catch-up if needed | Inspect Playoff rounds and week schedules |
| Live sim | User-game interactive completion | final game persisted; drives/plays visible; league context updated | Run GameSimModal to completion, then reopen game/schedule |
| Batch vs live consistency | Same game state class | completed games have coherent score/winner/clock/headline fields in both modes | Compare completed game pages from both paths |
| Roster progression | Offseason progression | seniors depart, younger classes advance, ratings shift | Inspect Roster Progression + roster page |
| Recruiting/cuts | Recruiting then cuts | freshmen and required walk-ons added; protected user selections persist; every final roster reaches 80 | Inspect Recruiting Summary + Roster Cuts + roster |
| Interactive recruiting | Add/remove board targets, submit manual points with assisted advancement, use Sim to End of Recruiting, reload between rounds, resolve Signing Day | manual points are preserved; AI fills legally; public standings match resolution; drafts never overwrite newer state; hidden prospect data is absent | Loader and lifecycle tests + Recruiting page |
| Roster finalization | Select, undo, reload, then finalize | stale versions fail; user selections remain exact; non-user cuts, starters, ratings, and reset commit once | Fake-IndexedDB command tests plus finalization harness |
| Rankings | Weekly poll movement | rank movement reflects latest outcomes, not random reshuffle | Check rankings across multiple weeks |
| Awards | Late-season awards richness | favorites/final outputs expand with played-game logs | Inspect Awards page mid/late season |
| Loader contracts | Route data completeness | pages receive expected `info/team/conferences` envelope + exact gated page payload | Run loader tests and spot-check stale routes |
| Refresh sync | pageDataRefresh path | open pages refetch after actions without discarding recoverable shell feedback | Advance from a stale tab and observe refreshed unavailable state plus retry feedback |
| Offseason concurrency | duplicate/stale/configuration race | only one consistent command commits; failures leave all affected stores unchanged | Run atomic integration tests and exercise a two-tab stale action |
| Offseason navigation | refresh, Back/Forward, direct stale lifecycle route | no lifecycle mutation; off-stage loaders return their gated projection | Reload each lifecycle page and compare IndexedDB snapshots |

## Recommended Validation Sequence

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. `npm run eval:recruiting-balance`
5. Run the 3×4 representative command for recruiting balance changes.
6. New league -> preseason to season bootstrap validation.
7. Run one complete seasonal cycle in 12-team mode.
8. Repeat postseason-focused runs in 2-team and 4-team modes.
9. Execute at least one full live-sim game and one batch-sim progression check.
10. Run `npm run eval:winrate` for trend sanity on rating differential behavior.

For an affected frontend route, also inspect approximately 1440×900, 1280×720,
768×1024, and 390×844. At `lg`, verify document containment and intentional
internal scrolling; below `lg`, verify no unintended horizontal overflow.

## Dependency Maintenance

- Use Node 24 LTS, as recorded in `.nvmrc` and `package.json`.
- Direct dependencies are pinned exactly; `package-lock.json` is the
  reproducible install contract.
- `npm run start` serves the built `dist/` application with SPA fallback and
  honors the deployment-provided `PORT`.
- Review updates manually with `npm outdated`, then run
  `npm audit --omit=dev`, the standard validation sequence, and a production
  server smoke test after changing the dependency graph.
- Do not use forced audit fixes or version overrides
  to hide unsupported combinations.

## Source Map (file/function references)

- Lifecycle and stage transitions:
  - `src/domain/league/stages.ts`
  - `src/domain/league/loaders/loadRealignment.ts`
  - `src/domain/league/loaders/loadRosterProgression.ts`
  - `src/domain/league/loaders/loadRecruitingSummary.ts`
  - `src/domain/league/loaders/offseason.ts`
  - `src/domain/league/loaders/season/loadNonCon.ts`
- Week advancement and sim orchestration:
  - `src/domain/sim/orchestrator.ts`
  - `src/domain/sim/postseason.ts`
- Rankings/playoff/awards:
  - `src/domain/sim/rankings.ts`
  - `src/domain/league/loaders/playoff.ts`
  - `src/domain/league/awards.ts`
- Roster/recruiting:
  - `src/domain/roster.ts`
  - `src/domain/rosterCuts.ts`
  - `src/domain/league/rosterFinalization.ts`
- UI integration points:
  - `src/components/sim/useGameSim.ts`
  - `src/domain/hooks.ts`
  - `src/components/layout/SeasonBanner.tsx`
- Commands/scripts:
  - `package.json`
  - `scripts/eval_winrate.ts`, `scripts/eval_recruiting_balance.ts`,
    `scripts/tune_yards.ts`, `scripts/tune_winrate.ts`
