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
  // Cascade: rebuild structures that depend on this one's position/size
  if (name === 'garage')    rebuildBuilding('breezeway');
  if (name === 'mainHouse') { rebuildBuilding('patio'); rebuildBuilding('breezeway'); }
}

// Build initial scene
BUILDING_NAMES.forEach(name => {
  const g = buildGroup(name);
  if (g) scene.add(g);
});

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
