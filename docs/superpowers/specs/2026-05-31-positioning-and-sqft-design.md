# Positioning Controls + Live Sq Ft — Design Spec

**Date:** 2026-05-31
**Status:** Approved
**Scope:** `controls.js`, `main.js` — no new files, no schema changes

---

## Goal

Make the 3D compound viewer a real layout tool by adding two capabilities:

1. **Live sq ft readout** — always-visible footprint areas and running total, updating as sliders move
2. **Position controls** — East/West and North/South sliders to move outbuildings around the site

---

## Architecture

No new files. Both changes stay within the existing two-file boundary:

- `controls.js` — all panel UI (sq ft bar, tabs, position sliders)
- `main.js` — scene logic (cascade rebuilds)

`config.js` and `buildings.js` are untouched. Position already lives in `CONFIG[key].position.x / .z`, and `createGableBuilding` already reads `cfg.position` to place groups.

---

## Feature 1: Sq Ft Summary Bar

**Placement:** Pinned below the panel header, above the section list. Always visible regardless of which sections are expanded or which tab is active.

**Content:** One row per building (Main House, Guest House, Gym, Garage) showing `width × depth` footprint, plus a total row. Breezeway and patio are excluded — they are connective tissue, not program sq ft.

**Calculation:** `Math.round(cfg.width * cfg.depth)` per building. Footprint area is the standard number used in architect and builder conversations at this stage.

**Live updates:** `buildPanel` returns `{ setMode, updateSqft }`. `initControls` (called by `main.js`) already calls `buildPanel` internally — it passes `updateSqft` up by returning `{ update, updateSqft }` from `initControls`. `main.js` then calls `controls.updateSqft()` at the end of `rebuildBuilding()`, so the bar always reflects current CONFIG.

**Visual:** Gold-tinted background row, monospace values, same dark/gold palette as the rest of the panel.

---

## Feature 2: SIZE / POSITION Tabs

**Placement:** A two-tab row (`SIZE` | `POSITION`) below the sq ft bar, above the building sections.

**Behavior:** Toggling tabs shows/hides two pre-built section groups:

- **SIZE tab** (default active): existing dimension sliders for all four buildings — identical to the current panel behavior.
- **POSITION tab**: East/West (X) and North/South (Z) sliders for Guest House, Gym, and Garage only.

**Main House is fixed** — it is the site anchor. No position sliders. It does not appear in the POSITION tab.

**Breezeway has no position slider** — its position is computed from Garage in `main.js`. It auto-follows when Garage moves via cascade rebuild.

---

## Position Slider Spec

| Building    | X range     | Z range     | Step |
|-------------|-------------|-------------|------|
| Guest House | −120 to 120 | −120 to 120 | 1 ft |
| Gym         | −120 to 120 | −120 to 120 | 1 ft |
| Garage      | −120 to 120 | −120 to 120 | 1 ft |

Range rationale: ground plane is 300ft diameter; ±120ft keeps buildings on the visible surface and within a realistic 2–3 acre lot footprint.

Slider labels: **East/West** (maps to `position.x`) and **North/South** (maps to `position.z`). Values displayed in feet with sign (e.g. `−85`, `55`).

On `input` event: write to `CONFIG[key].position.x` or `.z`, call `onRebuild(key)`.

---

## Feature 3: Cascade Rebuilds in main.js

Some structures depend on others' positions. The `rebuildBuilding` function in `main.js` needs to cascade:

| Trigger | Also rebuilds |
|---------|---------------|
| `'garage'` | `'breezeway'` |
| `'mainHouse'` | `'patio'`, `'breezeway'` |
| `'__all__'` | everything (existing behavior, no change) |

Implementation: after the primary group is rebuilt, check `name` and call `rebuildBuilding` recursively for dependents. The `'__all__'` branch already handles the full set, so no double-rebuild risk.

---

## What Doesn't Change

- `config.js` — no changes, positions already present
- `buildings.js` — no changes, already reads `cfg.position`
- `scene.html` — no changes
- Camera controls, walk mode, orbit — no changes
- Patio and breezeway sliders — still not exposed (computed structures)

---

## Files Changed

| File | Change |
|------|--------|
| `controls.js` | +sq ft bar HTML/CSS, +tabs, +position sliders in sections array, `buildPanel` returns `updateSqft` |
| `main.js` | +cascade rebuild logic in `rebuildBuilding`, +call `updateSqft()` after each rebuild |
