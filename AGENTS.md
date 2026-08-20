# AGENTS.md

This file contains the universal rules for agent work in this repository. Use
`docs/README.md` to find the one engineering document that owns the subsystem
being changed.

## Core Conventions

- The active application lives under `src/`.
- Keep code lean, explicit, directly imported, and easy for an LLM to navigate.
- Domain logic lives under `src/domain/`; shared types live under `src/types/`.
- Pages load through `src/domain/league/loaders/` and never write persisted
  league state directly.
- User-triggered league lifecycle and configuration writes live under
  `src/domain/league/commands/`. Simulation writes flow through the simulation
  orchestrator and database repositories.
- Shared helpers live under `src/domain/league/utils/` or `src/domain/utils/`.
- IndexedDB is the authoritative runtime state.
- Frontend visuals stay clean, simple, and utilitarian. Follow
  `docs/frontend/README.md` for UI work.

## Change Discipline

- Identify the current owning module before editing; do not create a second
  owner for the same behavior.
- Implement the requested current behavior directly. When an internal contract
  changes, update every caller, validator, fixture, and test in the same
  change, then delete replaced fields, symbols, and files.
- Tests describe current required behavior; they are not compatibility
  requirements. Update or delete obsolete tests when a product change makes
  their expectations invalid.
- Do not add deprecated exports, compatibility aliases, feature flags,
  fallback fields, legacy adapters, repair logic, alternate implementations,
  or TODO scaffolding unless a current product requirement explicitly needs
  them.
- Extract shared code only after current reuse demonstrates a stable contract.
- Add a dependency only when it removes meaningful implementation complexity.
- Before finishing, remove code, exports, files, and documentation made
  obsolete by the change.

## Current-Version and Persistence Policy

- Support exactly one current architecture, persisted schema, and internal API
  shape.
- Do not add migrations or repair-on-read behavior.
- For a persisted-schema change, update the current schema, exact validators,
  fixtures, and tests; increment `DB_VERSION`; and allow the existing database
  to be discarded.
- Repository reads validate authoritative records and fail on invalid current
  state rather than normalizing or synthesizing it.

## Static Data

- Edit canonical inputs only; never hand-edit generated projections.
- After canonical data changes, run `npm run data:build` and then
  `npm run data:check`.
- Keep provider-specific CFBD normalization under `scripts/`; runtime code uses
  canonical program and conference names only.

## Verification

- Use `docs/operations/validation-and-test-strategy.md` to select checks based
  on the changed behavior and risk.
- Do not regenerate tracked data, refresh external sources, or run tuning
  workflows unless the task changes their authoritative inputs.
