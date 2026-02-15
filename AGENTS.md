# AGENTS.md

This file is for Codex/agent context. For human‑readable docs, see:
- `DEV_SETUP.md` for setup/run commands and env vars
- `ARCHITECTURE.md` for system overview

## Conventions

- Active app lives under `frontend2/`
- Legacy stack lives under `legacy/`
- If using the legacy backend, run Python commands with `uv run`
- Keep `legacy/uv.lock` in sync with `legacy/pyproject.toml` if legacy deps change

## Gotchas

- IndexedDB is the source of truth in `frontend2/`
- Legacy: SQLite has a variable limit; large bulk updates should be batched
- Legacy: data files in `legacy/backend/data/` are required for simulations
