// models.js — procedural, true-to-life GPU tray / rack wireframe models.
// Each builder returns a THREE.Group of plain meshes. Every mesh carries a
// userData.tag naming its subsystem (gpu, pcb, cooling, memory, power, ...).
// wireframe.js turns these into clean edge-line wireframes and uses the tag to
// colour-code each subsystem. The scroll site uses the tags to reveal internals.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Subsystem colour palette (Side Channel Cloud — dark + neon technical look)
// ---------------------------------------------------------------------------
export const TAG_COLORS = {
  frame:        0x2f6f8f, // chassis / sheet metal
  chassis:      0x2f6f8f,
  rail:         0x3d6f8a,
  pcb:          0x27c06a, // boards
  gpu:          0x3df0ff, // GPU die / package
  heatsink:     0xa6ecff, // air heatsink fins
  coldplate:    0x6fd0ff, // liquid cold plate
  tube:         0xff4fa6, // coolant tubing / quick-disconnects
  manifold:     0xff7fc0,
  memory:       0xff3d9a, // DIMMs / HBM
  cpu:          0xffd24a, // CPU package
  power:        0xffb23d, // PSU / VRMs / busbar
  busbar:       0xffc14d,
  fan:          0x8fbecf,
  nic:          0xc77dff, // NIC / mezzanine / interconnect
  interconnect: 0xc77dff,
  cable:        0xff4fa6,
  drive:        0x6ff0c0, // NVMe / storage
  connector:    0xe8c45a, // gold edge connectors
  bezel:        0x4f8fa8,
  label:        0x8fb7c8,
  default:      0x6fa8c0,
};

// ---------------------------------------------------------------------------
// Small construction helpers
// ---------------------------------------------------------------------------
function mesh(geo, tag, pos, rot) {
  const m = new THREE.Mesh(geo);
  m.userData.tag = tag || 'default';
  if (pos) m.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  return m;
}
function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function cyl(r, h, seg = 16) { return new THREE.CylinderGeometry(r, r, h, seg); }

function add(parent, geo, tag, pos, rot) {
  const m = mesh(geo, tag, pos, rot);
  parent.add(m);
  return m;
}

// A bank of thin parallel fins (air heatsink). Spreads `count` fins across `w`.
function finStack(parent, w, h, d, count, tag, pos) {
  const g = new THREE.Group();
  const fin = 0.035;
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + (i + 0.5) * (w / count);
    add(g, box(fin, h, d), tag, [x, 0, 0]);
  }
  // base plate so the wireframe reads as a solid block edge
  add(g, box(w, 0.06, d), tag, [0, -h / 2, 0]);
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// A simple bladed fan: ring + hub + angled blades.
function fanUnit(parent, radius, depth, tag, pos, axis = 'z') {
  const g = new THREE.Group();
  add(g, new THREE.TorusGeometry(radius, radius * 0.08, 8, 24), tag, [0, 0, 0]);
  add(g, cyl(radius * 0.28, depth * 0.9, 14), tag, [0, 0, 0], [Math.PI / 2, 0, 0]);
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const bl = add(g, box(radius * 0.62, depth * 0.7, 0.05), tag, [
      Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55, 0]);
    bl.rotation.z = a;
    bl.rotation.y = 0.5;
  }
  // square shroud frame
  const s = radius * 2.1;
  add(g, box(s, s, 0.04), tag, [0, 0, -depth / 2]);
  if (axis === 'z') g.rotation.set(0, 0, 0);
  if (axis === 'x') g.rotation.set(0, Math.PI / 2, 0);
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// A vertical DIMM bank: `count` thin upright cards.
function dimmBank(parent, count, tag, pos, spacing = 0.16, w = 0.06, h = 1.0, d = 2.4) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    add(g, box(w, h, d), tag, [(-count / 2 + i + 0.5) * spacing, h / 2, 0]);
  }
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// Edge / mezzanine connector strip (gold fingers).
function connectorStrip(parent, w, tag, pos, count = 12) {
  const g = new THREE.Group();
  add(g, box(w, 0.18, 0.5), tag, [0, 0, 0]);
  for (let i = 0; i < count; i++) {
    add(g, box(w / count * 0.6, 0.22, 0.08), 'connector',
      [(-w / 2 + (i + 0.5) * (w / count)), 0.04, 0.18]);
  }
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// Recenter a group on its bounding box (XZ + sit on its own base).
function center(group) {
  const bb = new THREE.Box3().setFromObject(group);
  const c = bb.getCenter(new THREE.Vector3());
  group.position.sub(c);
  const wrap = new THREE.Group();
  wrap.add(group);
  return wrap;
}

// ===========================================================================
// 1. HGX / DGX-style 8-GPU SXM baseboard tray
// ===========================================================================
function buildHgxTray() {
  const g = new THREE.Group();

  // Baseboard PCB
  add(g, box(9.4, 0.2, 11.4), 'pcb', [0, 0, 0]);

  // 8 SXM GPU modules in a 4 x 2 grid
  const cols = [-3.45, -1.15, 1.15, 3.45];
  const rows = [-2.9, 2.9];
  for (const z of rows) {
    for (const x of cols) {
      // SXM package
      add(g, box(1.7, 0.22, 1.7), 'gpu', [x, 0.21, z]);
      // HBM stacks around the die
      for (const dx of [-0.55, 0.55]) {
        for (const dz of [-0.55, 0.55]) {
          add(g, box(0.32, 0.16, 0.32), 'memory', [x + dx, 0.27, z + dz]);
        }
      }
      // Air heatsink on top
      finStack(g, 1.6, 1.05, 1.6, 16, 'heatsink', [x, 0.95, z]);
      // VRM caps beside each module
      for (const dx of [-0.95, 0.95]) {
        add(g, box(0.18, 0.18, 1.2), 'power', [x + dx, 0.2, z]);
      }
    }
  }

  // 4 NVSwitch fabric chips down the spine (between the two GPU rows)
  for (const x of [-2.3, -0.77, 0.77, 2.3]) {
    add(g, box(1.0, 0.18, 0.9), 'interconnect', [x, 0.19, 0]);
    finStack(g, 0.95, 0.5, 0.85, 9, 'heatsink', [x, 0.5, 0]);
  }

  // Front mezzanine / NVLink connectors
  connectorStrip(g, 7.6, 'nic', [0, 0.18, -5.4], 24);
  // Rear power + management connectors
  connectorStrip(g, 5.0, 'power', [0, 0.18, 5.5], 14);

  // Tray side walls + carry handles
  for (const sx of [-4.8, 4.8]) {
    add(g, box(0.18, 1.3, 11.4), 'frame', [sx, 0.55, 0]);
    add(g, box(0.5, 0.18, 1.4), 'frame', [sx + (sx < 0 ? -0.3 : 0.3), 0.9, -4.2]);
  }
  // Front bezel
  add(g, box(9.4, 1.0, 0.16), 'bezel', [0, 0.4, -5.7]);

  return {
    group: center(g),
    info: {
      id: 'hgx-tray',
      name: 'HGX 8-GPU SXM Baseboard',
      tagline: '8× SXM accelerators · NVSwitch fabric · air-cooled',
      specs: ['8× SXM GPU modules', '4× NVSwitch fabric', 'HBM stacks', 'Front NVLink mezzanine'],
      featureTags: ['gpu', 'interconnect', 'memory', 'heatsink'],
    },
  };
}

// ===========================================================================
// 2. 4U PCIe GPU server (8× dual-slot cards, fan wall, dual CPU, PSUs)
// ===========================================================================
function buildPcieServer() {
  const g = new THREE.Group();
  const W = 9.4, H = 3.4, D = 14;

  // Chassis: floor + back + two sides + a few top cross members (open top)
  add(g, box(W, 0.12, D), 'chassis', [0, -H / 2, 0]);
  add(g, box(W, H, 0.12), 'chassis', [0, 0, D / 2]);            // back
  for (const sx of [-W / 2, W / 2]) add(g, box(0.12, H, D), 'chassis', [sx, 0, 0]);
  for (const tz of [-D / 2 + 1, D / 2 - 1]) add(g, box(W, 0.1, 0.5), 'chassis', [0, H / 2, tz]);

  // Front bezel with vent + drive bays
  add(g, box(W, H, 0.16), 'bezel', [0, 0, -D / 2]);
  for (let i = 0; i < 8; i++) {
    add(g, box(0.7, H * 0.7, 0.2), 'drive', [-W / 2 + 0.9 + i * 1.1, 0, -D / 2 - 0.05]);
  }

  // 8 PCIe GPU cards (dual-slot, full length) standing front section
  const gpuZ = -2.2;
  for (let i = 0; i < 8; i++) {
    const x = -W / 2 + 0.9 + i * 1.07;
    const card = new THREE.Group();
    add(card, box(0.1, 2.2, 6.4), 'pcb', [0, 0, 0]);                 // card PCB
    add(card, box(0.85, 1.9, 5.8), 'gpu', [0, 0, 0.1]);             // shroud
    finStack(card, 0.7, 1.7, 5.0, 14, 'heatsink', [0, 0, 0.2]);    // internal fins (along card)
    // blower fan at the rear of card
    fanUnit(card, 0.7, 0.3, 'fan', [0, 0, 3.0], 'z');
    // PCIe edge connector at bottom
    add(card, box(0.1, 0.25, 2.6), 'connector', [0, -1.1, -1.5]);
    card.position.set(x, 0, gpuZ);
    g.add(card);
  }

  // Fan wall across the middle
  for (let i = 0; i < 6; i++) {
    fanUnit(g, 0.62, 0.4, 'fan', [-W / 2 + 0.95 + i * 1.5, 0, 1.6], 'z');
  }

  // Motherboard + dual CPU + DIMMs (back third)
  add(g, box(W - 0.6, 0.12, 5.4), 'pcb', [0, -H / 2 + 0.3, 4.4]);
  for (const cx of [-2.0, 2.0]) {
    add(g, box(1.3, 0.25, 1.3), 'cpu', [cx, -H / 2 + 0.5, 3.6]);
    finStack(g, 1.25, 0.8, 1.25, 12, 'heatsink', [cx, -H / 2 + 1.0, 3.6]);
    dimmBank(g, 8, 'memory', [cx, -H / 2 + 0.4, 5.3], 0.2, 0.06, 1.1, 1.6);
  }

  // PSUs at back corners
  for (const px of [-3.2, 3.2]) {
    add(g, box(2.4, 1.2, 2.6), 'power', [px, H / 2 - 0.9, D / 2 - 1.6]);
    finStack(g, 2.2, 1.0, 0.1, 18, 'power', [px, H / 2 - 0.9, D / 2 - 0.25]); // grille
  }

  return {
    group: center(g),
    info: {
      id: 'pcie-4u',
      name: '4U PCIe GPU Server',
      tagline: '8× dual-slot PCIe GPUs · fan wall · dual-CPU host',
      specs: ['8× PCIe GPU cards', 'Dual CPU + 16 DIMM', '6-fan cooling wall', 'Redundant PSUs'],
      featureTags: ['gpu', 'fan', 'cpu', 'memory', 'power'],
    },
  };
}

// ===========================================================================
// 3. Liquid-cooled cold-plate GPU tray (the "side channel" loop)
// ===========================================================================
function buildColdPlateTray() {
  const g = new THREE.Group();
  add(g, box(9.4, 0.2, 12.0), 'pcb', [0, 0, 0]);

  const cols = [-3.45, -1.15, 1.15, 3.45];
  const rows = [-3.0, 3.0];
  const plateTops = [];
  for (const z of rows) {
    for (const x of cols) {
      add(g, box(1.7, 0.22, 1.7), 'gpu', [x, 0.21, z]);
      // flat cold plate sitting on the die
      add(g, box(1.8, 0.4, 1.8), 'coldplate', [x, 0.55, z]);
      plateTops.push([x, 0.75, z]);
      for (const dx of [-0.55, 0.55]) for (const dz of [-0.55, 0.55])
        add(g, box(0.3, 0.16, 0.3), 'memory', [x + dx, 0.27, z + dz]);
    }
  }

  // Two main coolant manifolds running front-to-back along the sides
  for (const mx of [-4.3, 4.3]) {
    add(g, cyl(0.28, 11.0, 18), 'manifold', [mx, 0.75, 0], [Math.PI / 2, 0, 0]);
  }
  // Branch tubes from manifold to each cold plate
  for (const [x, y, z] of plateTops) {
    const sign = x < 0 ? -1 : 1;
    add(g, cyl(0.12, Math.abs(4.3 - Math.abs(x)) + 0.5, 10), 'tube',
      [(x + sign * 4.3) / 2, y, z], [0, 0, Math.PI / 2]);
  }
  // Quick-disconnect fittings at the front
  for (const mx of [-4.3, 4.3]) {
    add(g, cyl(0.42, 0.9, 14), 'tube', [mx, 0.75, -6.3], [Math.PI / 2, 0, 0]);
    add(g, box(0.7, 0.7, 0.7), 'tube', [mx, 0.75, -6.9]);
  }

  // Side rails + bezel
  for (const sx of [-4.8, 4.8]) add(g, box(0.18, 1.2, 12.0), 'frame', [sx, 0.5, 0]);
  add(g, box(9.4, 1.0, 0.16), 'bezel', [0, 0.4, -6.0]);

  return {
    group: center(g),
    info: {
      id: 'coldplate-tray',
      name: 'Liquid Cold-Plate GPU Tray',
      tagline: 'Direct-to-chip liquid · dual manifold · quick-disconnect',
      specs: ['8× GPU cold plates', 'Dual coolant manifold', 'Per-die branch loops', 'Blind-mate QDC'],
      featureTags: ['coldplate', 'tube', 'manifold', 'gpu'],
    },
  };
}

// ===========================================================================
// 4. 1U compute sled (dual-CPU host node)
// ===========================================================================
function buildComputeSled() {
  const g = new THREE.Group();
  const W = 9.4, H = 0.9, D = 12;
  add(g, box(W, 0.1, D), 'chassis', [0, -H / 2, 0]);
  for (const sx of [-W / 2, W / 2]) add(g, box(0.1, H, D), 'chassis', [sx, 0, 0]);
  add(g, box(W, H, 0.1), 'chassis', [0, 0, D / 2]);
  add(g, box(W, H, 0.14), 'bezel', [0, 0, -D / 2]);

  add(g, box(W - 0.5, 0.1, D - 1.5), 'pcb', [0, -H / 2 + 0.2, 0.4]);
  for (const cx of [-2.2, 2.2]) {
    add(g, box(1.2, 0.2, 1.2), 'cpu', [cx, -H / 2 + 0.35, -1.5]);
    finStack(g, 1.15, 0.45, 1.15, 10, 'heatsink', [cx, -H / 2 + 0.6, -1.5]);
    dimmBank(g, 6, 'memory', [cx, -H / 2 + 0.25, 1.6], 0.22, 0.05, 0.6, 1.4);
  }
  for (let i = 0; i < 6; i++) fanUnit(g, 0.34, 0.3, 'fan', [-W / 2 + 0.9 + i * 1.5, 0, -4.4], 'z');
  add(g, box(2.2, 0.6, 0.1), 'nic', [3.0, -H / 2 + 0.45, -D / 2 + 0.2]); // OCP NIC at front
  for (const px of [-3.2, 3.2]) add(g, box(2.2, H - 0.2, 2.0), 'power', [px, 0, D / 2 - 1.3]);

  return {
    group: center(g),
    info: {
      id: 'compute-1u',
      name: '1U Compute Sled',
      tagline: 'Dual-CPU host node · 12 DIMM · OCP NIC',
      specs: ['Dual CPU', '12× DIMM', '6-fan row', 'OCP 3.0 NIC'],
      featureTags: ['cpu', 'memory', 'fan', 'nic'],
    },
  };
}

// ===========================================================================
// 5. NVMe storage sled
// ===========================================================================
function buildStorageSled() {
  const g = new THREE.Group();
  const W = 9.4, H = 1.6, D = 12;
  add(g, box(W, 0.1, D), 'chassis', [0, -H / 2, 0]);
  for (const sx of [-W / 2, W / 2]) add(g, box(0.1, H, D), 'chassis', [sx, 0, 0]);
  add(g, box(W, H, 0.1), 'chassis', [0, 0, D / 2]);
  add(g, box(W, H, 0.14), 'bezel', [0, 0, -D / 2]);

  // Two rows of vertical hot-swap NVMe drives
  const drives = 12;
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < drives; i++) {
      const x = -W / 2 + 0.7 + i * ((W - 1.4) / (drives - 1));
      add(g, box(0.5, H * 0.8, 3.6), 'drive', [x, 0, -3 + r * 5.0]);
    }
  }
  // Backplane + controller
  add(g, box(W - 1, 0.1, 0.4), 'pcb', [0, -H / 2 + 0.3, 4.0]);
  add(g, box(2.0, 0.2, 1.6), 'cpu', [0, -H / 2 + 0.3, 5.0]);
  for (let i = 0; i < 4; i++) fanUnit(g, 0.34, 0.25, 'fan', [-3 + i * 2, 0, D / 2 - 1.2], 'z');

  return {
    group: center(g),
    info: {
      id: 'storage-sled',
      name: 'NVMe Storage Sled',
      tagline: '24× hot-swap NVMe · PCIe backplane',
      specs: ['24× NVMe drives', 'PCIe switch backplane', 'Hot-swap bays', 'Rear cooling'],
      featureTags: ['drive', 'pcb', 'fan'],
    },
  };
}

// ===========================================================================
// 6. Full Open-Rack v3 style rack, populated
// ===========================================================================
function buildOpenRack() {
  const g = new THREE.Group();
  const W = 10, D = 13, H = 32;

  // Four corner posts + cross members
  for (const sx of [-W / 2, W / 2]) for (const sz of [-D / 2, D / 2]) {
    add(g, box(0.4, H, 0.4), 'frame', [sx, 0, sz]);
  }
  for (const y of [-H / 2, H / 2]) for (const sz of [-D / 2, D / 2]) {
    add(g, box(W, 0.3, 0.3), 'frame', [0, y, sz]);
    add(g, box(0.3, 0.3, D), 'frame', [sz < 0 ? -W / 2 : W / 2, y, 0]);
  }
  // Vertical power busbar at the back
  add(g, box(0.9, H - 1, 0.5), 'busbar', [0, 0, D / 2 - 0.4]);

  // Populate slots from bottom to top
  let y = -H / 2 + 1.2;
  const slotH = 1.6;
  const place = (group, h) => { group.position.y = y + h / 2; y += h + 0.25; g.add(group); };

  // Power shelf (rectifiers) at the bottom
  const psh = new THREE.Group();
  add(psh, box(W - 1, slotH, D - 1), 'frame', [0, 0, 0]);
  for (let i = 0; i < 6; i++) add(psh, box(1.2, slotH * 0.8, D - 2), 'power', [-W / 2 + 1.2 + i * 1.3, 0, 0]);
  place(psh, slotH);

  // A stack of GPU trays (each shows its 8-GPU dot pattern) + switches
  for (let s = 0; s < 9; s++) {
    const slot = new THREE.Group();
    if (s === 4) {
      // network switch slot
      add(slot, box(W - 1, slotH * 0.8, D - 2), 'frame', [0, 0, 0]);
      for (let p = 0; p < 16; p++)
        add(slot, box(0.35, 0.35, 0.3), 'nic', [-W / 2 + 1.1 + p * 0.5, 0, -D / 2 + 1.2]);
    } else {
      // GPU tray
      add(slot, box(W - 1, 0.1, D - 1.5), 'pcb', [0, -slotH / 2 + 0.3, 0]);
      add(slot, box(W - 1, slotH * 0.3, 0.2), 'bezel', [0, 0, -D / 2 + 0.9]);
      const cols = [-3, -1, 1, 3], rows = [-2.2, 2.2];
      for (const z of rows) for (const cx of cols) {
        add(slot, box(1.1, slotH * 0.55, 1.1), 'gpu', [cx, 0, z]);
      }
      for (const sx of [-W / 2 + 0.6, W / 2 - 0.6]) add(slot, box(0.18, slotH, D - 1.5), 'tube', [sx, 0, 0]);
    }
    place(slot, slotH);
  }

  return {
    group: center(g),
    info: {
      id: 'open-rack',
      name: 'Open-Rack v3 — Populated',
      tagline: 'Full rack · busbar power · GPU trays + fabric switch',
      specs: ['9× GPU trays', 'Central fabric switch', 'Rectifier power shelf', 'Vertical busbar'],
      featureTags: ['gpu', 'busbar', 'frame', 'nic'],
    },
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const BUILDERS = {
  'hgx-tray': buildHgxTray,
  'pcie-4u': buildPcieServer,
  'coldplate-tray': buildColdPlateTray,
  'compute-1u': buildComputeSled,
  'storage-sled': buildStorageSled,
  'open-rack': buildOpenRack,
};

export const MODELS = Object.keys(BUILDERS).map((id) => BUILDERS[id]().info);

export function build(id) {
  const fn = BUILDERS[id];
  if (!fn) return null;
  return fn();
}
