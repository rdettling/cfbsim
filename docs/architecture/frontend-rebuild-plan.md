# Frontend Rebuild Plan

## Scope

Defines the plan for a full frontend rebuild of CFB Sim while keeping the existing simulation, league, and persistence layers intact wherever practical.

This document is intentionally biased toward a lean personal-project codebase: low abstraction count, small dependency surface, and straightforward feature ownership.

## Why Rebuild

The current frontend is functionally rich, but it has drifted into a shape that is hard to improve incrementally.

Primary reasons to rebuild:

- The UI has no strong shared visual language.
- Page components own too much layout, workflow, styling, and local orchestration at once.
- Navigation and refresh behavior rely on route state, manual refetching, and some hard reload patterns.
- The frontend surface area is larger than it needs to be for a personal project.
- A redesign done screen-by-screen would likely preserve most of the current sprawl.

## Project Constraints

These constraints should drive every frontend decision:

- This is a personal project, not a team platform.
- The codebase should stay lean and easy to modify quickly.
- IndexedDB remains the source of truth.
- Existing domain and loader logic should be reused unless it directly blocks the new UI.
- Sim correctness matters more than frontend cleverness.

## Rebuild Goals

1. Build a cleaner and more intentional visual identity.
2. Reduce frontend complexity and file sprawl.
3. Make the UI easier to change in one sitting.
4. Preserve the existing sim/domain behavior during the rewrite.
5. Remove ad hoc navigation and refresh patterns where possible.
6. Rebuild around a few repeatable page shapes rather than one-off screens.

## Non-Goals

- Rewriting the simulation engine.
- Replacing IndexedDB persistence.
- Building a large reusable design system.
- Introducing heavy app infrastructure for its own sake.
- Achieving one-to-one parity with every current screen before simplifying the product surface.

## Architectural Position

The current domain layer should be treated as an internal backend-like boundary.

Keep as much of this intact as practical:

- `src/domain/**`
- `src/db/**`
- stable loader contracts that already match the app's runtime model

Assume the main rewrite target is:

- `src/pages/**`
- `src/components/**`
- `src/App.tsx`
- the current layout/navigation shell

The new frontend should be a thin presentation layer over existing data contracts, not a second architecture built beside the domain model.

## Lean Frontend Principles

These principles matter more than conventional frontend purity:

### 1. Prefer fewer abstractions

Do not add shared hooks, utility layers, or generic component systems unless the reuse is real and immediate.

### 2. Prefer feature-local ownership

If logic only serves one screen or one feature area, keep it there.

### 3. Prefer obvious data flow

Use explicit fetch, mutate, and refetch paths rather than hidden refresh buses or clever synchronization.

### 4. Prefer small primitives over broad systems

Create a small set of UI building blocks and stop there.

### 5. Prefer deleting scope over organizing excess scope

If a page or pattern is low-value, simplify or merge it instead of preserving it through better structure.

## Target Frontend Shape

Recommended top-level structure:

```text
src/
  app/
    AppShell.tsx
    router.tsx
    theme.ts
  ui/
    Page.tsx
    Section.tsx
    Button.tsx
    StatCard.tsx
    DataTable.tsx
    EmptyState.tsx
    LoadingState.tsx
    Modal.tsx
    TeamMark.tsx
  features/
    home/
    dashboard/
    team/
    schedule/
    rankings/
    stats/
    playoff/
    game/
    settings/
  domain/
  db/
```

This structure is intentionally small:

- `app/` owns shell and routing only.
- `ui/` contains a minimal primitive layer.
- `features/` contains almost all page-facing code.

## UI Primitive Budget

The rewrite should start with a strict primitive budget. A good baseline is:

- `AppShell`
- `Page`
- `Section`
- `Button`
- `StatCard`
- `DataTable`
- `Modal`
- `TeamMark`
- `EmptyState`
- `LoadingState`

Anything beyond this should need clear repeated use across multiple features.

## Design Direction

The new frontend should feel more editorial and intentional, not like default MUI screens with local overrides.

Design requirements:

- consistent typography hierarchy
- consistent spacing rhythm
- clear page header patterns
- consistent card and table styling
- stronger navigation and information hierarchy
- mobile-safe layouts without relying on huge fixed-width tables everywhere
- desktop-first workspace layouts that usually fit within one viewport, with overflow handled inside panels instead of through long page scroll

Implementation note:

- MUI can remain if it accelerates delivery, but it should be used with discipline through a small shared theme and wrapper primitives.
- If MUI actively fights the desired visual direction, replace more of it with plain CSS and simple custom components.

This should be decided early during shell prototyping, not halfway through the port.

## What To Keep vs. What To Change

### Keep

- league creation and simulation flows
- loader-driven page data contracts, where they remain readable and useful
- IndexedDB persistence model
- existing domain types where they reduce duplication

### Change

- flat route-to-page architecture
- navbar and app shell structure
- page-level visual patterns
- heavy page-local `sx` sprawl
- route-state-based workflow bootstrapping where a simpler explicit action flow is available
- full-page reload and global event refresh habits where direct refetch or local state updates are clearer

## Feature Strategy

Do not port the current app page-by-page without filtering.

Instead, group the app into a smaller set of screen families:

### 1. Launch and league setup

- Home
- New league flow
- Continue existing league flow

### 2. Core in-season hub

- Dashboard
- Week schedule
- Team schedule
- Rankings

### 3. Team and roster surfaces

- Team roster
- Team history
- Player page
- team-level overlays or drill-ins

### 4. Game surfaces

- Game preview
- Game result
- Live sim shell

### 5. Stats and postseason

- Team stats
- Individual stats
- Awards
- Playoff
- Season summary

### 6. Offseason workflow

- Non-con scheduling
- Realignment
- Roster progression
- Recruiting summary
- Roster cuts
- Settings

This grouping is useful because each family can share layout patterns and reduce one-off UI decisions.

## Desktop Workspace Rule

Desktop screens should generally behave like contained workspaces rather than long scrolling documents.

Default rule:

- fit the primary page layout inside the viewport on desktop
- avoid page-level scrolling where practical
- allow scrolling inside panels, tables, lists, and detail regions

Exceptions:

- mobile layouts can scroll normally
- unusually long detail views can opt out when forcing a viewport fit would clearly hurt usability

Implication:

- the shell and page layouts should be designed around viewport-aware grids and internal overflow regions, especially for hub and data-heavy screens

## Migration Plan

### Phase 0: Planning and guardrails

- write and review the rebuild plan
- agree on the frontend boundary
- decide whether MUI stays as a base dependency or becomes more limited
- define the initial primitive budget

### Phase 1: Shell and visual language

Build the minimum new app foundation:

- router structure
- app shell
- nav model
- theme
- typography
- spacing
- base page and section primitives
- table/card/button/modal patterns

This phase should produce one or two prototype pages that prove the direction before broad migration.

### Phase 2: Highest-leverage screens

Rebuild the screens that define most of the app's feel:

- `Home`
- `Dashboard`
- one team-centered page
- `Rankings`
- one game page

These screens establish the language for almost everything else.

### Phase 3: Core feature families

Port grouped features in order of user value:

1. launch/setup
2. in-season hub
3. team and roster surfaces
4. game surfaces
5. stats and postseason
6. offseason workflow

The goal is to keep each pass cohesive instead of jumping randomly between pages.

### Phase 4: Simplification pass

After the main port:

- merge redundant patterns
- delete unused abstractions
- remove legacy components
- tighten route structure
- cut low-value pages or merge them if they do not justify dedicated UI

## Implementation Rules

These rules should keep the rewrite lean:

- Avoid introducing global state libraries unless a concrete problem appears.
- Avoid building custom hooks unless the logic is reused by multiple features.
- Avoid premature generic component APIs.
- Prefer colocating small subcomponents with their feature.
- Prefer explicit props over shared hidden context where practical.
- Prefer direct route and action flows over implicit navigation contracts.

## Risk Areas

### 1. Loader side effects on read

Some current loaders transition state or bootstrap season data during page load. The new frontend should not assume all reads are pure.

Implication:

- early rebuild work should preserve current loader entry points until a separate cleanup is justified

### 2. Live sim integration

The live sim flow has more custom state and synchronization behavior than ordinary pages.

Implication:

- rebuild its shell later than the basic game detail views
- do not let live sim complexity shape the whole app structure

### 3. Overbuilding the new UI system

The biggest rewrite risk is replacing current sprawl with a cleaner but larger abstraction stack.

Implication:

- keep a strict cap on primitive count
- require repeated use before extracting new shared layers

## Suggested Documentation and Decision Sequence

Before implementation begins:

1. finalize this rebuild plan
2. pick the shell/design direction
3. confirm keep/remove decisions for MUI
4. define the first migration slice

Useful follow-up docs once implementation starts:

- a short frontend conventions doc
- a migration checklist by feature family
- a route inventory mapping old screens to new screens

## Success Criteria

The rebuild is successful if:

- the app looks materially more cohesive
- the main user flows feel simpler and easier to navigate
- the frontend folder structure is smaller and easier to reason about
- most screens are understandable without tracing multiple shared abstractions
- new UI changes can usually be made by editing a feature area directly
- the rewrite does not destabilize the simulation or persistence model

## Immediate Next Step

Before coding the new frontend, the next practical step should be to write a short implementation-facing conventions doc that locks in:

- whether MUI stays
- the initial app shell structure
- the primitive budget
- the first screens to rebuild
