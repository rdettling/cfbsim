# AGENTS.md

This file is for Codex/agent context. For human‑readable docs, see:
- `docs/README.md` for docs index
- `docs/architecture/system-overview.md` for system overview

## Conventions

- Active app lives at repo root `src/`
- Domain logic goes under `src/domain/`
- Page data loaders live under `src/domain/league/loaders/`
- Shared helpers live under `src/domain/league/utils/` or `src/domain/utils/`
- Types live under `src/types/`

## Gotchas

- IndexedDB is the source of truth
