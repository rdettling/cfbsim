# Documentation

Technical documentation is organized into architecture, subsystem, interface, and operations references.

## Continuing the Frontend Migration

Start a new frontend task by reading:

1. `AGENTS.md`
2. [Frontend Overhaul](frontend/README.md)
3. [System Overview](architecture/system-overview.md)
4. [Loaders and Page Contracts](interfaces/loaders-and-page-contracts.md)
5. The subsystem document named by the frontend milestone's source map

The offseason overhaul and Home/new-league migration are complete. Current
behavior lives in the lifecycle, loader-contract, persistence, configuration,
and validation references below. Consult the frontend overhaul document before
planning the next frontend phase.

## Frontend

- [Frontend Overhaul](frontend/README.md)

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
