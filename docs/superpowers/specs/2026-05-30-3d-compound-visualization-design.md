# Design: Rusch-Lockhart Manor — 3D Compound Visualization

**Date:** 2026-05-30  
**Status:** Approved  
**Repo:** https://github.com/edwardrusch3/rusch-lockhart-manor

---

## Summary

Add a flyable, editable 3D visualization of the Rusch-Lockhart Manor compound to the existing planning site. Implemented as a separate `scene.html` page (decoupled from the main site), linked via a "3D View →" nav entry in `index.html`. Built with Three.js via CDN — no build tooling, matches the existing single-file stack.

Core design principle: **built for iteration**. Dimensions live in one config file. A live panel lets you drag sliders to reshape buildings in real time. Phase 1 ships block massing so layout decisions can start immediately; architectural detail layers in via explicit passes.

---

## Decisions Made

| Question | Decision | Rationale |
|---|---|---|
| Camera model | Orbit + first-person, switchable | Orbit to compare layout, walk to feel scale |
| Editing model | Config file + live slider panel | Both deliberate edits and exploratory tweaking |
| Detail level | Progressive passes (blocks first) | Unblocked from layout decisions immediately |
| Page location | Separate `scene.html` | Decoupling makes each page easier to evolve |
| Architecture | 5 modular files | Clean separation; each file has one job |
| Main house roof | Clerestory / monitor | Raised center band with high windows; distinctive contemporary silhouette |

---

## File Structure

```
rusch-lockhart-manor/
├── index.html          ← existing site (add "3D View →" link in nav)
├── scene.html          ← entry point, loads Three.js CDN + ES modules
├── config.js           ← single source of truth for all dimensions
├── buildings.js        ← pure functions: config → Three.js meshes
├── controls.js         ← live panel (sliders) + camera switcher
└── main.js             ← wires everything, runs render loop
```

**The isolation rule:** `buildings.js` has no knowledge of the panel. `controls.js` has no knowledge of geometry internals. `config.js` has zero imports. Changes flow one way: panel → config values in memory → `rebuildBuilding(name)` in `main.js` → `buildings.js` regenerates mesh.

---

## config.js

All dimensions in feet. One object per structure. Changing any value and calling `rebuildBuilding()` regenerates geometry without a page refresh.

```js
const CONFIG = {
  site: { groundSize: 300, groundColor: 0x1a1a1a, gridVisible: true },

  mainHouse: {
    width: 70, depth: 60,
    wingWallHeight: 10, centerWallHeight: 14,
    clerestoryHeight: 4,    // vertical band between wing eave and center roof
    roofPitch: 2,           // rise per 12ft run (shallow shed pitch)
    roofOverhang: 2,
    color: 0xc9a962,
    position: { x: 0, z: 0 },
  },

  patio: { width: 20, depth: 60, thickness: 0.5, color: 0x2a2a2a },

  guestHouse:  { width: 28, depth: 29, wallHeight: 9,  roofRise: 3, color: 0xf472b6, position: { x: -85, z: 55 } },
  gym:         { width: 20, depth: 30, wallHeight: 9,  roofRise: 3, color: 0xa78bfa, position: { x: 80,  z: 55 } },
  garage:      { width: 36, depth: 25, wallHeight: 10, roofRise: 3, color: 0x93c5fd, position: { x: -90, z: -15 } },
  // breezeway position is computed in main.js: midpoint between garage east face and mainHouse west face
  breezeway:   { width: 8,  depth: 30, wallHeight: 9,  roofRise: 0, color: 0x93c5fd },

  camera: {
    orbitTarget: { x: 0, y: 0, z: 0 },
    orbitStart:  { x: 0, y: 80, z: 150 },
    walkHeight: 5.5, walkSpeed: 0.4, fov: 60,
  },

  lighting: {
    sunColor: 0xfff5e0, sunIntensity: 1.2,
    sunPosition: { x: 100, y: 150, z: 80 },
    ambientIntensity: 0.4, shadowsEnabled: true,
  },
};
```

---

## buildings.js — Geometry Generators

Pure functions. No scene mutations. Each returns a named `THREE.Group`.

### `createMainHouse(cfg)`

Clerestory / monitor roof geometry:

1. **Left wing** — `BoxGeometry(wingWidth, wingWallHeight, depth)`, shed roof angled outward
2. **Right wing** — mirrored
3. **Center raised box** — `BoxGeometry(centerWidth, centerWallHeight, depth)` sitting atop a base at wing eave height
4. **Clerestory window band** — `BoxGeometry` with `MeshBasicMaterial({ color: 0x1a2a3a })` on center north/south faces; slight emissive glow
5. **Center roof** — shallow shed or flat cap geometry

### `createGableBuilding(cfg)`

Reused for guest house, gym, garage, breezeway:
- Walls: `BoxGeometry(width, wallHeight, depth)`
- Gable roof: two angled `BoxGeometry` slabs forming a ridge

### `createGround(cfg)`, `createPatio(cfg)`

Ground plane with optional `GridHelper`. Patio as two `PlaneGeometry` slabs (east arm + south arm of L-wrap).

---

## controls.js — Panel & Camera

### Live Controls Panel

Floating `div` overlay, top-right, collapsible. Vanilla HTML/CSS, dark/gold palette.

Per building (expandable section): `width`, `depth`, `wallHeight` (or `wingWallHeight`/`centerWallHeight` for main house), `roofRise` sliders.  
Global: `gridVisible` toggle, `shadowsEnabled` toggle.

On slider input:
```js
CONFIG[buildingName][property] = parseFloat(slider.value)
rebuildBuilding(buildingName)   // callback from main.js
```

### Camera Switcher

| Mode | Controls | Activation |
|---|---|---|
| Orbit (default) | `OrbitControls` — drag/scroll/pan | Default on load |
| Walkthrough | `PointerLockControls` — WASD + mouse | Press `F` |
| Return to orbit | — | Press `Escape` |

Walk mode settings: eye height 5.5ft, collision against building bounding boxes, WASD velocity 0.4 ft/frame.

HUD: bottom-left mode badge (`ORBIT` / `WALK`). Walk mode adds center crosshair + `[ESC] exit walk` hint.

---

## main.js — Scene Setup

1. Create `WebGLRenderer`, enable shadows, attach to `#canvas`
2. Create `PerspectiveCamera` (FOV 60, aspect from window)
3. Create `Scene`, set background `0x0a0a0a`
4. Add sun `DirectionalLight` + `AmbientLight` from config
5. Call all `buildings.js` generators, add results to scene
6. Init `controls.js` (panel + camera), pass `rebuildBuilding` callback
7. `rebuildBuilding(name)`: dispose old group → regenerate → re-add
8. `window.addEventListener('resize', ...)` — update renderer + camera aspect
9. `renderer.setAnimationLoop(render)` — 60fps loop

---

## scene.html

Full-viewport standalone page. Three.js r158 via CDN importmap. Loads all five modules as ES modules. Dark background matching site palette. Title: "Rusch-Lockhart Manor — 3D View".

`index.html` change: add `<a href="scene.html">3D View →</a>` to nav.

---

## Phase Plan

| Phase | Deliverable | Unlocks |
|---|---|---|
| **1 (this spec)** | Block massing, clerestory main house, orbit + walk, live panel | Layout decisions |
| **2** | Windows, door openings, roof overhangs, patio detail | Scale / light / privacy decisions |
| **3** | Materials (stone, wood, glass), landscape (trees, driveway), shadows baked | Presentation quality |

---

## Out of Scope (Phase 1)

- Interior rooms / floor plan overlay
- Textures and materials beyond flat colors
- Animations (sun path, time of day)
- Mobile / touch controls
- Export / screenshot tooling
