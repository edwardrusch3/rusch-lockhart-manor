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

export { CONFIG };
