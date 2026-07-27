# Documentation

Technical documentation is organized into architecture, subsystem, interface, and operations references.

## Starting Frontend Work

Start frontend work by reading:

1. [`AGENTS.md`](../AGENTS.md)
2. [Frontend Principles and Patterns](frontend/README.md)
3. [System Overview](architecture/system-overview.md)
4. [Loaders and Page Contracts](interfaces/loaders-and-page-contracts.md)
5. The subsystem document relevant to the feature

Current lifecycle, loader, persistence, configuration, and validation behavior
is recorded in the references below. New features should preserve those
contracts unless the feature explicitly changes them.

## Frontend

- [Frontend Principles and Patterns](frontend/README.md)

## Architecture

- [System Overview](architecture/system-overview.md)
- [Data Model and Persistence](architecture/data-model-and-persistence.md)
- [Season State Machine](architecture/season-state-machine.md)

## Systems

- [Simulation Engine](systems/simulation-engine.md)
- [Scheduling and Week Advancement](systems/scheduling-and-week-advancement.md)
- [Roster Progression and Recruiting](systems/roster-progression-and-recruiting.md)
- [Rankings, Playoff, and Awards](systems/rankings-playoff-and-awards.md)

## Interfaces

- [Loaders and Page Contracts](interfaces/loaders-and-page-contracts.md)
- [UI Sim Integration](interfaces/ui-sim-integration.md)

## Operations

- [Configuration and Tuning](operations/configuration-and-tuning.md)
- [Validation and Test Strategy](operations/validation-and-test-strategy.md)
