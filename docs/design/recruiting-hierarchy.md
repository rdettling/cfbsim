# Recruiting Hierarchy

## Purpose

This document owns the competitive model that turns team prestige, public
prospect quality, fit, and AI decisions into recruiting outcomes and class
rankings. Player workflow belongs in
[Interactive Recruiting and Roster Finalization](interactive-recruiting.md);
roster scale and annual supply belong in
[Roster and Recruit Supply](roster-and-recruit-supply.md).

## Product Intent

- Stronger programs usually sign stronger classes.
- Five-stars concentrate among elite programs and four-stars remain uncommon
  at prestige 1–2.
- No prestige tier is prohibited from pursuing or signing any prospect.
- Fit, roster need, recent success, competition, and point allocation permit
  occasional upsets.
- The player and AI evaluate talent from the same public information.
- Class rankings reward elite quality while giving diminishing value to depth.

## Public Talent

Every prospect receives exact freshman and future ratings from the common
distribution for their star tier. Individual results vary within that
distribution. The exact freshman rating remains private until Roster Cuts;
future ratings and development traits remain internal.

A hidden ten-point estimate around the freshman rating determines ordering
within each star tier. Only its resulting national rank is exposed during
recruiting. Rating estimates do not cross the recruiting page or AI snapshot
boundary.

AI public talent value combines:

```text
public talent =
  0.90 × (stars × 20)
  + 0.10 × within-star national-rank percentile
```

Playing-time fit uses the common expected freshman rating for the star tier,
not a prospect-specific hidden estimate. National rank is therefore the only
within-star quality signal available to both the player and AI.

## Team Fit

Ordinary fit combines the prospect's four preference weights:

- team prestige;
- same-state proximity;
- playing time from the position's starter path and roster room;
- recent success from the team's national rank.

Preference weights sum to 100 and team fit is clamped to 0–100.

Four- and five-star prospects use a nonlinear prestige blend:

```text
elite prestige fit = 100 × ((prestige − 1) / 6)²
elite fit = 0.10 × ordinary fit + 0.90 × elite prestige fit
```

This curve creates strong elite-program concentration without eligibility
cutoffs. Starter shortages receive hard AI priority only for three- and
two-star prospects.

## AI Policy

The strategy has three stages:

```text
rank eligible candidates → admit active pursuits → allocate weekly points
```

### Candidate ranking

Committed, capacity-ineligible, and unreachable prospects are rejected.
Remaining candidates are ordered by:

- public talent: 35%;
- team fit: 30%;
- positional need: 25%;
- competition viability: 10%.

Unresolved lower-star starter shortages sort ahead of the weighted score.
Keyed random ties, then prospect IDs, keep decisions reproducible and
input-order invariant.

### Pursuit admission

An active pursuit requires 20 lifetime points. Existing meaningful board
targets remain active while eligible and reachable. Submitted user minimums
that cross the threshold count before AI admission.

Teams propose their highest-priority fundable prospect until their target
slots, board capacity, or weekly budget is exhausted. The best league-wide
proposal is admitted on each pass. A prospect may receive only one new AI
admission; existing and user-created competition remains valid.

AI planning targets two oversignings while authoritative rules permit four.
Positional need is recomputed after every admission.

### Weekly allocation

User allocations remain exact minimums. New admissions first receive the
points needed to reach 20 lifetime points. Remaining budget is distributed
across active pursuits in the same priority order up to the per-prospect cap.

AI boards contain only eligible active pursuits. The user board may retain
unfunded watchlist entries. All teams resolve allocations simultaneously
through the same commitment rules.

## Class Ranking

Recruiting Summary scores only stars. Exact ratings, hidden estimates, team
identity, names, and national rank do not affect class quality.

Recruits are ordered from highest to lowest stars:

```text
star value = stars²
slot weight = exp(-0.5 × ((slot − 1) / 18)²)
class score = Σ(star value × slot weight)
```

The Gaussian depth curve gives every recruit positive value while reducing the
effect of additions beyond a normal class size. Teams rank on the unrounded
absolute score; the UI displays one decimal. Exact-score ties use team name
deterministically.

## Validation Contract

The recruiting evaluator must preserve:

- deterministic replay and input-order invariance;
- one commitment per prospect and valid team capacities;
- legal finalized rosters and starter coverage;
- near-universal base-capacity completion without systematic walk-ons;
- reasonable oversigning;
- positive prestige-to-class-score correlation;
- directional low, middle, and elite class quality;
- prestige mobility and occasional lower-tier wins.

Signing Day share, meaningful contention, low-prestige elite share, class-size
distribution, score ties, and supply signing rates remain diagnostics rather
than per-season quotas.

The representative command is:

```bash
npm run eval:recruiting-balance -- \
  --seed 20260727 --seeds 3 --seasons 4 --replay-seeds 1
```

The current baseline completes every base class, uses no walk-ons, has 0.759
prestige-to-class-score correlation, and has no balance, structural, or
reproducibility failures. Its checksum is `8476564c`.

## Boundaries

- Prospect ratings, seven prestige tiers, and recruiting rules are shared
  product contracts, not AI-only tuning levers.
- IndexedDB state, lifecycle transitions, and guarded commands remain
  authoritative.
- AI receives no exact ratings, future ratings, development traits, or hidden
  bonuses.
- New AI admissions are exclusive. Bounded contention would be a separate
  behavior change requiring balance evaluation.
- NFL departures and transfers are separate roster-turnover systems.

## Source Map

- `src/domain/recruiting/publicValue.ts`
- `src/domain/recruiting/fit.ts`
- `src/domain/recruiting/aiCandidates.ts`
- `src/domain/recruiting/aiPursuitAllocator.ts`
- `src/domain/recruiting/aiAllocation.ts`
- `src/domain/recruiting/classScoring.ts`
- `src/domain/recruiting/evaluation.ts`
- `scripts/eval_recruiting_balance.ts`
