# IndexedDB Migration Plan

## Decisions
- Target: full client-side, offline-first. Start with a hybrid phase if it reduces risk.
- Schema changes: wipe-and-recreate (no migrations).
- DB library: use `idb` for a small, clean wrapper around IndexedDB.
- UI: keep existing screens; only change data access as needed.
- Performance focus: eliminate backend write amplification (e.g., per-play persistence during week sim).

## Phases
1. **Inventory + Schema Design**
   - Map Django models and required persisted state to IndexedDB stores.
   - Separate “derived” data from “source of truth” data.
   - Define store keys, indices, and denormalization strategy for fast reads.

2. **Client DB Foundation**
   - Add `idb` and a `db` module with `openDb()`.
   - Implement wipe-on-schema-mismatch: if expected stores are missing, delete DB and recreate.
   - Add a small repository layer (e.g., `leagueRepo`, `scheduleRepo`, `statsRepo`).

3. **Hybrid Bridge (Optional, Transitional)**
   - Keep backend as source-of-truth for initial load.
   - Implement import: fetch initial league state from API and write to IndexedDB.
   - Route reads in the frontend to IndexedDB first.

4. **Move Sim Core Client-Side**
   - Extract sim logic from `backend/logic` into TS modules in `frontend/` (or shared package).
   - Replace server sim endpoints with local simulation calls.
   - Persist only required outputs per step; avoid per-play storage unless explicitly requested.

5. **Performance + Storage Strategy**
   - Default to storing summaries; optional “store play-by-play” setting.
   - Batch writes and use large transactions to reduce overhead.
   - Add quota checks (`navigator.storage.estimate()`) and persistence request.

6. **Offline-First**
   - Cache base data locally (teams, ratings, years).
   - Ensure full season sim and UI work without network after first load.

7. **Backend Removal / Minimal Backend**
   - Remove reliance on server for gameplay.
   - Optionally keep backend for hosting static data or future cloud sync.

## Deliverables
- IndexedDB schema + repository layer.
- Client-side sim pipeline.
- Offline-capable UI.
- Optional toggle to persist play-by-play vs summary-only.

