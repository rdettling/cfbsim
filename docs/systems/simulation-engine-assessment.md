# Simulation Engine Assessment

## Purpose

Summarizes the current simulation architecture, its verified strengths, known
limitations, and maintenance direction. The implementation contract is
documented in [Simulation Engine](simulation-engine.md); benchmark details are
in [Simulation Calibration](simulation-calibration.md).

The project favors a small explicit model over simulation complexity for its
own sake. Team rating remains the authoritative strength signal, individual
ratings affect participant selection only, and coach mode uses the same domain
resolver as automatic simulation.

## Current Architecture

The runtime is organized around direct domain modules:

- `engine.ts` owns game orchestration, hydration, and final results.
- `drive.ts` owns drive initialization, single-play dispatch, and the batch
  drive loop; focused regulation and try modules own resolution.
- `outcomes.ts`, `concepts.ts`, and `defensiveIntents.ts` own team-level
  football outcomes and matchup shaping.
- `clock.ts`, `clockManagement.ts`, and `conversions.ts` own causal regulation
  timing, timeouts/tempo, tries, and the current NCAA overtime scoring sequence.
- `participants.ts`, participant validation, `plays.ts`, and `statistics.ts`
  select and consistently consume starter identities.

The diagnostic layer is separate from gameplay:

- `evaluation.ts` constructs deterministic scenarios, runs the real resolver,
  collects metrics, and assembles `eval:sim` reports.
- `evaluationAudit.ts` owns game invariants and default relationship gates.
- `calibrationMetrics.ts` owns the frozen production metric set, tolerances,
  pooling, rating preservation, and tuner scoring.
- `tuner.ts` owns the bounded deterministic candidate search.
- `stabilityStatistics.ts` owns pure variance and sensitivity calculations;
  `stabilityAudit.ts` owns the expensive offline orchestration.

IndexedDB schema 24 persists exact play calls, participants, timing, results,
and score progression. Batch and live simulation use the same resolver and
enforce the same 200-play drive limit.

## Verified Strengths

- Seeded games are reproducible without leaking the seeded `Math.random`
  wrapper or tuning overrides.
- Field position, down state, score progression, drive points, regulation
  timing, timeout use, tries, and overtime structure are audited as hard
  invariants.
- Offensive concepts and defensive intents have visible, gated risk/reward
  relationships without consulting individual ratings for outcomes.
- Persisted participants own play text, player logs, UI projections, and news
  performances; there is no secondary attribution path.
- Coach-selected offense, defense, tempo, timeout, spike, kneel, and conversion
  instructions use the same typed resolver as CPU decisions.
- The frozen 2023–25 NCAA benchmark gives production tuning a reproducible,
  offline comparison target.

## Current Calibration State

The modern-FBS tuner candidate is now the accepted runtime baseline. The
simulation checksum is `1b914e9a`; the representative news-content checksum is
`b2218e6b`. `eval:sim` passes all replay, state, relationship, balance, and
rating-authority gates.

The frozen NCAA comparison remains deliberately diagnostic. In the default
1,000-game equal-team sample, 15 of 22 production metrics are within their
benchmark tolerances. The remaining small biases are higher fourth-down
conversion, turnovers, lost fumbles, and red-zone touchdown rate, plus lower
made-field-goal volume and passing yards per attempt/completion. These gaps are
retained in the report rather than hidden or used to fail an otherwise coherent
engine.

The pre-adoption stability audit showed that further movement within the 13
existing controls traded one gap for another. That coupling, together with the
candidate's close aggregate production, is why this baseline was accepted
instead of adding another narrow parameter. Rating authority is protected by
strictly increasing results and broad compatibility bands of ±4 percentage
points for win rates and ±2.5 points for positive-difference margins.

## Remaining Product Gaps

There is no required near-term simulation milestone. The engine already
represents participant-linked plays, concept matchups, clock strategy,
conversions, and the current overtime scoring structure with coherent
persistence and coach controls. Its documented production differences and
regulation-only timeout management are accepted limitations of the current
lightweight model.

The rating-difference curve is a preserved compatibility target rather than an
independent fit to modern mixed-strength FBS matchups. A future mixed-rating
calibration could compare upset, margin, and blowout distributions across a
representative schedule, but it is optional unless normal season play reveals
that favorites or underdogs behave implausibly.

Direct player-rating outcome influence remains deferred. Adding it without
deliberately redesigning the team-rating contract would make it harder to
preserve team rating as the meaning of team strength. Other low-priority
features include large playbooks, formations, injuries, fatigue, weather, and
detailed penalty enforcement.

## Recommended Next Step

Stop global tuning and evaluate the game as a product. Play and simulate normal
seasons, collect concrete immersion or strategy problems, and change the model
only when a visible football issue justifies it. The benchmark remains a useful
regression comparison, but matching every aggregate within a narrow tolerance
is no longer a release requirement.
