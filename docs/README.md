# Technical Documentation

The root [README](../README.md) explains CFB Sim for players. This directory is
the current engineering reference: each document owns a distinct contract, and
implementation history belongs in Git.

## Work on the Repository

Use Node 24 LTS, as recorded in `.nvmrc` and `package.json`.

```bash
nvm install
nvm use
npm ci
npm run dev
```

Before committing a change, run the validation appropriate to its scope. The
complete repository check is:

```bash
npm run data:check
npm test
npm run typecheck
npm run build
git diff --check
```

## Understand the Architecture

- [System Overview](architecture/system-overview.md) maps runtime layers,
  authoritative state, lifecycle flow, and application-wide invariants.
- [Data Model and Persistence](architecture/data-model-and-persistence.md)
  defines IndexedDB records, validation boundaries, and write ownership.
- [Season State Machine](architecture/season-state-machine.md) defines every
  stage transition and the command that owns it.

## Change a Game System

- [Simulation Engine](systems/simulation-engine.md) owns drive, play, clock,
  outcome, and game-finalization mechanics.
- [Simulation Engine Assessment](systems/simulation-engine-assessment.md)
  records the current depth, accepted diagnostic baseline, known limitations,
  and maintenance direction.
- [Simulation Calibration](systems/simulation-calibration.md) defines the
  frozen modern-FBS benchmark, comparable metric denominators, and diagnostic
  tolerance contract.
- [Scheduling and Week Advancement](systems/scheduling-and-week-advancement.md)
  owns preseason scheduling, the weekly simulation pipeline, and postseason
  game creation.
- [Rankings, Playoff, and Awards](systems/rankings-playoff-and-awards.md) owns
  ranking updates, postseason selection, bracket behavior, bowls, and awards.
- [Roster and Recruiting Lifecycle](systems/roster-and-recruiting.md) owns
  roster scale, progression, the player recruiting loop, Signing Day, roster
  cuts, and their transactions.
- [Recruiting Model](systems/recruiting-model.md) owns public talent, fit, AI
  strategy, class scoring, and balance expectations.

## Change the Frontend or an Interface

- [Frontend Principles and Patterns](frontend/README.md) defines layout,
  responsive behavior, accessibility, component boundaries, and completion
  standards.
- [Loaders and Page Contracts](interfaces/loaders-and-page-contracts.md)
  defines read-only page projections and integrity rules.
- [UI Simulation Integration](interfaces/ui-sim-integration.md) defines live
  simulation session ownership, persistence, and page refresh behavior.

## Configure and Validate Behavior

- [Configuration and Tuning](operations/configuration-and-tuning.md) identifies
  runtime tuning, league settings, recruiting controls, and generated data.
- [Validation and Test Strategy](operations/validation-and-test-strategy.md)
  maps change types to automated checks and lifecycle scenarios.
- [League News Editorial Style](operations/league-news-editorial-style.md)
  defines reader-facing voice, evidence-bound language, and copy variety.

## Documentation Rules

- Describe only the current product, architecture, persisted schema, and API.
- Put proposals in the issue tracker and implementation history in Git.
- Give each contract one owning document; link to it instead of duplicating it.
- Prefer invariants, data flow, and source maps over file-by-file narration.
- Verify code paths, symbols, links, and numeric claims whenever behavior
  changes.
- Delete a document when it no longer owns a distinct decision surface.
