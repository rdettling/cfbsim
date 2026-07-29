# Roster and Recruit Supply

## Purpose

This document owns the current roster economy and annual recruit supply. These
values establish the scale on which recruiting, walk-ons, cuts, and roster
progression operate.

## Roster Economy

The final active roster contains 80 players:

| Position | Players |
|---|---:|
| QB | 5 |
| RB | 6 |
| WR | 9 |
| TE | 6 |
| OL | 15 |
| DL | 11 |
| LB | 9 |
| CB | 8 |
| S | 7 |
| K | 2 |
| P | 2 |

`src/domain/rosterConfig.ts` is the single source of truth. It derives the
80-player final size, the four-player legal oversign allowance, and the
84-player maximum. Recruiting capacity, bootstrap, walk-ons, cuts, loaders,
evaluation, and tests consume those constants.

AI planning targets two oversignings. A team with 20 base openings therefore
normally targets 22 commitments, while authoritative rules permit at most four
oversignings. The fixed target is intentional; class-size variation emerges in
later seasons as prior class sizes and roster cuts affect returning counts.

## Initial Rosters

New leagues start with four exact 20-player classes. Bootstrap assigns each
position's quotient across all four classes and distributes remainders
deterministically. Every team therefore starts with:

- exactly 80 active players;
- exactly 20 freshmen, sophomores, juniors, and seniors;
- the approved combined positional totals;
- stable seeded players and IDs;
- no post-generation positional trimming.

## Annual Recruit Supply

Each recruiting year contains 3,372 prospects:

| Stars | Prospects |
|---:|---:|
| 5 | 32 |
| 4 | 340 |
| 3 | 2,800 |
| 2 | 200 |

Five- and four-star supply is intentionally preserved at national scale.
Three-stars supply ordinary roster depth. Two-stars are a fringe buffer:
most remain unsigned, but lower-quality programs may sign them. Walk-ons remain
the legal-roster safety net rather than normal class construction.

The lower-tier split is sized to complete base classes without systematic
walk-ons while leaving some three-stars and most two-stars unsigned.

## Supply Expectations

Repeated-season validation should show:

- nearly all five- and four-stars signing;
- five-stars concentrated overwhelmingly at prestige 6–7;
- some three-stars remaining unsigned;
- most two-stars remaining unsigned, with occasional lower-program signings;
- base classes completing without routine walk-ons;
- class sizes governed by roster openings and the two-player AI oversigning
  target rather than a universal signing quota.

Prestige access and class quality are owned by
[Recruiting Hierarchy](recruiting-hierarchy.md). Supply diagnostics are
aggregate expectations, not hard per-season quotas.

## Deferred Systems

Early NFL departures and the transfer portal are future sources of roster
turnover. They must be added as explicit lifecycle behavior and then evaluated
against this economy. The current system does not simulate either through
hidden attrition.

## Source Map

- `src/domain/rosterConfig.ts`
- `src/domain/rosterBootstrap.ts`
- `src/domain/rosterBootstrapPool.ts`
- `src/domain/recruiting/config.ts`
- `src/domain/recruiting/fit.ts`
- `src/domain/recruiting/evaluation.ts`
- `src/domain/walkOns.ts`
- `src/domain/rosterCuts.ts`
