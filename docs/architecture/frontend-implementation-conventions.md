# Frontend Implementation Conventions

## Scope

Locks in the initial implementation decisions for the frontend rebuild described in `frontend-rebuild-plan.md`.

This document exists to prevent the rewrite from drifting into a larger or heavier architecture than the project needs.

## Product Direction

CFB Sim should feel like:

- a lightweight sports sim
- somewhat interactive
- fast to understand
- usable on both desktop and mobile

It should not feel like:

- an enterprise dashboard
- a design-system showcase
- a dense admin tool
- a heavily abstracted frontend architecture exercise

## Core Decisions

### 1. UI stack

Decision:

- move away from MUI for the new frontend

Reasoning:

- MUI is faster for generic CRUD-style interfaces, but it pushes this app toward a look and structure that does not fit the target product
- the current code already shows heavy page-local `sx` sprawl
- a lean personal project benefits more from plain React plus simple CSS than from a large component library with its own patterns

Default implementation choice:

- plain React components
- global app stylesheet for tokens and shared layout rules
- feature-local CSS modules for page or component styling

Avoid by default:

- CSS-in-JS
- utility frameworks
- adding another large component library

## 2. Mobile target

Decision:

- mobile should be clearly usable, but not at the cost of large architectural overhead

Practical meaning:

- every primary flow should work on mobile
- layouts should collapse cleanly
- tables should degrade intentionally rather than merely overflow
- touch targets and spacing should be sane

Non-goal:

- pixel-perfect optimization for every narrow edge case

## 3. Scope and feature parity

Decision:

- keep the overall product surface mostly similar
- allow consolidation and cleanup during migration

Practical meaning:

- do not assume a one-to-one port is required
- preserve major user-visible capabilities
- merge or simplify screens when the distinction is weak

## 4. Workflow model

Decision:

- move toward a hub-oriented app shell with fewer disconnected-feeling destinations

Practical meaning:

- major flows should anchor around a small number of high-value hubs
- supporting screens can still exist, but navigation should feel tighter and more intentional
- route count may stay similar, but the information architecture should feel smaller

## 5. Data and domain boundary

Decision:

- keep the sim/domain/persistence architecture largely intact for the rebuild
- improve the UI boundary gradually rather than rewriting the whole runtime

Practical meaning:

- continue to use IndexedDB as source of truth
- continue to use existing loader contracts where practical
- gradually move from "mutating loaders on read" toward "read loaders plus explicit actions"

This is the only deeper architectural cleanup that should happen during the rewrite if it directly simplifies the UI.

## Frontend Architecture Rules

### 1. Keep the app shell small

The shell should own:

- top-level routing
- global navigation
- global styles and tokens
- shared page framing

The shell should not own:

- feature-specific workflow logic
- domain-specific presentation rules
- large registries of generic components

### 2. Keep reusable UI primitives few

Initial allowed primitives:

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

Rule:

- new shared primitives must justify themselves through repeated use

### 3. Prefer feature-local code

Use feature folders for most UI ownership.

Good:

- `features/dashboard/DashboardPage.tsx`
- `features/dashboard/DashboardPage.module.css`
- `features/dashboard/GameCard.tsx`

Avoid:

- pulling small one-off render helpers into a broad shared component library

### 4. Prefer simple styling

Use:

- CSS custom properties for colors, spacing, radius, shadows, and typography
- one shared global stylesheet for base rules
- CSS modules for local feature styling

Avoid:

- inline style sprawl
- styling systems that require large wrapper APIs
- dynamic styling abstractions unless they solve a real problem

### 5. Prefer explicit state flow

Use:

- page-owned state
- explicit mutation handlers
- explicit reload or refresh after domain writes

Reduce over time:

- route-state bootstrapping
- hard page reloads
- global refresh event dependence

## Recommended Initial File Structure

```text
src/
  app/
    App.tsx
    AppShell.tsx
    router.tsx
    styles.css
  ui/
    Page.tsx
    Section.tsx
    Button.tsx
    StatCard.tsx
    DataTable.tsx
    Modal.tsx
    EmptyState.tsx
    LoadingState.tsx
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

## Visual Conventions

The visual direction should be:

- lighter
- sharper
- more editorial than corporate
- sports-oriented without becoming gimmicky

Baseline guidance:

- strong but restrained typography
- compact spacing with clear hierarchy
- simple card surfaces
- intentional use of team color and ranking/status accents
- fewer giant boxed sections
- fewer default table-heavy screens

## Page Strategy

The first screens rebuilt should establish the whole visual language:

1. `Home`
2. `Dashboard`
3. one team-centric page
4. `Rankings`
5. one game page

These should define:

- nav structure
- page headers
- card patterns
- table patterns
- responsive collapse behavior
- status chips, score displays, and team marks

## Table Strategy

Because the app contains a lot of structured sports data, tables are still valid, but they should not dominate by default.

Rules:

- use tables when comparison is the primary goal
- convert some wide desktop tables into stacked cards or compact list rows on mobile
- prefer reducing columns on small screens to forcing every table to remain 1200px wide

## Migration Rules

During migration:

- keep old and new frontend code paths separate enough to avoid confusion
- rebuild by feature family, not by random page order
- delete old code once a feature family is fully replaced
- do not port awkward patterns just for parity

## Success Criteria

The new frontend is on track if:

- the codebase gets smaller, not larger
- most UI files are understandable quickly
- mobile usage is acceptable without special-case sprawl
- the app feels like one product instead of a collection of pages
- new visual work no longer requires page-specific styling inventions every time

## Immediate Build Direction

Implementation should begin with:

1. removing MUI from the new shell path
2. creating the new app shell and global styles
3. defining the primitive layer
4. rebuilding `Home` and `Dashboard` as the visual reference point
