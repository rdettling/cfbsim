# AGENTS.md

This file is for Codex/agent context. For human‑readable docs, see:
- `docs/README.md` for docs index
- `docs/architecture/system-overview.md` for system overview
- `docs/frontend/README.md` for frontend principles, patterns, and completion criteria

## Conventions

- Active app lives at repo root `src/`
- Frontend visuals stay clean, simple, and utilitarian
- Frontend code stays lean, explicit, and easy for an LLM to navigate
- Domain logic goes under `src/domain/`
- Page data loaders live under `src/domain/league/loaders/`
- Shared helpers live under `src/domain/league/utils/` or `src/domain/utils/`
- Types live under `src/types/`

## Gotchas

- IndexedDB is the source of truth
