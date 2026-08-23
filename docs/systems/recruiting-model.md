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

Every ranked prospect begins on one national latent-talent continuum rather
than inside a star-specific rating distribution. Freshman talent maps through
the following 25–99 percentile curve:

| National percentile | Freshman rating |
| ---: | ---: |
| 0 | 25 |
| 1 | 27 |
| 5 | 29 |
| 10 | 29 |
| 25 | 34 |
| 50 | 50 |
| 75 | 60 |
| 90 | 69 |
| 95 | 76 |
| 99 | 86 |
| 99.8 | 92 |
| 99.98 | 96 |
| 99.998 | 98 |
| 99.9995 | 99 |
| 99.99995 | 99 |
| 100 | 99 |

The extreme tail rises more slowly from 86 through 99 so ratings of 95 and
above remain nationally exceptional. Standard one-star walk-ons use a
lower entry draw of `Normal(-1.60, 0.35)` and a below-average development draw
of `Normal(-0.90, 1)`. This preserves occasional walk-on breakouts without
making their senior expectation exceed a ranked two-star's.

Each prospect also receives an independent standard-normal development value.
Senior latent talent preserves strong career correlation while allowing
development outliers:

```text
senior latent talent =
  0.30 × freshman latent talent
  + sqrt(1 − 0.30²) × development
```

Senior talent maps to a separate curve whose 50th, 90th, 95th, and 99th
percentiles are 66, 84, 89, and 93. Every whole rating point of career growth
is independently assigned to the freshman-to-sophomore,
sophomore-to-junior, or junior-to-senior transition with 50%, 35%, and 15%
probability. Those are national timing expectations rather than a fixed path
for an individual. Ratings do not decline, and only the resulting four class
ratings persist.

Stars are scouting labels assigned after the full national pool is generated.
The configured exact counts receive five through two stars in descending order
of:

```text
scouting score =
  0.50 × freshman latent talent
  + 0.50 × senior latent talent
  + Normal(0, 0.55)
```

This keeps stars strongly informative while permitting adjacent-tier overlap,
misses, and breakouts. The scouting order is the public national rank. Exact
freshman and future ratings, along with the scouting inputs, remain hidden
during recruiting. A hidden ten-point range containing the freshman rating is
retained with the prospect and later becomes recruiting history.

AI public talent value uses the same visible stars and within-star national
rank available to the player:

```text
public talent =
  0.90 × (stars × 20)
  + 0.10 × within-star national-rank percentile
```

Playing-time fit uses the common expected freshman rating for the public star
label, not a prospect-specific hidden estimate:

| Stars | Expected freshman rating |
| ---: | ---: |
| 1 | 30 |
| 2 | 30 |
| 3 | 50 |
| 4 | 67 |
| 5 | 79 |

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

Three-star prospects use a strong linear prestige blend:

```text
three-star fit = 0.35 × ordinary fit + 0.65 × prestige fit
```

These curves preserve program-quality separation as generated classes replace
bootstrap rosters without creating eligibility cutoffs. Two- and one-star fit
remains entirely preference-driven. A shortage of starters receives hard AI
priority only for three- and two-star targets.

Initial-roster allocation reuses these prestige shapes rather than annual
rounds and point spending: elite recruits receive the nonlinear signal,
three-stars receive a strong linear signal, and lower labels receive a weaker
linear signal. Seeded individual preference noise and a willing-destination
set create overlap without assigning or targeting any team's eventual rating.

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
single-season quotas. Each team-season also records offense, defense, overall,
roster-mean, and the 23 non-specialist starters that contribute to the team
rating, including their elite-rating counts. These diagnostics expose how the
player distribution becomes the mature roster and team-rating distribution
without involving game simulation. Run the production evaluator with:

Mature-roster overlap is measured as the share of within-season team pairs in
which the lower-prestige team has the strictly higher overall rating. Ties are
reported separately. Initial diagnostic targets express the intended product
shape without acting as recruiting acceptance gates:

| Prestige gap | Lower tier rated higher |
| ---: | ---: |
| 1 | 20–35% |
| 2 | 5–15% |
| 3 | 0–2% |

Larger gaps remain visible diagnostics. These comparisons use absolute team
ratings and never normalize a league's best or worst roster to a fixed endpoint.

```bash
npm run eval:recruiting-balance -- \
  --seed 20260727 --seeds 3 --seasons 4 --replay-seeds 1
```

The deterministic player-rating audit owns the national 90+, 95+, 98+, and 99
rarity bands, class percentiles, star-label means, monotonic development,
50%/35%/15% timing shares, three-star-over-five-star senior crossover, and
walk-on ordering. Its multi-league active-roster report also records initial
team-rating percentiles, star composition, and lower-prestige rating inversions
for direct comparison with the mature-roster recruiting diagnostics:

| Rating | Players per active league |
| ---: | ---: |
| 90+ | 200–300 |
| 95+ | 25–50 |
| 98+ | 3–8 |
| 99 | 0–2 |

```bash
npm run eval:player-ratings
```

## Invariants

- AI receives no exact ratings, future ratings, or hidden
  bonuses.
- All teams use the same public talent, fit, capacity, and commitment rules.
- New AI admissions are exclusive; existing and player-created competition is
  preserved.
- Recruiting formulas stay in pure domain modules; persisted commands only
  coordinate and apply their results.

## Source Map

- `src/domain/recruiting/generation.ts`
- `src/domain/recruiting/config.ts`
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
- `scripts/eval_player_ratings.ts`
