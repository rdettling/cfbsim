# AGENTS.md

This file is for Codex/agent context. For human‑readable docs, see:
- `DEV_SETUP.md` for setup/run commands and env vars
- `ARCHITECTURE.md` for system overview

## Conventions

- Backend code lives under `backend/`
- Run Python commands with `uv run`
- Keep `uv.lock` in sync with `pyproject.toml`

## Gotchas

- SQLite has a variable limit; large bulk updates should be batched
- Data files in `backend/data/` are required for simulations
