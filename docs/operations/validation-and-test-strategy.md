# Validation and Test Strategy

## Scope

Defines a practical validation strategy for checking lifecycle correctness, simulation integrity, and interface consistency after documentation-informed model or configuration changes.

## System Model

Validation is layered:

1. **Static sanity**: repository/build-level checks to catch accidental breakage.
2. **Lifecycle scenario checks**: confirm stage transitions and seasonal loop integrity.
3. **Simulation behavior checks**: confirm game-level mechanics and statistical behavior remain plausible.
4. **Subsystem consistency checks**: rankings/playoff/awards and roster/recruiting coherence.
5. **Interface checks**: loader contracts still match UI expectations.

Because the simulator is stochastic, validation uses scenario sets and aggregated expectations, not single deterministic scores.

## Execution Flow

1. **Pre-checks**
- Confirm clean docs-only diff intent.
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
- Confirm live sim and `pageDataRefresh`-based page synchronization is consistent.

## Key Mechanics

- **Available command checks**:
  - `npm run typecheck`
  - `npm run eval:winrate`
  - `npm run tune:yards` (calibration run; use carefully because it can rewrite tuning)
  - `npm run tune:winrate` (calibration run; rewrites tuning)
- **Manual scenario checks are required** where automated integration tests are absent.
- **Statistical checks** should compare trend/direction and distribution ranges, not exact single-run values.

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
| Lifecycle | Full annual loop | `preseason -> season -> summary -> realignment -> progression -> recruiting_summary -> roster_cuts -> preseason` | Navigate stage pages in sequence |
| Week advancement | Simulate multi-week jump | games complete through destination week; rankings/standings update | Use Season banner advance + inspect schedule/rankings |
| Postseason (2) | 2-team format run | conference championships, natty, bowls generated in expected week windows | Inspect Playoff + week schedule after CC week |
| Postseason (4) | 4-team format run | semis then natty generated; summary after natty winner | Inspect Playoff + summary transition |
| Postseason (12) | 12-team format run | R1 -> quarters -> semis -> natty sequence with catch-up if needed | Inspect Playoff rounds and week schedules |
| Live sim | User-game interactive completion | final game persisted; drives/plays visible; league context updated | Run GameSimModal to completion, then reopen game/schedule |
| Batch vs live consistency | Same game state class | completed games have coherent score/winner/clock/headline fields in both modes | Compare completed game pages from both paths |
| Roster progression | Offseason progression | seniors depart, younger classes advance, ratings shift | Inspect Roster Progression + roster page |
| Recruiting/cuts | Recruiting then cuts | freshmen added, then caps enforced by cuts, starters reset | Inspect Recruiting Summary + Roster Cuts + roster |
| Rankings | Weekly poll movement | rank movement reflects latest outcomes, not random reshuffle | Check rankings across multiple weeks |
| Awards | Late-season awards richness | favorites/final outputs expand with played-game logs | Inspect Awards page mid/late season |
| Loader contracts | Route data completeness | pages receive expected `info/team/conferences` envelope + page payload | Spot-check main routes for missing sections |
| Refresh sync | pageDataRefresh path | open pages refetch after advancement action | Advance week and observe dashboard/standings refresh |

## Recommended Validation Sequence

1. `npm run typecheck`
2. New league -> preseason to season bootstrap validation.
3. Run one complete seasonal cycle in 12-team mode.
4. Repeat postseason-focused runs in 2-team and 4-team modes.
5. Execute at least one full live-sim game and one batch-sim progression check.
6. Run `npm run eval:winrate` for trend sanity on rating differential behavior.

## Source Map (file/function references)

- Lifecycle and stage transitions:
  - `src/domain/league/stages.ts`
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
- UI integration points:
  - `src/components/sim/useGameSim.ts`
  - `src/domain/hooks.ts`
  - `src/components/layout/SeasonBanner.tsx`
- Commands/scripts:
  - `package.json`
  - `scripts/eval_winrate.ts`, `scripts/tune_yards.ts`, `scripts/tune_winrate.ts`
