# League News

## Purpose

This document owns the current league-news system: publishers, persisted story
contracts, factual eligibility, editorial hierarchy and voice, deterministic
copy selection, ordering, integrity, and offline evaluation.

## Publishers and Persistence

`NewsItem` is the explicit union of:

- `GameNewsItem`, keyed by `game:<gameId>`, for completed games;
- `RankingNewsItem`, keyed by `rankings:<year>:<week>`, for material poll
  movement and the final playoff field;
- `PreviewNewsItem`, keyed by `preview:<year>:<angle>`, for the preseason poll,
  national outlook, and marquee opening matchup.

Completed games atomically persist their story with the compact game, nested
detail, and league mutation. Season initialization atomically writes the three
preseason stories with the completed schedule. Ranking publication writes at
most one ranking item for a year and week. Published copy remains durable even
when ordinary historical game detail is pruned.

All mixed-feed code branches on the `type` discriminator. A new publisher must
extend the union, identity derivation, integrity validation, ordering,
presentation, persistence indexes, and loader behavior directly; it must not
inherit game behavior through a fallback path.

## Facts and Editorial Policy

Game stories are generated only from persisted game, detail, ranking, odds,
rivalry, team, and player facts. Reader-facing ranks are limited to the top 25.
Major underdog evidence and material ranking-upset evidence remain distinct,
and a featured player requires an explicit exceptional-performance qualifier.

Primary angles follow verified consequence before supporting context:
championship and playoff advancement, named bowls, upsets, comebacks, late
deciders, overtime, rivalries, exceptional players, defense, blowouts, ranked
results, then routine results. Rankings stories publish only material poll
change or the final configured playoff field. Preview stories describe the
persisted preseason poll, national outlook, and highest-rated eligible opener.

Newsworthiness has three typed dimensions:

- consequence from game or publication type;
- national relevance from editorial ranking, rivalry, or an exceptional
  player;
- drama from verified upset, overtime, late finish, comeback, defense, or
  margin facts.

Program prestige and user-team identity do not affect national ordering.
Rankings used by game stories are frozen at game time.

## Voice and Copy Selection

Headlines use sentence case, active construction, and a modern national
sports-desk voice. Routine results remain direct; stronger language requires
verified consequence or drama. Headlines never invent momentum, emotion,
history, or chronology, and they do not use exclamation points.

- `stuns` and `shocks` require odds-upset evidence.
- `edges`, `escapes`, and `survives` require a one-score margin, verified late
  finish, or overtime.
- Rout language requires the current blowout fact.
- Named bowls and postseason advancement remain explicit when they lead.
- Every story carries the final score in either the headline or its
  one-sentence deck.

Headline and deck templates declare supported game types, required facts,
syntax family, emphasized facts, and score placement. Generation chooses a
headline, then the highest-priority verified deck fact not already emphasized;
the deck may reinforce the headline only when no complementary fact exists.

Selection is stateless and deterministic from current identity and facts.
Headline and deck catalogs use independent random forks, so editing one does
not perturb selection in the other. Template and copy version constants are
owned by the production generators rather than duplicated here.

Variants must change sentence structure, focus, or information order;
punctuation or synonym swaps alone are not distinct structures.

## Ordering and Integrity

Feed ordering is deterministic from importance, item type, and stable identity.
Persisted validation recomputes identity and checks exact current shapes,
current team and player references, unique ranking weeks and preview angles,
and one story for every completed game with none for unplayed games.

Editorial traces contain verified facts, selected template and deck-rule IDs,
syntax metadata, emphasized facts, score placement, and the newsworthiness
breakdown. Traces are ephemeral: runtime callers discard them after persisting
the rendered `NewsItem`.

## Offline Audit

`eval:news` runs production schedules, simulation, fact extraction, and story
generation in memory. It writes only ignored files under
`.artifacts/news-audit/` and never writes IndexedDB, tracked data,
configuration, or templates.

The representative audit is:

```text
npm run eval:news -- --seed 20260809 --seeds 3 --seasons 2 --replay-seeds 1
```

`npm run test:news:representative` locks its accepted content checksum without
writing audit artifacts.

Structural, factual, identity, template-contract, eligibility, ranking-language,
context-coverage, and deterministic-replay violations fail the command.
Repetition, syntax concentration, angle mix, front-page composition, and
featured-position distribution remain review findings.

The accepted news-content checksum is `0f2ab83d`. The content checksum excludes
importance so scoring changes can prove that copy, angles, storylines, teams,
and featured players did not drift. An intentional copy or editorial-contract
change must update the accepted baseline together with its audit evidence.

## Invariants

- Persist only exact `NewsItem` records; never persist editorial traces.
- Every published claim is derivable from verified production facts.
- Reader-facing ranking language is limited to the editorial top 25.
- Copy selection and feed ordering are deterministic.
- Game consequences outrank compatible supporting context.
- Every completed game has exactly one durable game story.
- Audit output is offline diagnostic state, never application state.

## Source Map

- `src/types/news.ts`: persisted union and story angles.
- `src/domain/news/facts.ts`: game fact extraction.
- `src/domain/news/policy.ts`: editorial eligibility and rank policy.
- `src/domain/news/generate.ts`: game-story selection and trace generation.
- `src/domain/news/rankings.ts`: rankings and playoff-field publisher.
- `src/domain/news/previews.ts`: preseason publisher.
- `src/domain/news/newsworthiness.ts`: typed scoring dimensions.
- `src/domain/news/templates.ts`: headline catalog and contracts.
- `src/domain/news/deckTemplates.ts`: deck catalog and contracts.
- `src/domain/news/ordering.ts`: mixed-feed ordering.
- `src/domain/news/presentation.ts`: reader-facing routing and labels.
- `src/db/newsIntegrity.ts`: identity and cross-record validation.
- `src/db/newsRepo.ts`: validated reads.
- `scripts/evaluation/shared/seasonCorpus.ts`: deterministic season corpus.
- `scripts/evaluation/news/`: news observers, scenarios, audits, and reporting.
- `scripts/eval_news.ts`: command boundary and artifact writing.
