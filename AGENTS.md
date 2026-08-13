# AGENTS.md

This file is for Codex/agent context. For human‑readable docs, see:
- `docs/README.md` for docs index
- `docs/architecture/system-overview.md` for system overview
- `docs/architecture/static-data.md` for static-data ownership and workflows
- `docs/frontend/README.md` for frontend principles, patterns, and completion criteria

## Conventions

- Active app lives at repo root `src/`
- Frontend visuals stay clean, simple, and utilitarian
- All code stays lean, explicit, directly imported, and easy for an LLM to
  navigate
- Domain logic goes under `src/domain/`
- Page data loaders live under `src/domain/league/loaders/`
- Shared helpers live under `src/domain/league/utils/` or `src/domain/utils/`
- Types live under `src/types/`

## Current-Version Policy

- Support exactly one current architecture, persisted schema, and internal API
  shape
- Do not add migrations, compatibility aliases, fallback fields, legacy
  adapters, synthesized persisted state, or repair-on-read behavior
- Remove obsolete paths when replacing behavior instead of retaining parallel
  implementations
- Prefer small domain modules, explicit transaction ownership, and direct
  dependencies over generalized frameworks or indirection
- Only introduce backward compatibility when a current product requirement
  explicitly calls for it

## Static Data

- Edit canonical inputs only; never hand-edit generated projections
- After canonical data changes, run `npm run data:build` and then
  `npm run data:check`
- Keep provider-specific CFBD normalization under `scripts/`; runtime code uses
  canonical program and conference names only

## Gotchas

- IndexedDB is the source of truth
