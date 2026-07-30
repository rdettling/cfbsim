# Product Improvement Roadmap

## Status

This document collects proposed product improvements. It describes possible
future work, not current behavior or committed requirements.

## Product Direction

The existing game already has a substantial annual loop: scheduling, weekly
simulation, rankings, postseason play, progression, recruiting, roster cuts,
and historical realignment. The highest-value improvements should make that
world feel more persistent, reactive, and distinct rather than adding
randomness for its own sake.

Each major addition should create at least one of:

- a meaningful player decision;
- a memorable story with lasting context;
- a visible consequence in a later stage or season.

New systems should continue to use explicit domain modules, guarded command
ownership, and IndexedDB as the authoritative runtime state.

## Priorities

| Priority | Improvement | Primary Benefit | Estimated Scope |
|---:|---|---|---|
| 1 | Dynasty records and storylines | Persistent history and emotional continuity | Medium |
| 2 | Preseason expectations | Contextual goals for every program | Low-Medium |
| 3 | Ranking and resume explanations | More credible polls and playoff decisions | Low-Medium |
| 4 | Starting-roster calibration and team identity | More distinct starting programs | Medium |
| 5 | Expanded rivalry identity | Memorable recurring matchups | Medium |
| 6 | Transfer portal and early departures | Meaningful roster volatility | High |
| 7 | Injuries, coaches, facilities, and financial systems | Additional strategic depth | High |

## 1. Dynasty Records and Storylines

### Goal

Turn completed seasons into a world that remembers what happened.

### Possible Features

- Conference championships, playoff appearances, bowl wins, and national
  championships.
- Season-by-season user-team results and final rankings.
- All-time and user-era rivalry records.
- Longest winning streaks and rivalry streaks.
- Highest ranking, best record, and most successful season.
- Award winners and single-season statistical leaders.
- Biggest upset, largest victory, and closest loss.
- Records against individual opponents and conferences.
- Milestone stories such as a first ranked win in several seasons.
- A chronological Dynasty Timeline combining major team and player events.

### Product Value

Games and awards already produce useful events, but their emotional value
drops when later seasons do not reference them. Persistent records allow
ordinary regular-season games to become part of a larger story.

### Design Notes

- Store durable facts rather than generated prose.
- Derive presentation text from typed event categories.
- Keep complete game and player data in their existing stores; persist only
  the compact historical facts needed across seasons.
- Allow team history and the season summary to link into the same underlying
  record-book data.

## 2. Preseason Expectations

### Goal

Give every program a meaningful definition of success beyond winning the
national championship.

### Possible Expectations

- Rebuilding season.
- Reach bowl eligibility.
- Finish in the conference's upper half.
- Reach the conference championship.
- Win the conference.
- Reach the playoff.
- Compete for the national championship.

### Inputs

Expectations could use:

- current prestige;
- recent results;
- current team ratings;
- conference strength;
- prior-season finish;
- returning roster experience.

### End-of-Season Evaluation

The season summary could classify performance as:

- historic;
- exceeded expectations;
- met expectations;
- disappointing;
- major failure.

The evaluation could influence prestige and recruiting recent-success inputs,
but should not replace actual wins, rankings, and championships.

### Design Notes

- Expectations must be fixed before the season begins.
- Evaluation rules should be visible and deterministic.
- A seven-win season should carry different meaning at a rebuilding program
  than at a national-title contender.

## 3. Ranking and Resume Explanations

### Goal

Make poll movement and playoff selection understandable without exposing
implementation-only formulas.

### Possible Resume Fields

- Strength of schedule.
- Strength of record.
- Ranked wins.
- Best win.
- Worst loss.
- Road wins.
- Conference record and championship status.
- Current playoff status.
- Change from the previous ranking.

### Weekly Explanations

Rankings could include concise reasons such as:

- gained a quality road win;
- benefited from losses above it;
- fell after a poor loss;
- remained behind a team with a stronger resume;
- secured an automatic bid;
- moved onto or off the playoff bubble.

### Design Notes

- Explanations should be derived from the same inputs that determine rankings.
- The UI should distinguish objective resume facts from poll inertia.
- Explanations must not imply criteria the ranking engine does not actually
  use.

## 4. Starting-Roster Calibration and Team Identity

### Goal

Make teams in the same prestige tier feel distinct when beginning a new
league.

### Current Opportunity

Initial synthetic rosters are distributed primarily through program prestige,
and every team starts with an evenly sized four-class structure. This is
structurally reliable, but it can make similarly prestigious teams feel too
alike.

### Proposed Starting-Strength Inputs

A starting year could optionally include a separate validated team-strength
dataset containing:

```text
team
overall_strength
offense_strength
defense_strength
roster_experience
```

These values should be derived from completed prior-season inputs and should
influence bootstrap roster construction without replacing long-term prestige.
A useful conceptual model is:

```text
initial roster strength =
  long-term prestige +
  recent team strength +
  controlled seeded variation
```

This allows an ascending team to begin with a strong roster without
permanently treating it as an elite program.

### Team Archetypes

Programs could also receive visible identities such as:

- balanced;
- run-heavy;
- pass-heavy;
- offense-first;
- defense-first;
- developmental.

Archetypes should affect roster composition or simulation tendencies, not
serve as decorative labels.

### Design Notes

- Keep starting prestige and starting roster strength separate.
- Validate strength coverage for every team in the selected starting year.
- Preserve deterministic bootstrap behavior from the league seed.
- Avoid using future-season results to construct a starting roster.

## 5. Expanded Rivalry Identity

### Goal

Turn existing named rivalry games into persistent relationships.

### Possible Features

- Series records and recent results.
- Current winning streak.
- Named rivalry trophies.
- Rivalry history on game previews.
- Special headlines and season-summary recognition.
- Additional expectation or prestige consequences for major rivalry upsets.
- User-era records against rivals.
- Emergent rivalries after repeated close or postseason games.

### Design Notes

- Existing rivalry schedule data should remain the source of established
  matchups.
- Long-term rivalry state should store results, not duplicate complete games.
- Any gameplay bonus should remain modest enough that rivalry labeling does
  not overwhelm team quality.

## 6. Transfer Portal and Early Departures

### Goal

Create roster volatility that connects playing time, progression, recruiting,
and program success.

### Recommended Initial Portal Scope

- One explicit portal phase in the offseason.
- Players enter based on playing time, depth-chart position, team success, and
  geographic preference.
- A smaller, shorter recruiting process than high-school recruiting.
- Visible player rating and remaining eligibility.
- Deterministic AI decisions using the same public player information.
- Incoming transfers count directly against the final roster limit.

The first version should not require NIL, scholarships, promises, or staff
attributes.

### Early Departures

Early professional departures should be introduced with or immediately before
the portal. They create unexpected openings and make elite roster retention
less automatic.

Departure probability could consider:

- player rating;
- class year;
- production;
- awards;
- team success;
- projected draft position.

### Design Notes

- Portal entry and destination selection must be separate explicit decisions.
- The lifecycle position must be unambiguous relative to progression,
  recruiting, and roster cuts.
- Roster-capacity rules must consider high-school commitments and transfers
  together.
- Portal additions require repeated-season balance evaluation.

## Later Expansion Areas

### Injuries

Injuries could increase depth-chart value and game-to-game variation, but they
require clear duration, recovery, lineup, and UI behavior. They should follow
richer roster identity rather than precede it.

### Coaching Carousel

Coaches could add schemes, recruiting ability, development, expectations, and
job movement. This is a large state surface and should only be added when
staff decisions materially change gameplay.

### Facilities and Program Investment

Facilities could provide a slow-moving program-development path. Any economy
should expose meaningful tradeoffs rather than functioning as a passive
upgrade tree.

### NIL and Financial Systems

NIL can deepen recruiting and retention, but it introduces valuation,
budgeting, and balancing complexity. It should not be required for the first
transfer-portal implementation.

## Recommended Sequence

### Phase 1: Surface More Value From Existing State

1. Add preseason expectations and end-of-season evaluations.
2. Add ranking and playoff resume explanations.
3. Add a durable dynasty record book and timeline.

This phase primarily makes existing simulation results more meaningful.

### Phase 2: Differentiate Programs

1. Add validated starting-strength inputs.
2. Calibrate synthetic starting rosters from prestige and recent strength.
3. Add team archetypes with visible gameplay effects.
4. Expand persistent rivalry presentation.

### Phase 3: Add Roster Volatility

1. Add early professional departures.
2. Add a focused transfer-portal phase.
3. Rebalance recruiting supply, roster limits, and AI planning.

### Phase 4: Add Deeper Management

Consider injuries, coaches, facilities, and financial systems only after the
earlier loops are coherent and well measured.

## Success Measures

Potential qualitative and quantitative checks include:

- Players can identify why their season was successful or disappointing.
- Rankings and playoff selections can be explained using visible resume facts.
- Teams with equal prestige still begin with meaningfully different strengths
  and identities.
- Dynasty history surfaces relevant past events without requiring manual
  recollection.
- Rivalry games retain context across many seasons.
- Portal and departure behavior creates roster decisions without producing
  widespread illegal or incomplete rosters.
- New systems remain deterministic under a fixed seed where existing
  simulation contracts require determinism.

## Product Boundaries

- Do not add a feature solely because it exists in real college football.
- Do not introduce hidden AI advantages.
- Do not duplicate authoritative game, player, or league state for
  presentation convenience.
- Do not add compatibility schemas or repair-on-read behavior for future
  systems.
- Prefer a small complete feature over several partially connected systems.
- Preserve fast season advancement; deeper immersion should not require
  repetitive mandatory interactions.

