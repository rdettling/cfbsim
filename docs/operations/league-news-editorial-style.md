# League News Editorial Style

This document owns the reader-facing voice and variety contract for persisted
league-news copy. Factual eligibility and editorial hierarchy remain owned by
the typed production policy and template metadata.

## Voice

Headlines use sentence case, active construction, and a modern national
sports-desk voice. Energy follows verified context: postseason consequence,
major upsets, comebacks, late finishes, overtime, rivalry stakes, exceptional
players, defense, and decisive margins earn progressively stronger language.
Routine results stay direct.

Headlines never use exclamation points. They do not invent momentum, emotion,
history, or game chronology. Named bowls and postseason advancement remain
explicit whenever those identities lead the story.

## Evidence-Bound Language

- `stuns` and `shocks` require odds-upset evidence.
- `edges`, `escapes`, and `survives` require a one-score margin, a verified late
  finish, or overtime.
- `rout` language requires the existing blowout fact.
- Rankings refer only to the editorial top 25.
- Every story displays the final score in either the headline or its one-sentence
  deck.

## Headline and Deck Relationship

Headline templates declare their syntax family, emphasized facts, score
inclusion, game types, and factual requirements. Deck templates declare the
same metadata plus their deck-rule family. Generation first chooses a headline,
then selects the highest-priority verified deck fact not already emphasized.
When no additional fact exists, the deck may reinforce the headline. A deck
always carries the score when the headline omits it.

Selection is stateless and deterministic from current-game identity and facts.
Headline and deck catalogs use independent random forks so editing one catalog
does not perturb selection in the other.

## Variety

Variants must change sentence structure, focus, or information order; synonym
or punctuation swaps do not constitute distinct structures. The audit measures
syntax families, normalized construction concentration, exact repetition
within a simulated season, and collisions among the five stories sharing a
weekly front page. Exact matches across alternate seeded universes are reported
separately because readers never encounter them together.
