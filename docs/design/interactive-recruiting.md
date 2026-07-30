# Interactive Recruiting and Roster Finalization

## Purpose

This document defines the player-facing recruiting and roster-finalization
rules. Implementation ownership lives in
[Roster Progression and Recruiting](../systems/roster-progression-and-recruiting.md);
talent evaluation, AI policy, and competitive balance live in
[Recruiting Hierarchy](recruiting-hierarchy.md).

## Player Loop

Recruiting is a six-week offseason stage:

1. Add prospects to a board of at most 25.
2. Assign any desired portion of the weekly point budget.
3. Advance the week; AI preserves those assignments and spends the feasible
   remainder.
4. Review commitments and updated public standings.
5. After week six, resolve Signing Day.

During active recruiting, **Advance Recruiting** in the shared stage
navigation opens a menu with **Advance Week** and **Sim to End of
Recruiting**. The simulation action confirms the skip, honors the current
week's assignments, gives AI full control of later weeks, resolves Signing
Day, creates freshmen, and enters Recruiting Summary atomically. After week
six, the control becomes **Next: Recruiting Summary** and resolves Signing Day
directly.

Recruiting Summary is read-only. Roster Cuts then requires the player to select
enough eligible returning players to produce a legal 80-player roster.

## Prospect Information

The recruiting experience exposes:

- name, home state, position, stars, and national rank;
- preferences for prestige, proximity, playing time, and recent success;
- the user team's fit;
- exact public interest standings, active offers, and lifetime points;
- commitments and the round in which they occurred.

Exact and future ratings, rating ranges, development traits, AI scores, and the
recruiting seed remain hidden through Recruiting Summary. Roster Cuts is the
first stage that reveals an incoming freshman's exact current rating.

National rank uses stars and a hidden, prospect-specific rating estimate. Stars
and national rank are the only talent signals exposed to both the player and
recruiting AI. Recruit preferences sum to 100 and weight four fit components:

- **Prestige**: linear from prestige 1 to 7 for ordinary preference fit.
- **Proximity**: same-state affinity.
- **Playing time**: starter path plus room against the position's soft target.
- **Recent success**: current team rank relative to the league.

Fit is clamped to 0–100 and is team-specific.

For four- and five-star prospects, ordinary preference fit contributes 10%
and a squared prestige curve contributes 90%. This makes elite signings by
prestige 1–2 programs rare without prohibiting any team from pursuing any
prospect. A starter shortage remains hard AI priority for three- and two-star
targets, but does not automatically elevate an elite target over plausibility.

## Points, Interest, and Commitments

Weekly team budgets range from 90 to 120 based on prestige. A team may allocate
at most 25% of its budget to one prospect.

Initial interest equals 40% of team fit. Weekly point effectiveness is:

```text
interest gain = points × (0.75 + fit / 200)
```

One point therefore produces 0.75–1.25 interest. Interest and lifetime points
accumulate; weekly allocations clear after resolution.

A team becomes a meaningful pursuer after investing 20 lifetime points. A
prospect commits during a normal week when the leading eligible pursuer:

- has at least 55 total interest;
- leads the runner-up by at least 10;
- has a current board offer;
- has reached the meaningful-pursuit minimum;
- can accept the commitment without making final roster completion illegal.

Commitments are binding. A committed prospect leaves every board.

At Signing Day, each unsigned prospect chooses the highest-interest eligible
meaningful pursuer. Seeded tie-breaking is stable for identical state.

## Signing Capacity and Roster Cuts

Recruiting projects each team from its returning active roster:

- **Base capacity** fills the roster to 80.
- **Maximum capacity** permits at most four additional commitments while
  remaining at or below 84.
- Commitment feasibility preserves a path to every positional starter minimum
  and a legal final roster.

Incoming freshmen are protected from cuts. Teams below 80 after recruiting
receive standard one-star walk-ons, prioritizing starter shortages and then
soft positional deficits.

The user selects cuts immediately through guarded commands. AI teams cut from
soft positional surplus using estimated senior value, current value, and class
while preserving starter minimums. Finalization:

1. reaches exactly 80 active players per team;
2. selects starters;
3. recalculates team ratings;
4. prepares the next preseason;
5. clears completed recruiting state.

## User Experience

The default page is board-first:

- every layout keeps the recruiting board as the primary workspace;
- Add Recruits opens the searchable public market in a responsive dialog;
- selecting a recruit from the board or market opens the same responsive
  public-details dialog;
- the details dialog exposes preferences and exact interest standings directly
  and supports adding or removing that recruit from the board;
- point controls remain on the board and support exact integer entry and Max;
- plain-language status is primary;
- submitted points are player-controlled weekly minimums, and AI spends only
  the feasible remainder.

Board changes persist immediately. Weekly point edits remain local until
advancement. The market remains open across additions so its current filters
and page can support adding several recruits. AI-added targets become ordinary
board members and may be removed by the player later.

Ordinary command failures retain compatible local edits. Stage, round, or
version conflicts reload IndexedDB, discard incompatible assumptions, and
recover the authoritative route.

## Competitive Intent

The desired hierarchy is:

- elite programs usually sign stronger classes;
- prestige provides a clear but bounded advantage;
- fit, positional opportunity, recent success, and allocation decisions create
  selective upsets;
- sustained success supports gradual mobility;
- AI receives no hidden talent information or invisible bonuses.

The star-only class score and nonlinear elite-prestige fit produce the current
hierarchy without using hidden ratings or eligibility bans. See
[Recruiting Hierarchy](recruiting-hierarchy.md) and
[Roster and Recruit Supply](roster-and-recruit-supply.md) before changing
recruiting AI or pool scale.

## Product Boundaries

The current product does not include:

- in-season recruiting;
- visits, calls, pitches, promises, or action cards;
- coach and staff recruiting attributes;
- NIL, scholarships, or financial systems;
- transfers, decommitments, or signing-day flips;
- scouting actions that narrow rating ranges;
- geographic distance beyond same-state affinity;
- hidden AI bonuses or adaptive catch-up modifiers.

## Non-Negotiable Invariants

- IndexedDB is authoritative.
- Loaders are read-only.
- Commands own guarded atomic mutations.
- One current schema and internal API are supported.
- Prospect generation, AI decisions, ties, and lifecycle results are
  deterministic from persisted state and seed.
- Human and AI allocations resolve simultaneously.
- Hidden prospect fields never cross the AI or loader public boundary.
- Recruiting Summary orders prospects by their public national rank and does
  not expose exact ratings or player-page links.
- Failed and stale commands leave every store unchanged.
- Every finalized roster has exactly 80 active players and satisfies all
  starter minimums.
