# Technical Documentation

The root [README](../README.md) explains CFB Sim for players. This directory is
the current engineering reference. Code and manifests are the executable source
of truth; these documents own intent, boundaries, invariants, and workflows.
Implementation history belongs in Git, while proposals and roadmap belong in
the issue tracker.

## Work on the Repository

Use the Node version recorded in `.nvmrc` and `package.json`:

```bash
nvm install
nvm use
npm ci
npm run dev
```

Use [Validation and Test Strategy](operations/validation-and-test-strategy.md)
to choose the checks required by a change.

## Architecture

- [System Overview](architecture/system-overview.md) maps runtime layers,
  authoritative state, command flow, lifecycle, and global invariants.
- [Data Model and Persistence](architecture/data-model-and-persistence.md)
  owns IndexedDB records, exact validation, retention, and transaction
  ownership.
- [Static Data System](architecture/static-data.md) owns canonical and generated
  assets, ingestion, runtime caching, and season maintenance.
- [Season State Machine](architecture/season-state-machine.md) owns every annual
  stage and transition.

## Product Systems

- [Simulation Engine](systems/simulation-engine.md) owns game resolution,
  drives, plays, clock, calls, participants, and game finalization.
- [Simulation Calibration](systems/simulation-calibration.md) owns the frozen
  benchmark, metric denominators, accepted baseline, and audit gates.
- [Scheduling and Week Advancement](systems/scheduling-and-week-advancement.md)
  owns preseason scheduling, weekly simulation, and postseason hooks.
- [Rankings, Playoff, and Awards](systems/rankings-playoff-and-awards.md) owns
  national ordering, selection, bracket behavior, bowls, and awards.
- [Roster and Recruiting Lifecycle](systems/roster-and-recruiting.md) owns
  progression, recruiting persistence, Signing Day, cuts, and finalization.
- [Recruiting Model](systems/recruiting-model.md) owns talent visibility, fit,
  AI strategy, class scoring, and balance expectations.
- [League News](systems/league-news.md) owns publishers, editorial policy,
  persisted stories, ordering, integrity, and the offline news audit.

## Frontend and Interfaces

- [Frontend Principles and Patterns](frontend/README.md) owns visual,
  responsive, accessibility, and component-boundary standards.
- [Loaders and Page Contracts](interfaces/loaders-and-page-contracts.md) owns
  read-only page projections and loader integrity rules.
- [UI Simulation Integration](interfaces/ui-sim-integration.md) owns live-game
  session coordination, persistence, and page refresh behavior.

## Operations

- [Configuration and Tuning](operations/configuration-and-tuning.md) identifies
  authoritative configuration surfaces, mutation rules, and change risk.
- [Validation and Test Strategy](operations/validation-and-test-strategy.md)
  owns common checks, statistical principles, and cross-system scenarios.

## Documentation Rules

- Describe only the current product, architecture, persisted schema, and API.
- Give each contract one owning document and link to it instead of duplicating
  rules, commands, constants, or source maps.
- Prefer invariants, data flow, and ownership over narration of discoverable
  implementation details.
- Keep acceptance values only when the document defines their active contract;
  otherwise reference the authoritative code or manifest.
- Verify paths, symbols, links, transaction claims, and numeric contracts when
  behavior changes.
- Delete a document when it no longer owns a distinct decision surface. Do not
  retain redirects or archival copies.
