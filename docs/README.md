# Documentation

These documents describe current product behavior, architecture, interfaces,
and validation. Implementation history belongs in Git, not here.

## Start Here

For frontend work, read:

1. [`AGENTS.md`](../AGENTS.md)
2. [Frontend Principles and Patterns](frontend/README.md)
3. [System Overview](architecture/system-overview.md)
4. [Loaders and Page Contracts](interfaces/loaders-and-page-contracts.md)
5. The affected subsystem document

For recruiting balance work, start with
[Recruiting Hierarchy](design/recruiting-hierarchy.md).

## Document Ownership

| Document | Why it exists |
|---|---|
| [Frontend Principles and Patterns](frontend/README.md) | Defines UI structure, responsive behavior, accessibility, and completion standards. |
| [System Overview](architecture/system-overview.md) | Maps runtime layers, authoritative state, lifecycle, and core invariants. |
| [Data Model and Persistence](architecture/data-model-and-persistence.md) | Defines IndexedDB records, integrity boundaries, and write ownership. |
| [Season State Machine](architecture/season-state-machine.md) | Defines stage transitions, command owners, and route read behavior. |
| [Interactive Recruiting and Roster Finalization](design/interactive-recruiting.md) | Defines current player-facing recruiting and roster rules. |
| [Recruiting Hierarchy](design/recruiting-hierarchy.md) | Defines public talent, prestige effects, AI policy, class scoring, and balance validation. |
| [Roster and Recruit Supply](design/roster-and-recruit-supply.md) | Defines the 80-player roster economy, positional totals, recruit pool, and elite hierarchy. |
| [Product Improvement Roadmap](design/product-improvement-roadmap.md) | Collects proposed immersion, realism, and long-term product improvements. |
| [Simulation Engine](systems/simulation-engine.md) | Explains game simulation inputs, execution, mechanics, and invariants. |
| [Scheduling and Week Advancement](systems/scheduling-and-week-advancement.md) | Defines schedule creation, week progression, and postseason orchestration. |
| [Roster Progression and Recruiting](systems/roster-progression-and-recruiting.md) | Defines roster and recruiting implementation flow. |
| [Rankings, Playoff, and Awards](systems/rankings-playoff-and-awards.md) | Defines competitive ranking and postseason subsystems. |
| [Loaders and Page Contracts](interfaces/loaders-and-page-contracts.md) | Defines read-only page projections and their invariants. |
| [UI Sim Integration](interfaces/ui-sim-integration.md) | Defines live simulation ownership and UI synchronization. |
| [Configuration and Tuning](operations/configuration-and-tuning.md) | Identifies behavior controls and safe change boundaries. |
| [Validation and Test Strategy](operations/validation-and-test-strategy.md) | Defines commands, scenarios, and acceptance checks. |

## Documentation Rules

- Describe one current architecture and product shape.
- Keep implementation history in Git.
- Link to the owning document instead of duplicating its contract.
- Prefer invariants, data flow, and source maps over narrative.
- Delete a document when it no longer owns a distinct decision surface.
