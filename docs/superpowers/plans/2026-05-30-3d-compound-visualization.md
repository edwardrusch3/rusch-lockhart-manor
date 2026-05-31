# 3D Compound Visualization — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a flyable, editable Three.js 3D visualization of the Rusch-Lockhart Manor compound as a standalone `scene.html` page with live dimension controls.

**Architecture:** Five ES module files — `config.js` (data only), `buildings.js` (geometry generators), `controls.js` (panel + camera), `main.js` (scene wiring), `scene.html` (entry point). Three.js loaded via CDN importmap; no build step. Live panel updates config values in memory and calls `rebuildBuilding()` to regenerate geometry without page reload.

**Tech Stack:** Three.js r169 (CDN importmap), vanilla ES modules, HTML/CSS overlay panel, `OrbitControls` + `PointerLockControls` from Three.js addons.

---

## Pre-flight: open the site locally

All verification steps require a local HTTP server — `file://` URLs block ES module imports. Before Task 1, start one:

```bash
cd /Users/edrico/Documents/Claude/rusch-lockhart-manor
python3 -m http.server 8080
# then open http://localhost:8080/scene.html
```

Keep this running throughout all tasks.

---

## Task 1: config.js — building dimensions and site layout

**Goal:** Create the single source of truth for all compound dimensions, colors, camera, and lighting.

**Files:**
- Create: `config.js`

**Acceptance Criteria:**
- [ ] All six structures defined (mainHouse, guestHouse, gym, garage, breezeway, patio)
- [ ] Camera and lighting blocks present
- [ ] No imports — pure `const` export
- [ ] Every numeric value has a `// ft` or `// unit` comment

**Verify:** Open browser console at `http://localhost:8080/scene.html` (after Task 5), run `CONFIG.mainHouse.width` → `70`

**Steps:**

- [ ] **Step 1: Create config.js**

```js
// config.js — single source of truth for all compound dimensions.
// 1 Three.js unit = 1 foot.
// Change any value here and call rebuildBuilding(name) to see it live.

const CONFIG = {

  site: {
    groundSize: 300,       // ft — total ground plane diameter
    groundColor: 0x111111,
    gridVisible: true,
  },

  mainHouse: {
    width: 70,             // ft east-west total
    depth: 60,             // ft north-south
    centerWidth: 30,       // ft — raised center section width (wings = (width-centerWidth)/2 each)
    wingWallHeight: 10,    // ft — eave height of shed wings
    centerWallHeight: 14,  // ft — total height of raised center box (wingWallHeight + clerestoryHeight)
    clerestoryHeight: 4,   // ft — vertical glass band above wing eave
    roofPitch: 2,          // ft rise per 12 ft run (shallow shed)
    roofOverhang: 2,       // ft — eave extension past walls
    color: 0xc9a962,       // gold
    position: { x: 0, z: 0 },
  },

  patio: {
    // L-wrap: east arm runs along main house right side; south arm runs along front face
    eastWidth: 20,         // ft — east arm east-west extent
    southDepth: 15,        // ft — south arm north-south extent
    thickness: 0.4,        // ft — slab height
    color: 0x1e1e1e,
  },

  guestHouse: {
    name: 'guestHouse',
    width: 28,             // ft → ~800 sq ft
    depth: 29,             // ft
    wallHeight: 9,         // ft
    roofRise: 3,           // ft — gable peak above wallHeight
    color: 0xf472b6,       // pink
    position: { x: -85, z: 55 },
  },

  gym: {
    name: 'gym',
    width: 20,             // ft → ~600 sq ft
    depth: 30,             // ft
    wallHeight: 9,         // ft
    roofRise: 3,           // ft
    color: 0xa78bfa,       // purple
    position: { x: 80, z: 55 },
  },

  garage: {
    name: 'garage',
    width: 36,             // ft — 3-car
    depth: 25,             // ft → 900 sq ft
    wallHeight: 10,        // ft
    roofRise: 3,           // ft
    color: 0x93c5fd,       // blue
    position: { x: -90, z: -15 },
  },

  // Breezeway position is COMPUTED in main.js:
  //   x = midpoint between garage east face and mainHouse west face
  //   z = garage.position.z
  breezeway: {
    name: 'breezeway',
    width: 8,              // ft — corridor north-south width
    // depth (east-west) is computed from garage/mainHouse gap
    wallHeight: 9,         // ft
    roofRise: 0,           // ft — flat roof
    color: 0x93c5fd,       // blue (matches garage)
  },

  camera: {
    orbitTarget: { x: 0, y: 0, z: 0 },
    orbitStart:  { x: 0, y: 80, z: 150 },  // elevated angle
    minDistance: 20,       // ft — prevent clipping into buildings
    maxDistance: 400,      // ft
    walkHeight: 5.5,       // ft — eye level in walk mode
    walkSpeed: 0.4,        // ft/frame
    fov: 60,               // degrees
  },

  lighting: {
    sunColor: 0xfff5e0,
    sunIntensity: 1.2,
    sunPosition: { x: 100, y: 150, z: 80 },
    ambientColor: 0xffffff,
    ambientIntensity: 0.4,
    shadowsEnabled: true,
  },

};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/edrico/Documents/Claude/rusch-lockhart-manor
git add config.js
git -c core.hooksPath=/dev/null commit -m "feat: add config.js — compound dimensions and site layout"
```

---

## Task 2: buildings.js — geometry generators

**Goal:** Pure functions that take config objects and return `THREE.Group` meshes for every structure.

**Files:**
- Create: `buildings.js`

**Acceptance Criteria:**
- [ ] `createMainHouse(cfg)` returns a Group with clerestory geometry (wings + raised center + glass band + shed roofs + cap)
- [ ] `createGableBuilding(cfg)` returns a Group with walls + two-slab gable roof; reused for guestHouse, gym, garage, breezeway
- [ ] `createGround(cfg)` returns ground plane + optional GridHelper
- [ ] `createPatio(cfg, mainHouseCfg)` returns two slab meshes (east arm + south arm)
- [ ] Every function is a pure function — no `scene.add()` calls inside
- [ ] Every mesh has `castShadow` and/or `receiveShadow` set appropriately

**Verify:** Open http://localhost:8080/scene.html after Task 5 — all five buildings visible with correct silhouettes; no console errors.

**Steps:**

- [ ] **Step 1: Create buildings.js with imports and material helper**

```js
// buildings.js — geometry generators.
// All functions are pure: they take a config object, return a THREE.Group.
// No scene.add() calls here. The caller (main.js) places groups in the scene.

import * as THREE from 'three';

/** Shared Lambert material — cheap, takes lighting, no specular. */
function mat(color) {
  return new THREE.MeshLambertMaterial({ color });
}
```

- [ ] **Step 2: Add createGableBuilding — used for outbuildings and breezeway**

Append to `buildings.js`:

```js
/**
 * createGableBuilding(cfg)
 * Walls as a single BoxGeometry; gable roof as two rotated slabs.
 * cfg must have: name, width, depth, wallHeight, roofRise, color.
 * cfg may have: position { x, z } — if absent, group stays at origin.
 */
export function createGableBuilding(cfg) {
  const group = new THREE.Group();
  group.name = cfg.name ?? 'building';

  const m = mat(cfg.color);

  // ── Walls ────────────────────────────────────────────────────────────────
  const wallGeo = new THREE.BoxGeometry(cfg.width, cfg.wallHeight, cfg.depth);
  const walls   = new THREE.Mesh(wallGeo, m);
  walls.position.y    = cfg.wallHeight / 2;
  walls.castShadow    = true;
  walls.receiveShadow = true;
  group.add(walls);

  // ── Gable roof — two angled slabs ────────────────────────────────────────
  if (cfg.roofRise > 0) {
    const halfW    = cfg.width / 2;
    const angle    = Math.atan2(cfg.roofRise, halfW);      // radians
    const slabW    = Math.hypot(halfW, cfg.roofRise) + 0.2; // hypotenuse + overhang
    const slabGeo  = new THREE.BoxGeometry(slabW, 0.4, cfg.depth + 0.4);
    const peakY    = cfg.wallHeight + cfg.roofRise / 2;

    const leftSlab = new THREE.Mesh(slabGeo, m);
    leftSlab.rotation.z = angle;
    leftSlab.position.set(-halfW / 2, peakY, 0);
    leftSlab.castShadow = true;
    group.add(leftSlab);

    const rightSlab = new THREE.Mesh(slabGeo, m);
    rightSlab.rotation.z = -angle;
    rightSlab.position.set(halfW / 2, peakY, 0);
    rightSlab.castShadow = true;
    group.add(rightSlab);
  } else {
    // Flat roof cap (for breezeway roofRise === 0)
    const capGeo = new THREE.BoxGeometry(cfg.width + 0.2, 0.3, cfg.depth + 0.2);
    const cap    = new THREE.Mesh(capGeo, m);
    cap.position.y  = cfg.wallHeight + 0.15;
    cap.castShadow  = true;
    group.add(cap);
  }

  if (cfg.position) {
    group.position.set(cfg.position.x, 0, cfg.position.z);
  }
  return group;
}
```

- [ ] **Step 3: Add createMainHouse — clerestory / monitor roof**

Append to `buildings.js`:

```js
/**
 * createMainHouse(cfg)
 * Clerestory / monitor roof:
 *   left wing  | raised center box | right wing
 *   Wing shed roofs slope outward. Center gets a flat cap.
 *   Clerestory glass band on north/south faces of center.
 */
export function createMainHouse(cfg) {
  const group = new THREE.Group();
  group.name  = 'mainHouse';

  const {
    width, depth, centerWidth,
    wingWallHeight, centerWallHeight,
    clerestoryHeight, roofPitch, roofOverhang, color,
  } = cfg;

  const wingWidth = (width - centerWidth) / 2;  // ~20 ft each
  const m         = mat(color);

  // ── Wing bodies ──────────────────────────────────────────────────────────
  const wingGeo  = new THREE.BoxGeometry(wingWidth, wingWallHeight, depth);
  const leftWing = new THREE.Mesh(wingGeo, m);
  leftWing.position.set(-(centerWidth / 2 + wingWidth / 2), wingWallHeight / 2, 0);
  leftWing.castShadow = leftWing.receiveShadow = true;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, m);
  rightWing.position.set(centerWidth / 2 + wingWidth / 2, wingWallHeight / 2, 0);
  rightWing.castShadow = rightWing.receiveShadow = true;
  group.add(rightWing);

  // ── Center raised box ────────────────────────────────────────────────────
  const centerGeo  = new THREE.BoxGeometry(centerWidth, centerWallHeight, depth);
  const centerMesh = new THREE.Mesh(centerGeo, m);
  centerMesh.position.set(0, centerWallHeight / 2, 0);
  centerMesh.castShadow = centerMesh.receiveShadow = true;
  group.add(centerMesh);

  // ── Clerestory glass band ────────────────────────────────────────────────
  // Thin panel on north and south faces of center, spanning the step height.
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x1a2a3a,
    emissive: 0x081018,
    transparent: true,
    opacity: 0.80,
  });
  const bandH   = clerestoryHeight;
  const bandGeo = new THREE.BoxGeometry(centerWidth - 0.4, bandH, 0.3);
  const bandY   = wingWallHeight + bandH / 2;

  const bandFront = new THREE.Mesh(bandGeo, glassMat);
  bandFront.position.set(0, bandY, depth / 2 + 0.1);
  group.add(bandFront);

  const bandBack = new THREE.Mesh(bandGeo, glassMat);
  bandBack.position.set(0, bandY, -(depth / 2 + 0.1));
  group.add(bandBack);

  // ── Wing shed roofs ──────────────────────────────────────────────────────
  // Slope outward: high side at center connection, low side at outer eave.
  const shedAngle = Math.atan2(roofPitch, 12);          // gentle pitch
  const shedW     = wingWidth + roofOverhang;
  const shedD     = depth + roofOverhang * 2;
  const shedGeo   = new THREE.BoxGeometry(shedW, 0.4, shedD);

  const leftShed = new THREE.Mesh(shedGeo, m);
  leftShed.rotation.z = shedAngle;   // slopes down to the left (outward)
  // Y center: wingWallHeight + half the rise across the slab
  leftShed.position.set(
    -(centerWidth / 2 + wingWidth / 2),
    wingWallHeight + (Math.tan(shedAngle) * wingWidth) / 2,
    0,
  );
  leftShed.castShadow = true;
  group.add(leftShed);

  const rightShed = new THREE.Mesh(shedGeo, m);
  rightShed.rotation.z = -shedAngle; // slopes down to the right
  rightShed.position.set(
    centerWidth / 2 + wingWidth / 2,
    wingWallHeight + (Math.tan(shedAngle) * wingWidth) / 2,
    0,
  );
  rightShed.castShadow = true;
  group.add(rightShed);

  // ── Center roof cap (flat) ───────────────────────────────────────────────
  const capGeo = new THREE.BoxGeometry(centerWidth + 0.4, 0.4, depth + roofOverhang * 2);
  const cap    = new THREE.Mesh(capGeo, m);
  cap.position.set(0, centerWallHeight + 0.2, 0);
  cap.castShadow = true;
  group.add(cap);

  group.position.set(cfg.position.x, 0, cfg.position.z);
  return group;
}
```

- [ ] **Step 4: Add createGround and createPatio**

Append to `buildings.js`:

```js
/**
 * createGround(cfg)
 * Flat ground plane + optional grid overlay.
 * cfg = CONFIG.site
 */
export function createGround(cfg) {
  const group = new THREE.Group();
  group.name  = 'ground';

  const geo    = new THREE.PlaneGeometry(cfg.groundSize, cfg.groundSize);
  const ground = new THREE.Mesh(geo, mat(cfg.groundColor));
  ground.rotation.x    = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  if (cfg.gridVisible) {
    const divs = cfg.groundSize / 10;  // one line per 10 ft
    const grid = new THREE.GridHelper(cfg.groundSize, divs, 0x2a2a2a, 0x222222);
    group.add(grid);
  }

  return group;
}

/**
 * createPatio(patCfg, mainCfg)
 * L-wrap patio: east arm (alongside main house right/east side) +
 *               south arm (in front of main house south face).
 * patCfg = CONFIG.patio
 * mainCfg = CONFIG.mainHouse
 */
export function createPatio(patCfg, mainCfg) {
  const group = new THREE.Group();
  group.name  = 'patio';

  const m = mat(patCfg.color);
  const { position: mPos, width: mW, depth: mD } = mainCfg;

  // East arm: runs north-south along the main house's east face
  const eastGeo = new THREE.BoxGeometry(patCfg.eastWidth, patCfg.thickness, mD);
  const east    = new THREE.Mesh(eastGeo, m);
  east.position.set(
    mPos.x + mW / 2 + patCfg.eastWidth / 2,
    patCfg.thickness / 2,
    mPos.z,
  );
  east.receiveShadow = true;
  group.add(east);

  // South arm: runs east-west along the main house's south face
  // (extends across main house width + east arm width)
  const southTotalW = mW + patCfg.eastWidth;
  const southGeo    = new THREE.BoxGeometry(southTotalW, patCfg.thickness, patCfg.southDepth);
  const south       = new THREE.Mesh(southGeo, m);
  south.position.set(
    mPos.x + patCfg.eastWidth / 2,
    patCfg.thickness / 2,
    mPos.z - mD / 2 - patCfg.southDepth / 2,
  );
  south.receiveShadow = true;
  group.add(south);

  return group;
}
```

- [ ] **Step 5: Commit**

```bash
git add buildings.js
git -c core.hooksPath=/dev/null commit -m "feat: add buildings.js — clerestory main house and gable outbuilding generators"
```

---

## Task 3: controls.js — live panel and camera switcher

**Goal:** Floating HTML slider panel that updates CONFIG values and triggers geometry rebuilds; orbit/walkthrough camera mode switcher with HUD.

**Files:**
- Create: `controls.js`

**Acceptance Criteria:**
- [ ] Panel renders top-right, collapsible, dark/gold palette
- [ ] Per-building sections with width/depth/wallHeight/roofRise sliders (main house uses wingWallHeight + centerWallHeight instead of wallHeight)
- [ ] Dragging any slider updates the corresponding `CONFIG` key and calls `onRebuild(buildingName)`
- [ ] Orbit mode active on load; press `F` → PointerLockControls walkthrough; press `Escape` → returns to orbit
- [ ] Walk mode: WASD movement at `CONFIG.camera.walkSpeed`, eye height `CONFIG.camera.walkHeight`
- [ ] HUD badge bottom-left: `ORBIT` or `WALK`; crosshair + hint visible in walk mode

**Verify:** Open http://localhost:8080/scene.html — drag main house width slider → building updates; press F → cursor locks and WASD moves camera; Escape returns to orbit.

**Steps:**

- [ ] **Step 1: Create controls.js with panel HTML injection**

```js
// controls.js — live controls panel + orbit/walkthrough camera switcher.
// Call initControls(scene, camera, renderer, CONFIG, onRebuild) from main.js.

import * as THREE from 'three';
import { OrbitControls }       from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ── Panel styles ─────────────────────────────────────────────────────────────
const PANEL_CSS = `
  #ctrl-panel {
    position: fixed; top: 1rem; right: 1rem; width: 240px;
    background: rgba(10,10,10,0.92); border: 1px solid #2a2a2a;
    border-radius: 8px; color: #e0e0e0; font-family: 'Instrument Sans', sans-serif;
    font-size: 13px; z-index: 100; user-select: none;
    backdrop-filter: blur(12px);
  }
  #ctrl-panel header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.6rem 0.75rem; border-bottom: 1px solid #2a2a2a;
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    color: #c9a962; cursor: default;
  }
  #ctrl-panel .collapse-btn {
    background: none; border: none; color: #c9a962; cursor: pointer;
    font-size: 16px; line-height: 1; padding: 0;
  }
  #ctrl-panel .building-section { border-bottom: 1px solid #1a1a1a; }
  #ctrl-panel .section-header {
    padding: 0.45rem 0.75rem; cursor: pointer; font-size: 12px;
    display: flex; justify-content: space-between; color: #a0a0a0;
  }
  #ctrl-panel .section-header:hover { color: #e0e0e0; }
  #ctrl-panel .section-body { padding: 0.4rem 0.75rem 0.6rem; display: none; }
  #ctrl-panel .section-body.open { display: block; }
  #ctrl-panel .row {
    display: grid; grid-template-columns: 90px 1fr 36px;
    align-items: center; gap: 0.4rem; margin-bottom: 0.35rem;
  }
  #ctrl-panel .row label { font-size: 11px; color: #888; }
  #ctrl-panel input[type=range] { width: 100%; accent-color: #c9a962; }
  #ctrl-panel .val { font-size: 11px; color: #c9a962; text-align: right; }
  #ctrl-panel .globals { padding: 0.5rem 0.75rem; display: flex; gap: 1rem; }
  #ctrl-panel .globals label { display: flex; align-items: center; gap: 0.3rem;
    font-size: 11px; color: #888; cursor: pointer; }
  #hud-badge {
    position: fixed; bottom: 1.25rem; left: 1.25rem;
    font-family: monospace; font-size: 11px; letter-spacing: 0.1em;
    color: #c9a962; background: rgba(0,0,0,0.6); padding: 4px 8px;
    border-radius: 4px; pointer-events: none; z-index: 100;
  }
  #crosshair {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
    pointer-events: none; display: none; z-index: 100;
  }
  #crosshair::before, #crosshair::after {
    content: ''; position: absolute; background: rgba(255,255,255,0.7);
  }
  #crosshair::before { width: 1px; height: 16px; top: -8px; left: 0; }
  #crosshair::after  { width: 16px; height: 1px; top: 0; left: -8px; }
`;
```

- [ ] **Step 2: Add panel builder function**

Append to `controls.js`:

```js
// ── Panel builder ─────────────────────────────────────────────────────────────

/**
 * buildPanel(CONFIG, onRebuild)
 * Injects the CSS + HTML panel into the document.
 * Returns a function updatePanel() for future use (reserved).
 */
function buildPanel(CONFIG, onRebuild) {
  // Inject CSS
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);

  // Building sections definition
  // Each entry: { key: CONFIG key, label, sliders: [{prop, label, min, max, step}] }
  const sections = [
    {
      key: 'mainHouse', label: 'Main House', sliders: [
        { prop: 'width',            label: 'Width',       min: 40,  max: 100, step: 1 },
        { prop: 'depth',            label: 'Depth',       min: 30,  max: 90,  step: 1 },
        { prop: 'wingWallHeight',   label: 'Wing Height', min: 6,   max: 14,  step: 0.5 },
        { prop: 'centerWallHeight', label: 'Ctr Height',  min: 10,  max: 20,  step: 0.5 },
        { prop: 'centerWidth',      label: 'Ctr Width',   min: 20,  max: 50,  step: 1 },
      ],
    },
    {
      key: 'guestHouse', label: 'Guest House', sliders: [
        { prop: 'width',      label: 'Width',  min: 16, max: 50, step: 1 },
        { prop: 'depth',      label: 'Depth',  min: 16, max: 50, step: 1 },
        { prop: 'wallHeight', label: 'Height', min: 7,  max: 14, step: 0.5 },
        { prop: 'roofRise',   label: 'Roof',   min: 1,  max: 8,  step: 0.5 },
      ],
    },
    {
      key: 'gym', label: 'Gym', sliders: [
        { prop: 'width',      label: 'Width',  min: 14, max: 40, step: 1 },
        { prop: 'depth',      label: 'Depth',  min: 14, max: 40, step: 1 },
        { prop: 'wallHeight', label: 'Height', min: 7,  max: 14, step: 0.5 },
        { prop: 'roofRise',   label: 'Roof',   min: 1,  max: 8,  step: 0.5 },
      ],
    },
    {
      key: 'garage', label: 'Garage', sliders: [
        { prop: 'width',      label: 'Width',  min: 24, max: 60, step: 1 },
        { prop: 'depth',      label: 'Depth',  min: 18, max: 40, step: 1 },
        { prop: 'wallHeight', label: 'Height', min: 7,  max: 14, step: 0.5 },
        { prop: 'roofRise',   label: 'Roof',   min: 1,  max: 8,  step: 0.5 },
      ],
    },
  ];

  // Build HTML
  const panel = document.createElement('div');
  panel.id    = 'ctrl-panel';

  panel.innerHTML = `
    <header>
      Compound Controls
      <button class="collapse-btn" id="ctrl-toggle">−</button>
    </header>
    <div id="ctrl-body">
      ${sections.map(sec => `
        <div class="building-section">
          <div class="section-header" data-key="${sec.key}">
            ${sec.label} <span>▸</span>
          </div>
          <div class="section-body" id="body-${sec.key}">
            ${sec.sliders.map(s => `
              <div class="row">
                <label>${s.label}</label>
                <input type="range"
                  data-key="${sec.key}" data-prop="${s.prop}"
                  min="${s.min}" max="${s.max}" step="${s.step}"
                  value="${CONFIG[sec.key][s.prop]}">
                <span class="val" id="val-${sec.key}-${s.prop}">${CONFIG[sec.key][s.prop]}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <div class="globals">
        <label>
          <input type="checkbox" id="chk-grid" ${CONFIG.site.gridVisible ? 'checked' : ''}> Grid
        </label>
        <label>
          <input type="checkbox" id="chk-shadow" ${CONFIG.lighting.shadowsEnabled ? 'checked' : ''}> Shadows
        </label>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // HUD + crosshair
  const hud = document.createElement('div');
  hud.id = 'hud-badge';
  hud.textContent = 'ORBIT';
  document.body.appendChild(hud);

  const xhair = document.createElement('div');
  xhair.id = 'crosshair';
  document.body.appendChild(xhair);

  // ── Event wiring ───────────────────────────────────────────────────────────

  // Collapse toggle
  document.getElementById('ctrl-toggle').addEventListener('click', () => {
    const body = document.getElementById('ctrl-body');
    const btn  = document.getElementById('ctrl-toggle');
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? '' : 'none';
    btn.textContent    = collapsed ? '−' : '+';
  });

  // Section expand/collapse
  panel.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const key  = header.dataset.key;
      const body = document.getElementById(`body-${key}`);
      const open = body.classList.toggle('open');
      header.querySelector('span').textContent = open ? '▾' : '▸';
    });
  });

  // Slider input
  panel.querySelectorAll('input[type=range]').forEach(slider => {
    slider.addEventListener('input', () => {
      const { key, prop } = slider.dataset;
      const val = parseFloat(slider.value);
      CONFIG[key][prop] = val;
      document.getElementById(`val-${key}-${prop}`).textContent = val;
      onRebuild(key);
    });
  });

  // Grid toggle — rebuilds ground
  document.getElementById('chk-grid').addEventListener('change', e => {
    CONFIG.site.gridVisible = e.target.checked;
    onRebuild('ground');
  });

  // Shadow toggle — triggers renderer shadow refresh via rebuild all
  document.getElementById('chk-shadow').addEventListener('change', e => {
    CONFIG.lighting.shadowsEnabled = e.target.checked;
    onRebuild('__all__');
  });

  return {
    setMode: (mode) => {
      hud.textContent = mode;
      xhair.style.display = mode === 'WALK' ? 'block' : 'none';
    },
  };
}
```

- [ ] **Step 3: Add initControls — camera modes and WASD**

Append to `controls.js`:

```js
// ── Camera + keyboard state ───────────────────────────────────────────────────

const keys = { w: false, a: false, s: false, d: false };

/**
 * initControls(scene, camera, renderer, CONFIG, onRebuild)
 * Sets up orbit controls, pointer-lock walkthrough, and the panel.
 * Returns { update() } — call update() inside the render loop each frame.
 */
export function initControls(scene, camera, renderer, CONFIG, onRebuild) {
  // ── Orbit controls ─────────────────────────────────────────────────────────
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(
    CONFIG.camera.orbitTarget.x,
    CONFIG.camera.orbitTarget.y,
    CONFIG.camera.orbitTarget.z,
  );
  orbit.minDistance = CONFIG.camera.minDistance;
  orbit.maxDistance = CONFIG.camera.maxDistance;
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.07;
  orbit.update();

  // ── Pointer-lock (walkthrough) controls ────────────────────────────────────
  const walk = new PointerLockControls(camera, renderer.domElement);
  scene.add(walk.object); // PointerLockControls wraps camera in a dummy object

  let mode = 'orbit'; // 'orbit' | 'walk'

  // Build panel — receive setMode handle
  const panel = buildPanel(CONFIG, onRebuild);

  // Switch to walk mode on F
  document.addEventListener('keydown', e => {
    if (e.code === 'KeyF' && mode === 'orbit') {
      orbit.enabled = false;
      camera.position.y = CONFIG.camera.walkHeight;
      walk.lock();
    }
    if (['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
      keys[e.code.replace('Key','').toLowerCase()] = true;
    }
  });

  document.addEventListener('keyup', e => {
    if (['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
      keys[e.code.replace('Key','').toLowerCase()] = false;
    }
  });

  walk.addEventListener('lock',   () => { mode = 'walk';  panel.setMode('WALK');  });
  walk.addEventListener('unlock', () => {
    mode = 'orbit';
    orbit.enabled = true;
    orbit.update();
    panel.setMode('ORBIT');
  });

  // ── Per-frame update (call in render loop) ─────────────────────────────────
  const speed  = CONFIG.camera.walkSpeed;
  const _dir   = new THREE.Vector3();

  function update() {
    if (mode === 'orbit') {
      orbit.update();
      return;
    }
    // WASD movement
    _dir.set(0, 0, 0);
    if (keys.w) _dir.z -= 1;
    if (keys.s) _dir.z += 1;
    if (keys.a) _dir.x -= 1;
    if (keys.d) _dir.x += 1;
    if (_dir.lengthSq() > 0) {
      _dir.normalize().multiplyScalar(speed);
      walk.moveRight(_dir.x);
      walk.moveForward(-_dir.z);
    }
    // Lock eye height
    walk.object.position.y = CONFIG.camera.walkHeight;
  }

  return { update };
}
```

- [ ] **Step 4: Commit**

```bash
git add controls.js
git -c core.hooksPath=/dev/null commit -m "feat: add controls.js — live panel, orbit mode, WASD walkthrough"
```

---

## Task 4: main.js — scene setup, lighting, and render loop

**Goal:** Wire all modules together into a running Three.js scene with `rebuildBuilding()` and resize handling.

**Files:**
- Create: `main.js`

**Acceptance Criteria:**
- [ ] Scene, renderer, and camera initialize from CONFIG values
- [ ] All six structures (mainHouse, guestHouse, gym, garage, breezeway, patio) added to scene
- [ ] `rebuildBuilding(name)` disposes old group, regenerates, re-adds to scene
- [ ] `rebuildBuilding('__all__')` rebuilds every structure and toggles shadow map
- [ ] Canvas resizes with window
- [ ] 60fps animation loop runs

**Verify:** Open http://localhost:8080/scene.html (after Task 5) — all buildings visible, shadows cast on ground, slider rebuild works, window resize doesn't break aspect ratio.

**Steps:**

- [ ] **Step 1: Create main.js with scene and renderer setup**

```js
// main.js — wires together config, buildings, and controls into a live scene.

import * as THREE from 'three';
import { CONFIG }           from './config.js';
import {
  createMainHouse,
  createGableBuilding,
  createGround,
  createPatio,
}                           from './buildings.js';
import { initControls }     from './controls.js';

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = CONFIG.lighting.shadowsEnabled;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
document.getElementById('canvas').appendChild(renderer.domElement);

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

// ── Camera ────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  0.5,
  2000,
);
camera.position.set(
  CONFIG.camera.orbitStart.x,
  CONFIG.camera.orbitStart.y,
  CONFIG.camera.orbitStart.z,
);
```

- [ ] **Step 2: Add lighting**

Append to `main.js`:

```js
// ── Lighting ──────────────────────────────────────────────────────────────────
const sun = new THREE.DirectionalLight(
  CONFIG.lighting.sunColor,
  CONFIG.lighting.sunIntensity,
);
sun.position.set(
  CONFIG.lighting.sunPosition.x,
  CONFIG.lighting.sunPosition.y,
  CONFIG.lighting.sunPosition.z,
);
sun.castShadow              = true;
sun.shadow.mapSize.width    = 2048;
sun.shadow.mapSize.height   = 2048;
sun.shadow.camera.near      = 1;
sun.shadow.camera.far       = 500;
sun.shadow.camera.left      = -150;
sun.shadow.camera.right     = 150;
sun.shadow.camera.top       = 150;
sun.shadow.camera.bottom    = -150;
scene.add(sun);

const ambient = new THREE.AmbientLight(
  CONFIG.lighting.ambientColor,
  CONFIG.lighting.ambientIntensity,
);
scene.add(ambient);
```

- [ ] **Step 3: Add geometry factory and rebuildBuilding**

Append to `main.js`:

```js
// ── Geometry factory ──────────────────────────────────────────────────────────

/**
 * Compute breezeway dimensions and position from garage and mainHouse config.
 * Breezeway fills the gap between garage east face and mainHouse west face,
 * centered on the garage's Z position.
 */
function computeBreezewayConfig() {
  const g  = CONFIG.garage;
  const mh = CONFIG.mainHouse;
  const garageEastX  = g.position.x  + g.width  / 2;
  const mainWestX    = mh.position.x - mh.width  / 2;
  const bwDepth      = Math.max(1, mainWestX - garageEastX);  // east-west span
  const bwCenterX    = garageEastX + bwDepth / 2;
  return {
    ...CONFIG.breezeway,
    depth:    bwDepth,
    position: { x: bwCenterX, z: g.position.z },
  };
}

/** Map building name → generator function call */
function buildGroup(name) {
  switch (name) {
    case 'mainHouse':  return createMainHouse(CONFIG.mainHouse);
    case 'guestHouse': return createGableBuilding(CONFIG.guestHouse);
    case 'gym':        return createGableBuilding(CONFIG.gym);
    case 'garage':     return createGableBuilding(CONFIG.garage);
    case 'breezeway':  return createGableBuilding(computeBreezewayConfig());
    case 'patio':      return createPatio(CONFIG.patio, CONFIG.mainHouse);
    case 'ground':     return createGround(CONFIG.site);
    default: return null;
  }
}

const BUILDING_NAMES = ['ground', 'mainHouse', 'guestHouse', 'gym', 'garage', 'breezeway', 'patio'];

/** Replace a group in the scene by name, or build all if name === '__all__' */
function rebuildBuilding(name) {
  if (name === '__all__') {
    renderer.shadowMap.enabled = CONFIG.lighting.shadowsEnabled;
    BUILDING_NAMES.forEach(n => rebuildBuilding(n));
    return;
  }
  // Remove old group
  const old = scene.getObjectByName(name);
  if (old) {
    old.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    scene.remove(old);
  }
  // Add new group
  const next = buildGroup(name);
  if (next) scene.add(next);
}

// Build initial scene
BUILDING_NAMES.forEach(name => {
  const g = buildGroup(name);
  if (g) scene.add(g);
});
```

- [ ] **Step 4: Add controls, render loop, and resize handler**

Append to `main.js`:

```js
// ── Controls ──────────────────────────────────────────────────────────────────
const controls = initControls(scene, camera, renderer, CONFIG, rebuildBuilding);

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Render loop ───────────────────────────────────────────────────────────────
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
```

- [ ] **Step 5: Commit**

```bash
git add main.js
git -c core.hooksPath=/dev/null commit -m "feat: add main.js — scene wiring, rebuildBuilding, render loop"
```

---

## Task 5: scene.html — entry point + index.html nav link

**Goal:** Standalone full-viewport page that loads Three.js and all ES modules; add "3D View →" link to existing site nav.

**Files:**
- Create: `scene.html`
- Modify: `index.html` (add one `<a>` tag to nav)

**Acceptance Criteria:**
- [ ] Opening `http://localhost:8080/scene.html` shows the 3D scene with no console errors
- [ ] Canvas fills the full viewport
- [ ] Page title is "Rusch-Lockhart Manor — 3D View"
- [ ] index.html nav contains "3D View →" link pointing to `scene.html`

**Verify:**
1. `http://localhost:8080/scene.html` — scene loads, buildings visible, controls work
2. `http://localhost:8080/` — nav shows "3D View →" link; clicking it navigates to scene.html

**Steps:**

- [ ] **Step 1: Create scene.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rusch-Lockhart Manor — 3D View</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">

  <!-- Three.js r169 via importmap — no build step needed -->
  <script type="importmap">
  {
    "imports": {
      "three":          "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
      "three/addons/":  "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"
    }
  }
  </script>

  <style>
    :root {
      --bg:     #0a0a0a;
      --accent: #c9a962;
      --border: #2a2a2a;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      overflow: hidden;
      font-family: 'Instrument Sans', sans-serif;
    }

    /* Back nav link */
    #back-link {
      position: fixed; top: 1rem; left: 1rem; z-index: 200;
      color: var(--accent); text-decoration: none;
      font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;
      opacity: 0.7; transition: opacity 0.2s;
    }
    #back-link:hover { opacity: 1; }

    /* Canvas container — Three.js appends canvas here */
    #canvas {
      position: fixed; inset: 0;
    }

    /* Keyboard hint — bottom center */
    #hint {
      position: fixed; bottom: 1.25rem; left: 50%; transform: translateX(-50%);
      font-size: 0.7rem; letter-spacing: 0.06em; color: #444;
      pointer-events: none; white-space: nowrap;
    }
  </style>
</head>
<body>
  <a href="index.html" id="back-link">← Planning Site</a>
  <div id="canvas"></div>
  <div id="hint">Drag to orbit · Scroll to zoom · F = walk · Esc = orbit</div>

  <!-- Load scene as ES module (importmap must be parsed first) -->
  <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add "3D View →" link to index.html nav**

Open `index.html`. Find the nav links block — it looks like:

```html
<a href="#site-plan" class="nav-link active">Site Plan</a>
<a href="#floor-plan" class="nav-link">Floor Plans</a>
<a href="#design" class="nav-link">Design Direction</a>
<a href="#cost" class="nav-link">Cost Breakdown</a>
<a href="#timeline" class="nav-link">Timeline</a>
```

Add one link after `Timeline`:

```html
<a href="scene.html" class="nav-link" style="color: var(--accent); border-bottom-color: var(--accent);">3D View →</a>
```

- [ ] **Step 3: Smoke test**

```bash
cd /Users/edrico/Documents/Claude/rusch-lockhart-manor
python3 -m http.server 8080
```

Open `http://localhost:8080/scene.html`. Confirm:
- [ ] All buildings visible (main house with clerestory silhouette, 4 outbuildings, patio slabs, ground)
- [ ] Orbit camera: drag rotates, scroll zooms
- [ ] Press F: cursor locks, WASD walks around
- [ ] Press Escape: returns to orbit, HUD shows ORBIT
- [ ] Drag a panel slider (e.g. Main House Width): building resizes in real time
- [ ] No errors in browser console

- [ ] **Step 4: Commit both files**

```bash
git add scene.html index.html
git -c core.hooksPath=/dev/null commit -m "feat: add scene.html 3D view, link from index.html nav"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push origin main
```

GitHub Pages will deploy to `https://edwardrusch3.github.io/rusch-lockhart-manor/scene.html` within ~60 seconds.

---

## Self-Review Notes

- `CONFIG` export: the spec shows `const CONFIG = { ... }` — ensure the file ends with either `export { CONFIG }` (named export) or the objects are referenced globally via `window.CONFIG`. Since `main.js` imports with `import { CONFIG }`, config.js must use a named export: add `export { CONFIG };` at the bottom.
- `createGableBuilding` used for breezeway with `roofRise: 0` → the flat-roof branch handles this correctly.
- Walk mode: `walk.object` is the camera wrapper — `walk.object.position.y = CONFIG.camera.walkHeight` ensures you don't fall through the floor.
- `rebuildBuilding('__all__')` triggered by shadow toggle — this is intentional (Three.js requires `renderer.shadowMap.needsUpdate = true` after toggling, which a full rebuild ensures).
