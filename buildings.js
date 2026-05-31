// buildings.js — geometry generators.
// All functions are pure: they take a config object, return a THREE.Group.
// No scene.add() calls here. The caller (main.js) places groups in the scene.

import * as THREE from 'three';

/** Shared Lambert material — cheap, takes lighting, no specular. */
function mat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

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
