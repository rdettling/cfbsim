# Validation and Test Strategy

## Purpose

Defines a practical validation strategy for checking lifecycle correctness,
simulation integrity, and interface consistency after application changes.

## Validation Layers

Validation is layered:

1. **Static sanity**: repository/build-level checks to catch accidental breakage.
2. **Lifecycle scenario checks**: confirm stage transitions and seasonal loop integrity.
3. **Simulation behavior checks**: confirm game-level mechanics and statistical behavior remain plausible.
4. **Subsystem consistency checks**: rankings/playoff/awards and roster/recruiting coherence.
5. **Interface checks**: exact on-stage and off-stage loader contracts still
   match UI expectations.

Because the simulator is stochastic, validation uses seeded scenario sets and
aggregate expectations rather than treating one game as evidence.

## Workflow

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

## Commands and Statistical Checks

- **Available command checks**:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`
  - `npm run data:check`
  - `npm run eval:sim`
  - `npm run eval:sim-stability`
  - `npm run tune:sim`
  - `npm run generate:sim-benchmark -- --check`
  - `npm run eval:news -- --seed <seed> --seeds <count> --seasons <count> --replay-seeds <count>`
  - `npm run eval:recruiting-balance -- --seed <seed> --seeds <count> --seasons <count> --replay-seeds <count>`
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

The replay checksum establishes reproducibility for a given build;
distribution diagnostics and a user season review establish product
credibility. See the [Recruiting Model](../systems/recruiting-model.md) and
[Roster and Recruiting Lifecycle](../systems/roster-and-recruiting.md).

`eval:news` uses production schedule, roster, odds, ranking, game simulation,
fact extraction, and story generation in memory. Its representative command is:

```text
npm run eval:news -- --seed 20260809 --seeds 3 --seasons 2 --replay-seeds 1
```

Incomplete traces, unsupported factual claims, incorrect upset identity,
out-of-range ranking language, ineligible featured performances, unnamed bowl
headlines, missing context coverage, or a replay checksum mismatch fail the
command. Editorial-distribution findings are warnings and require review of
the generated `review.md` and `stories.jsonl`. Standout primary angles above
15% and featured-player decks above 25% are warning thresholds, not hard
distribution targets.

The audit also records every natural weekly ranking decision plus explicit
threshold, precedence, non-publication, and 2-/4-/12-team playoff-field cases.
Ranking traces are validated separately from game traces, and
`gameContentChecksum` preserves the committed game-copy baseline while global
checksums include published ranking items.

Every simulated season also contributes its complete three-story preseason
package. The preview audit independently verifies poll and outlook team order,
the selected opening matchup, template IDs, deterministic generation, and the
newsworthiness component breakdown. `previewItemChecksum` isolates persisted
preview copy from trace-only audit changes.

For behavior-preserving news refactors, compare publisher-specific content
checksums before and after the change. The full and global item checksums may
change when a previously unaudited publisher is added to the corpus; the game
and preview content checksums, natural distributions, and warning-linked story
IDs must remain stable once their coverage is established.

## Invariants

- Validation should preserve year scoping (`currentYear`) and stage ordering invariants.
- Scenario runs should avoid conflating doc edits with tuning/data rewrites unless explicitly intended.
- Seeded replay must be exact; statistical credibility still requires multiple
  seeds and adequate sample sizes.

## Coverage Gaps

- Passing `typecheck` does not guarantee behavioral integrity.
- Single-run anomalies are possible; suspicious behavior requires repeated scenario replay.
- Postseason catch-up logic can mask missed-week assumptions unless explicitly tested.
- Live sim completion path must be validated separately from batch progression path.

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
| Live sim | User-game interactive completion | final game and nested detail persisted; drive/play presentation visible; league context updated | Run GameSimModal to completion, then reopen game/schedule |
| Batch vs live consistency | Same game state class | completed games have coherent score/winner/clock fields and one persisted news story in both modes | Compare completed game pages from both paths |
| Roster progression | Offseason progression | seniors depart, younger classes advance, ratings shift | Inspect Roster Progression + roster page |
| Recruiting/cuts | Recruiting then cuts | freshmen and required walk-ons added; protected user selections persist; every final roster reaches 80 | Inspect Recruiting Summary + Roster Cuts + roster |
| Interactive recruiting | Add/remove board targets, submit manual points with assisted advancement, use Sim to End of Recruiting, reload between rounds, resolve Signing Day | manual points are preserved; AI fills legally; public standings match resolution; drafts never overwrite newer state; hidden prospect data is absent | Loader and lifecycle tests + Recruiting page |
| Roster finalization | Select, undo, reload, then finalize | stale versions fail; user selections remain exact; non-user cuts, starters, ratings, and reset commit once | Fake-IndexedDB command tests plus finalization harness |
| Rankings | Weekly poll movement | rank movement reflects latest outcomes, not random reshuffle | Check rankings across multiple weeks |
| Awards | Late-season awards richness | live/final placements expand with played-game logs | Inspect Awards page mid/late season |
| Loader contracts | Route data completeness | pages receive expected `info/team/conferences` envelope + exact gated page payload | Run loader tests and spot-check stale routes |
| Refresh sync | pageDataRefresh path | open pages refetch after actions without discarding recoverable shell feedback | Advance from a stale tab and observe refreshed unavailable state plus retry feedback |
| Offseason concurrency | duplicate/stale/configuration race | only one consistent command commits; failures leave all affected stores unchanged | Run atomic integration tests and exercise a two-tab stale action |
| Offseason navigation | refresh, Back/Forward, direct stale lifecycle route | no lifecycle mutation; off-stage loaders return their gated projection | Reload each lifecycle page and compare IndexedDB snapshots |

## Validation Sequence

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. `npm run eval:recruiting-balance`
5. `npm run eval:news`
6. Run the relevant representative evaluation command for recruiting or news changes.
7. New league -> preseason to season bootstrap validation.
8. Run one complete seasonal cycle in 12-team mode.
9. Repeat postseason-focused runs in 2-team and 4-team modes.
10. Execute at least one full live-sim game and one batch-sim progression check.
11. Run `npm run eval:sim` for exact replay, game-state invariants, relationship
    gates, rating preservation, and diagnostics for the 22 frozen production
    metrics. Production, score, and margin comparisons do not fail the command.
    The accepted replay checksum is `1b914e9a`.
12. Run `npm run generate:sim-benchmark -- --check` when benchmark generation,
    calibration metrics, or source documentation changes. Routine tests remain
    offline; this explicit check is the networked source-verification step.
13. Run `npm run tune:sim` when changing approved controls. It searches 13
    bounded parameters over three deterministic equal-team seeds, prints only
    an in-memory candidate, and restores runtime tuning.
14. Run `npm run eval:sim-stability` before a future global retune. Its five
    held-out blocks and common-seed sensitivity matrix are long-running offline
    diagnostics. Production/rating findings do not fail the command, while
    malformed data, invariants, nondeterminism, seed overlap, and tuning leaks
    do.

For league-news copy changes, run the representative three-seed, two-season,
one-replay `eval:news` corpus. Copy changes must preserve the appropriate
editorial invariants. The accepted news-content checksum is `b2218e6b`. Future
scoring changes must produce no structural violations. Ranked-team placement
in weekly top-five slots and leads, and the drama score of unranked-only leads,
remain warning-level editorial distributions that require review rather than
hard acceptance gates. Every run must retain game-type, primary-angle, and
syntax-family coverage.

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

## Source Map

- Lifecycle and stage transitions:
  - `src/domain/league/stages.ts`
  - `src/domain/league/loaders/loadRealignment.ts`
  - `src/domain/league/loaders/loadRosterProgression.ts`
  - `src/domain/league/loaders/loadRecruitingSummary.ts`
  - `src/domain/league/loaders/awards.ts`
  - `src/domain/league/loaders/seasonSummary.ts`
  - `src/domain/league/loaders/season/loadNonCon.ts`
- Week advancement and sim orchestration:
  - `src/domain/sim/orchestrator.ts`
  - `src/domain/sim/postseason.ts`
- Rankings/playoff/awards:
  - `src/domain/sim/rankings.ts`
  - `src/domain/league/loaders/postseason/`
  - `src/domain/league/utils/bowlSelection.ts`
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
  - `scripts/eval_sim.ts`, `scripts/generate_sim_benchmark.ts`,
    `scripts/eval_recruiting_balance.ts`
