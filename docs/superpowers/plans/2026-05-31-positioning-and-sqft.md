# Positioning Controls + Live Sq Ft — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pinned sq ft summary bar and SIZE/POSITION tab switcher (with position sliders for outbuildings) to the 3D compound viewer panel.

**Architecture:** Two file edits — `controls.js` (panel UI: sq ft bar, tabs, position sliders, updateSqft) and `main.js` (cascade rebuilds so garage→breezeway and mainHouse→patio+breezeway auto-follow). No new files. `config.js` and `buildings.js` are untouched.

**Tech Stack:** Three.js r169 ES modules, vanilla JS/CSS panel, no build step. Serve locally with `npx serve -p 8080 .` from the repo root.

---

## Pre-flight: start the local server

```bash
cd /Users/edrico/Documents/Claude/rusch-lockhart-manor
PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.6.1/bin:$PATH npx serve -p 8080 .
# open http://localhost:8080/scene.html
```

Keep this running throughout.

---

## Task 1: Update controls.js — sq ft bar, SIZE/POSITION tabs, position sliders

**Goal:** Rewrite `buildPanel` to add the sq ft summary bar, SIZE/POSITION tabs, and position sliders for outbuildings; expose `updateSqft` through `initControls`.

**Files:**
- Modify: `controls.js`

**Acceptance Criteria:**
- [ ] Sq ft bar pinned below panel header: shows `width×depth` for Main House, Guest House, Gym, Garage, plus running total
- [ ] SIZE tab (default active) shows existing dimension sliders for all 4 buildings
- [ ] POSITION tab shows East/West + North/South sliders for Guest House, Gym, Garage (range −120 to 120, step 1)
- [ ] Main House has no position sliders
- [ ] Dragging any dimension slider updates the sq ft bar live
- [ ] Dragging a position slider writes to `CONFIG[key].position.x` / `.z` and calls `onRebuild(key)`
- [ ] `initControls` returns `{ update, updateSqft }`

**Verify:** Open `http://localhost:8080/scene.html` — sq ft bar visible with four buildings + total; click POSITION tab → position sliders appear; drag Guest House East/West → building moves; drag Main House Width → sq ft bar total updates.

**Steps:**

- [ ] **Step 1: Add CSS for sq ft bar and tabs**

In `controls.js`, find the line `  #crosshair::after  { width: 16px; height: 1px; top: 0; left: -8px; }` near the end of `PANEL_CSS`. Add these rules directly after it, before the closing backtick:

```css
  #ctrl-panel .sqft-bar {
    padding: 0.45rem 0.75rem;
    background: rgba(201,169,98,0.07);
    border-bottom: 1px solid #2a2a2a;
    display: grid; grid-template-columns: 1fr auto; gap: 0.2rem 0.5rem;
  }
  #ctrl-panel .sqft-lbl { font-size: 10px; color: #888; }
  #ctrl-panel .sqft-val { font-size: 10px; color: #c9a962; text-align: right; font-family: monospace; }
  #ctrl-panel .sqft-total-lbl {
    font-size: 10px; color: #a0a0a0; font-weight: 600;
    border-top: 1px solid #2a2a2a; padding-top: 0.2rem;
  }
  #ctrl-panel .sqft-total-val {
    font-size: 10px; color: #fff; text-align: right; font-family: monospace;
    font-weight: 600; border-top: 1px solid #2a2a2a; padding-top: 0.2rem;
  }
  #ctrl-panel .tab-row { display: flex; border-bottom: 1px solid #2a2a2a; }
  #ctrl-panel .tab {
    flex: 1; padding: 0.35rem 0; text-align: center;
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    background: none; border: none; color: #666; cursor: pointer;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
  }
  #ctrl-panel .tab.active { color: #c9a962; border-bottom-color: #c9a962; }
  #tab-position .val { color: #7aa3c9; }
```

- [ ] **Step 2: Replace the `buildPanel` function**

Replace everything from `function buildPanel(CONFIG, onRebuild) {` through the closing `}` on line 214 with:

```js
function buildPanel(CONFIG, onRebuild) {
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);

  // ── SIZE sections ───────────────────────────────────────────────────────────
  const sizeSections = [
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

  // ── POSITION sections (outbuildings only — main house is fixed anchor) ──────
  const positionSections = [
    { key: 'guestHouse', label: 'Guest House' },
    { key: 'gym',        label: 'Gym'         },
    { key: 'garage',     label: 'Garage'      },
  ];

  function renderSizeSection(sec) {
    return `
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
      </div>`;
  }

  function renderPositionSection(sec) {
    const pos = CONFIG[sec.key].position;
    return `
      <div class="building-section">
        <div class="section-header" data-key="pos-${sec.key}">
          ${sec.label} <span>▸</span>
        </div>
        <div class="section-body" id="body-pos-${sec.key}">
          <div class="row">
            <label>East/West</label>
            <input type="range"
              data-key="${sec.key}" data-prop="position" data-subprop="x"
              min="-120" max="120" step="1" value="${pos.x}">
            <span class="val" id="val-${sec.key}-position-x">${pos.x}</span>
          </div>
          <div class="row">
            <label>N/S</label>
            <input type="range"
              data-key="${sec.key}" data-prop="position" data-subprop="z"
              min="-120" max="120" step="1" value="${pos.z}">
            <span class="val" id="val-${sec.key}-position-z">${pos.z}</span>
          </div>
        </div>
      </div>`;
  }

  // ── Sq ft helpers ───────────────────────────────────────────────────────────
  const sqftKeys   = ['mainHouse', 'guestHouse', 'gym', 'garage'];
  const sqftLabels = { mainHouse: 'Main House', guestHouse: 'Guest House', gym: 'Gym', garage: 'Garage' };

  function updateSqft() {
    let total = 0;
    sqftKeys.forEach(k => {
      const sf = Math.round(CONFIG[k].width * CONFIG[k].depth);
      total += sf;
      document.getElementById(`sqft-${k}`).textContent = sf.toLocaleString();
    });
    document.getElementById('sqft-total').textContent = total.toLocaleString();
  }

  const initialTotal = sqftKeys.reduce((s, k) => s + CONFIG[k].width * CONFIG[k].depth, 0);

  // ── Build panel HTML ────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'ctrl-panel';

  panel.innerHTML = `
    <header>
      Compound Controls
      <button class="collapse-btn" id="ctrl-toggle">−</button>
    </header>
    <div id="ctrl-body">
      <div id="sqft-bar" class="sqft-bar">
        ${sqftKeys.map(k => `
          <span class="sqft-lbl">${sqftLabels[k]}</span>
          <span class="sqft-val" id="sqft-${k}">${Math.round(CONFIG[k].width * CONFIG[k].depth).toLocaleString()}</span>
        `).join('')}
        <span class="sqft-total-lbl">Total</span>
        <span class="sqft-total-val" id="sqft-total">${Math.round(initialTotal).toLocaleString()}</span>
      </div>
      <div id="tab-row" class="tab-row">
        <button class="tab active" data-tab="size">SIZE</button>
        <button class="tab" data-tab="position">POSITION</button>
      </div>
      <div id="tab-size">
        ${sizeSections.map(renderSizeSection).join('')}
      </div>
      <div id="tab-position" style="display:none">
        ${positionSections.map(renderPositionSection).join('')}
      </div>
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

  // Tab switching: show/hide #tab-size and #tab-position
  document.getElementById('tab-row').querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.getElementById('tab-row').querySelectorAll('.tab')
        .forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isSize = tab.dataset.tab === 'size';
      document.getElementById('tab-size').style.display     = isSize ? '' : 'none';
      document.getElementById('tab-position').style.display = isSize ? 'none' : '';
    });
  });

  // Section expand/collapse (works for both size and position sections)
  panel.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const key  = header.dataset.key;
      const body = document.getElementById(`body-${key}`);
      const open = body.classList.toggle('open');
      header.querySelector('span').textContent = open ? '▾' : '▸';
    });
  });

  // Unified slider handler:
  //   SIZE sliders:     data-key, data-prop            → CONFIG[key][prop] = val
  //   POSITION sliders: data-key, data-prop, data-subprop → CONFIG[key][prop][subprop] = val
  panel.querySelectorAll('input[type=range]').forEach(slider => {
    slider.addEventListener('input', () => {
      const { key, prop, subprop } = slider.dataset;
      const val = parseFloat(slider.value);
      if (subprop) {
        CONFIG[key][prop][subprop] = val;
        document.getElementById(`val-${key}-${prop}-${subprop}`).textContent = val;
      } else {
        CONFIG[key][prop] = val;
        document.getElementById(`val-${key}-${prop}`).textContent = val;
      }
      onRebuild(key);
      updateSqft();
    });
  });

  // Grid toggle
  document.getElementById('chk-grid').addEventListener('change', e => {
    CONFIG.site.gridVisible = e.target.checked;
    onRebuild('ground');
  });

  // Shadow toggle
  document.getElementById('chk-shadow').addEventListener('change', e => {
    CONFIG.lighting.shadowsEnabled = e.target.checked;
    onRebuild('__all__');
  });

  return { setMode: (mode) => {
    hud.textContent = mode;
    xhair.style.display = mode === 'WALK' ? 'block' : 'none';
  }, updateSqft };
}
```

- [ ] **Step 3: Update `initControls` return value**

In `initControls`, find the last line before the closing `}`:

```js
  return { update };
```

Replace it with:

```js
  return { update, updateSqft: panel.updateSqft };
```

- [ ] **Step 4: Commit**

```bash
cd /Users/edrico/Documents/Claude/rusch-lockhart-manor
git add controls.js
git -c core.hooksPath=/dev/null commit -m "feat: add sq ft bar, SIZE/POSITION tabs, and position sliders"
```

---

## Task 2: Update main.js — cascade rebuilds

**Goal:** When garage or mainHouse rebuild, automatically cascade to dependent structures so they stay in sync with the updated positions/dimensions.

**Files:**
- Modify: `main.js`

**Acceptance Criteria:**
- [ ] Moving garage via position slider also repositions the breezeway automatically
- [ ] Changing mainHouse dimensions also rebuilds patio and breezeway
- [ ] `rebuildBuilding('__all__')` still rebuilds everything without double-rebuilding

**Verify:** In the 3D scene — drag Garage East/West slider → breezeway follows in real time; drag Main House Width slider → patio stretches to match.

**Steps:**

- [ ] **Step 1: Replace `rebuildBuilding` with cascade version**

In `main.js`, replace the entire `rebuildBuilding` function (the one starting with `function rebuildBuilding(name) {`) with:

```js
function rebuildBuilding(name) {
  if (name === '__all__') {
    renderer.shadowMap.enabled = CONFIG.lighting.shadowsEnabled;
    BUILDING_NAMES.forEach(n => rebuildBuilding(n));
    return;
  }
  // Remove old group and dispose geometry/materials
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
  // Cascade: rebuild structures that depend on this one's position/size.
  // Guard against re-entering __all__ which handles the full set itself.
  if (name === 'garage')    rebuildBuilding('breezeway');
  if (name === 'mainHouse') { rebuildBuilding('patio'); rebuildBuilding('breezeway'); }
}
```

- [ ] **Step 2: Smoke test**

With the local server running, open `http://localhost:8080/scene.html`.

Check each of the following:
- [ ] Sq ft bar visible below the panel header with four buildings + total (e.g. `6,512`)
- [ ] Click POSITION tab → Guest House, Gym, Garage position sections appear; Main House absent
- [ ] Expand Guest House in POSITION tab → East/West and N/S sliders at −85 and 55 respectively
- [ ] Drag Guest House East/West → building moves left/right in real time; no console errors
- [ ] Click SIZE tab → dimension sliders reappear
- [ ] Drag Main House Width → main house stretches AND patio stretches AND breezeway repositions AND sq ft total updates
- [ ] Drag Garage East/West → garage moves AND breezeway follows automatically

- [ ] **Step 3: Commit**

```bash
git add main.js
git -c core.hooksPath=/dev/null commit -m "feat: cascade rebuild garage→breezeway and mainHouse→patio+breezeway"
```
