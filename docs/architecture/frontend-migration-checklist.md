# Frontend Migration Checklist

## Scope

Execution checklist for the frontend rebuild.

This document translates the rebuild plan and implementation conventions into concrete phases, tasks, and completion criteria so implementation can proceed without inventing process midstream.

## Working Rules

- keep the new frontend lean
- do not introduce new infrastructure without immediate need
- preserve sim/domain correctness over UI cleverness
- migrate by feature family
- delete replaced code promptly once a migration slice is complete

## Phase 0: Pre-Implementation Baseline

### Tasks

- [x] write the rebuild plan
- [x] write the implementation conventions
- [x] snapshot current route and page inventory into a migration map
- [x] decide whether the new frontend will coexist beside the old UI temporarily or replace files in place
- [x] define a simple rule for naming new feature folders and files

### Exit Criteria

- planning docs exist and are linked
- migration approach is explicit enough to start shell work without reorganizing again

## Phase 1: New App Shell

### Tasks

- [x] create `src/app/`
- [x] create `src/ui/`
- [x] create `src/features/`
- [x] create global stylesheet and CSS variable tokens
- [x] create `AppShell`
- [x] create router structure for the new shell
- [x] define top-level navigation model
- [ ] create shared page framing primitives:
- [x] create shared page framing primitives:
  - [x] `Page`
  - [x] `Section`
  - [x] `Button`
  - [x] `Modal`
  - [x] `LoadingState`
  - [x] `EmptyState`
- [ ] create first-pass data display primitives:
- [x] create first-pass data display primitives:
  - [x] `StatCard`
  - [x] `DataTable`
  - [x] `TeamMark`
- [x] ensure the shell works on desktop and mobile widths

### Exit Criteria

- the app can render through the new shell
- global visual language exists
- the primitive layer is small and usable
- the shell is clean enough that feature migration can start without redesigning the foundation

## Phase 2: First Visual Reference Screens

These screens establish the product language for the rest of the rewrite.

### Tasks

- [x] rebuild `Home`
- [x] rebuild `Dashboard`
- [ ] rebuild one team-centric screen
- [ ] rebuild `Rankings`
- [ ] rebuild one game screen

### Evaluation Questions

- does the app now feel like a lightweight sports sim rather than a generic component-library app
- do desktop and mobile both work without obvious layout failure
- do desktop hub screens behave like contained workspaces rather than long scrolling pages
- are the new screens simpler to understand than the old ones
- are the primitives still small, or is the rewrite already drifting into abstraction growth

### Exit Criteria

- the visual direction is proven
- core navigation feels coherent
- responsive behavior is established
- the remaining screen work is mostly extension rather than invention

## Phase 3: Core Feature Families

Migrate in this order unless implementation reality forces a change.

### 3A. Launch and League Setup

- [x] finalize new `Home` flow
- [ ] rebuild new league setup flow
- [ ] rebuild continue/load flow
- [ ] remove old launch UI path once replaced

### 3B. In-Season Hub

- [ ] rebuild `WeekSchedule`
- [ ] rebuild `TeamSchedule`
- [ ] tighten navigation between hub screens
- [ ] remove replaced season-hub UI code

### 3C. Team and Roster

- [ ] rebuild `Roster`
- [ ] rebuild `TeamHistory`
- [ ] rebuild `Player`
- [ ] rebuild any team drill-in overlays needed for parity
- [ ] remove replaced team UI code

### 3D. Game Surfaces

- [ ] rebuild `GamePreview`
- [ ] rebuild `GameResult`
- [ ] rebuild primary `GamePage`
- [ ] assess whether live sim shell can reuse the new game primitives cleanly
- [ ] remove replaced game UI code where safe

### 3E. Stats and Postseason

- [ ] rebuild `TeamStats`
- [ ] rebuild `IndividualStats`
- [ ] rebuild `Awards`
- [ ] rebuild `Playoff`
- [ ] rebuild `SeasonSummary`
- [ ] remove replaced stats/postseason UI code

### 3F. Offseason Workflow

- [ ] rebuild `Noncon`
- [ ] rebuild `Realignment`
- [ ] rebuild `RosterProgression`
- [ ] rebuild `RecruitingSummary`
- [ ] rebuild `RosterCuts`
- [ ] rebuild `Settings`
- [ ] remove replaced offseason UI code

### Exit Criteria

- all major user-visible flows are running through the new shell
- old UI code is reduced rather than duplicated indefinitely
- feature organization remains readable

## Phase 4: UI Boundary Cleanup

This phase is selective, not mandatory everywhere.

### Tasks

- [ ] identify pages still depending on mutating loaders in awkward ways
- [ ] separate read concerns from mutation concerns where this clearly simplifies UI code
- [ ] replace route-state bootstrapping where direct explicit actions are cleaner
- [ ] replace hard reload behavior with targeted refetch or state updates where feasible
- [ ] reduce dependence on global refresh events where practical

### Exit Criteria

- the new UI is less coupled to incidental loader behavior
- major interactions are explicit and predictable
- boundary cleanup improved simplicity rather than adding ceremony

## Phase 5: Simplification and Deletion Pass

### Tasks

- [ ] remove dead components
- [ ] remove dead page files
- [ ] remove no-longer-needed shared helpers from the old UI layer
- [ ] remove MUI from migrated frontend paths
- [ ] decide whether remaining MUI usage should be eliminated completely
- [ ] consolidate screens if any are clearly too thin to justify a dedicated route
- [ ] tighten route inventory and naming consistency

### Exit Criteria

- the codebase is smaller and cleaner than before the rewrite
- legacy UI layers are mostly gone
- dependency and styling surface area are reduced

## Route Inventory Template

Use this section to map old routes to new destinations during migration.

| Current Route | Current Screen | New Screen / Outcome | Notes |
|---|---|---|---|
| `/` | Home | pending | |
| `/dashboard` | Dashboard | pending | |
| `/:teamName/schedule` | TeamSchedule | pending | |
| `/:teamName/schedule/:year` | TeamSchedule | pending | |
| `/:teamName/roster` | Roster | pending | |
| `/:teamName/history` | TeamHistory | pending | |
| `/stats/ratings` | RatingsStats | pending | |
| `/rankings` | Rankings | pending | |
| `/standings/:conference_name` | Standings | pending | |
| `/schedule/:week` | WeekSchedule | pending | |
| `/settings` | Settings | pending | |
| `/awards` | Awards | pending | |
| `/summary` | SeasonSummary | pending | |
| `/realignment` | Realignment | pending | |
| `/roster_progression` | RosterProgression | pending | |
| `/recruiting_summary` | RecruitingSummary | pending | |
| `/roster_cuts` | RosterCuts | pending | |
| `/playoff` | Playoff | pending | |
| `/game/:id` | GamePage | pending | |
| `/players/:playerId` | Player | pending | |
| `/stats/team` | TeamStats | pending | |
| `/stats/individual` | IndividualStats | pending | |
| `/noncon` | NonCon | pending | |

## Primitive Budget Check

Use this list to prevent slow abstraction creep.

Initial shared primitives allowed:

- `AppShell`
- `Page`
- `Section`
- `Button`
- `StatCard`
- `DataTable`
- `Modal`
- `EmptyState`
- `LoadingState`
- `TeamMark`

Before adding a new shared primitive, ask:

1. Is this already repeated in multiple feature families
2. Would feature-local code be clearer
3. Does this reduce code, or only relocate it

If those answers are weak, keep the code local.

## Done Criteria

The frontend rebuild is done when:

- the main app runs through the new shell
- the main feature families are migrated
- the codebase is leaner than before
- mobile usage is acceptable
- visual consistency is materially improved
- old UI code and dependencies are mostly removed
