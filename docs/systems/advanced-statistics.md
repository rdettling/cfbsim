# Advanced Statistics and Performance Index

## Purpose

Defines the current-season play metrics and backward-looking Performance Index
shown on Advanced Statistics. Team Rating remains the forward-looking
simulation strength, Performance Index measures how a team played, and Résumé
Score measures wins and losses relative to schedule difficulty.

## Inputs and Ownership

`teamPerformance.ts` owns completed-game play aggregation,
`performanceIndex.ts` owns the descriptive index formula, and
`advancedStats.ts` composes the page's poll and presentation fields. The loader
reads the current league, completed current-year games, and persisted game
details. None of these projections is separately persisted.

Only scrimmage calls count. Tries, punts, field goals, spikes, kneels, and other
clock-management calls are excluded. Drives and overtime possessions remain in
the completed-game evidence.

## Page Views

Advanced Statistics opens on four focused views in this order:

1. **Performance** shows Performance Index, its offense and defense units,
   and the separate forward-looking Team Rating.
2. **Poll** explains the official ranking through Poll Score, Team Rating prior,
   Team Score, Evidence Score, Résumé Score, Performance Index, games, and record.
3. **Offense** exposes the completed-play efficiency inputs behind Offense
   Performance.
4. **Defense** exposes the opponent efficiency inputs behind Defense Performance.

The Poll view opens in official poll order. Sorting a component reorders rows
for comparison without changing the official rank shown beside each team. On
desktop, every poll component is a sortable column; mobile initially emphasizes
official rank and Poll Score and provides a focused-metric selector. Expanding a
team shows its exact current equations and the raw Team Rating mapped into Team
Score. A Glossary action beside the page heading explains every ranking term,
formula, prior boundary, performance concept, and detailed offense/defense
metric without permanently occupying page space.

## Public Metrics

- **Success Rate**: at least 50% of needed yards on first down, 70% on second,
  or 100% on third or fourth. Sacks and turnovers are unsuccessful.
- **Standard Downs**: first down, second-and-7 or fewer, and
  third/fourth-and-4 or fewer. Other scrimmage situations are passing downs.
- **Explosive Play Rate**: runs of at least ten yards or passes of at least
  twenty yards as a share of scrimmage plays.
- **Successful-Play Yards**: average yards on successful plays, a transparent
  yardage analogue to IsoPPP without a trained expected-points model.
- **Points per Opportunity**: points per drive reaching the opponent 40.
- **Havoc Rate**: sacks, interceptions, fumbles, and negative runs as a share
  of scrimmage plays. Pass breakups are unavailable in persisted plays.
- **Line Yards per Carry**: losses receive 120% credit, yards through four get
  full credit, yards five through ten get half credit, and later yards get none.
- **Stuff Rate**: runs stopped at or behind the line of scrimmage.
- **Average Start**: offense-relative `0–100` drive starting field position.

References:

- [Advanced college football stats glossary](https://www.footballstudyhall.com/2018/2/2/16963820/college-football-advanced-stats-glossary)
- [Revisiting the Five Factors](https://www.footballstudyhall.com/2014/3/31/5563418/college-football-five-factors-statistics)
- [Offensive line statistics](https://www.footballstudyhall.com/2011/4/26/2132589/the-toolbox-offensive-line-stats)
- [CollegeFootballData advanced box score](https://apinext.collegefootballdata.com/api/games)

## Performance Index

Performance Index uses completed-game evidence only. It never reads the
evaluated team's rating, wins, losses, location, margin, or Poll Score.

```text
raw offense or defense =
  0.50 × success-rate z-score
  + 0.15 × successful-play-yards z-score
  + 0.15 × points-per-opportunity z-score
  + 0.10 × average-start z-score
  + 0.10 × havoc z-score
```

Directions reverse where lower is better. Missing scoring opportunities are
neutral rather than zero-point evidence.

Every completed opponent contributes once, regardless of play count:

```text
opponent Team Score = clamp((rating − 25) / (99 − 25) × 100, 0, 100)
opponent signal = (opponent Team Score − 50) / 15
adjusted unit = raw unit + 0.35 × average opponent signal

unit Performance = clamp(50 + 15 × adjusted unit, 0, 100)
Performance Index = average of offense and defense Performance
```

Completed-game performance enters at full weight immediately. Zero-game teams
store neutral projections internally and display no performance value. Early
poll stability remains the responsibility of the separate Team Rating prior.

## Product Boundaries

- Team Rating is forward-looking and remains the game simulation authority.
- Performance Index is backward-looking and uses Team Rating only for opponents.
- Résumé Score contains only record and Wins Over Expectation.
- Evidence Score combines Résumé Score and Performance Index at `13/18` and
  `5/18`. It is displayed on the Poll view and becomes Poll Score after a
  team has completed eight games.
- Before eight games, Poll Score blends Evidence Score with a declining Team
  Rating prior. Previous rank never affects Poll Score.
- Performance Index does not affect simulation results, odds, players, or
  persisted team strength.
- Before games begin, Poll shows published Poll Score, a 100% Team Rating prior,
  Team Rating, and Team Score. Evidence, résumé, and performance values display
  as unavailable until completed-game evidence exists.
- Published rank and Poll Score remain primary during a partially completed week
  or a postseason freeze. The Poll view labels the newly derived value as a
  current projection until the normal ranking publication persists it.
- Playoff selection and championship placement can make official rank differ
  from Poll Score order. Poll rows label those overrides only after an actual
  playoff field is saved or the championship placement is finalized, without
  replacing the model score.

`npm run eval:performance-index` predicts subsequent games across ten seeded
seasons using both adjusted and otherwise-identical unadjusted performance. The
adjusted second-half accuracy may not trail raw performance by more than one
percentage point, every score must be finite and within `0–100`, and replay must
match exactly.

## Invariants

- Only completed current-year games and matching details count.
- Changing a team's own Team Rating cannot change its Performance Index.
- Changing an opponent Team Rating moves the adjustment in the expected direction.
- All ties resolve by Team ID and loading the page is read-only and deterministic.
