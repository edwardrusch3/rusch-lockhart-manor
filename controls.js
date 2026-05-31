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
