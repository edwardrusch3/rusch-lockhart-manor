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
`;

// ── Panel builder ─────────────────────────────────────────────────────────────

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

  // Tab switching
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

  return {
    setMode: (mode) => {
      hud.textContent = mode;
      xhair.style.display = mode === 'WALK' ? 'block' : 'none';
    },
    updateSqft,
  };
}

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

  return { update, updateSqft: panel.updateSqft };
}
