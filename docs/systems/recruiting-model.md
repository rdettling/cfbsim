# Recruiting Model

## Purpose

This document owns the competitive model that converts public prospect
quality, team fit, positional need, competition, and weekly points into
commitments and class rankings. Lifecycle and roster rules belong in
[Roster and Recruiting Lifecycle](roster-and-recruiting.md).

## Product Contract

- Stronger programs usually sign stronger classes.
- Five-stars concentrate among prestige 6–7 programs, while four-stars remain
  uncommon at prestige 1–2 programs.
- No prestige tier is prohibited from pursuing or signing a prospect.
- Fit, need, recent success, competition, and point allocation allow upsets.
- Players and AI evaluate talent from the same public information.
- Class scoring rewards elite quality with diminishing value for depth.

## Public Talent

Prospects receive exact freshman and future ratings from the distribution for
their star tier. Those ratings and development traits remain hidden during
recruiting. A hidden ten-point estimate around the freshman rating orders
prospects within each star tier; only the resulting national rank is public.

AI public talent value uses the same visible stars and within-star national
rank available to the player:

```text
public talent =
  0.90 × (stars × 20)
  + 0.10 × within-star national-rank percentile
```

Playing-time fit uses the common expected freshman rating for the star tier,
not a prospect-specific hidden estimate.

## Team Fit

Ordinary fit combines four prospect preferences whose weights sum to 100:

- prestige from the team's 1–7 level;
- proximity through same-state affinity;
- playing time through starter opportunity and positional roster room;
- recent success through the team's national rank.

Fit is team-specific and clamped to 0–100. Four- and five-star prospects use a
nonlinear prestige blend:

```text
elite prestige fit = 100 × ((prestige − 1) / 6)²
elite fit = 0.10 × ordinary fit + 0.90 × elite prestige fit
```

This curve concentrates elite talent without eligibility cutoffs. A shortage
of starters receives hard AI priority only for three- and two-star targets.

## AI Strategy

The pure AI strategy follows three stages:

```text
rank eligible candidates → admit active pursuits → allocate weekly points
```

Candidate score weights are 35% public talent, 30% fit, 25% positional need,
and 10% competition viability. Committed, capacity-ineligible, and unreachable
prospects are excluded. Keyed random ties followed by prospect IDs make the
result reproducible and independent of input order.

An active pursuit requires 20 lifetime points. Existing meaningful pursuits
remain active while eligible and reachable. Teams propose their best fundable
candidate until target class size, board capacity, or weekly budget is
exhausted. Each admission pass accepts the best league-wide proposal, and a
prospect receives at most one new AI admission.

Submitted user allocations remain exact minimums. New admissions first receive
the points needed to reach 20 lifetime points; remaining budget follows the
same priority order up to the per-prospect cap. AI boards contain active
pursuits, while the player's board may also contain unfunded watchlist entries.

## Class Ranking

Recruiting Summary scores stars, not hidden ratings or national rank. Recruits
are ordered from highest to lowest stars:

```text
star value = stars²
slot weight = exp(-0.5 × ((slot − 1) / 18)²)
class score = Σ(star value × slot weight)
```

Every recruit adds positive value, with diminishing weight beyond a normal
class size. Teams rank by the unrounded score; the UI displays one decimal.
Exact-score ties use team name.

## Balance Contract

Repeated seeded evaluation checks:

- deterministic replay and input-order invariance;
- one commitment per prospect and legal team capacities;
- base classes filling without systematic walk-ons;
- reasonable oversigning and signed supply by star tier;
- positive prestige-to-class-score correlation;
- distinct low-, middle-, and elite-tier class quality;
- occasional lower-tier wins and long-term prestige mobility;
- legal final rosters and complete starter coverage.

Signing Day share, meaningful contention, low-prestige elite share, class-size
distribution, score ties, and unsigned supply are diagnostics rather than
single-season quotas. Run the production evaluator with:

```bash
npm run eval:recruiting-balance -- \
  --seed 20260727 --seeds 3 --seasons 4 --replay-seeds 1
```

## Invariants

- AI receives no exact ratings, future ratings, development traits, or hidden
  bonuses.
- All teams use the same public talent, fit, capacity, and commitment rules.
- New AI admissions are exclusive; existing and player-created competition is
  preserved.
- Recruiting formulas stay in pure domain modules; persisted commands only
  coordinate and apply their results.

## Source Map

- `src/domain/recruiting/publicValue.ts`
- `src/domain/recruiting/fit.ts`
- `src/domain/recruiting/aiCandidates.ts`
- `src/domain/recruiting/aiPursuitAllocator.ts`
- `src/domain/recruiting/aiAllocation.ts`
- `src/domain/recruiting/aiStrategy.ts`
- `src/domain/recruiting/classScoring.ts`
- `scripts/evaluation/recruiting/evaluation.ts`
- `scripts/evaluation/recruiting/evaluationSeason.ts`
- `scripts/evaluation/recruiting/evaluationMetrics.ts`
- `scripts/eval_recruiting_balance.ts`
