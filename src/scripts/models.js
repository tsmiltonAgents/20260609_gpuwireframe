// models.js — procedural, dimensionally accurate GPU system models.
//
// Units: centimetres, real-world scale. 1U = 4.445 cm; EIA-310 19in opening =
// 45.085 cm; OCP/MGX rack exterior = 60 cm. Layouts follow published system
// architecture (tray counts, module placement, power/cooling topology).
//
// Each mesh carries userData.tag naming its subsystem; wireframe.js renders
// edge-line wireframes coloured by a muted engineering palette and the scroll
// site uses the tags for section-by-section subsystem isolation.

import * as THREE from 'three';

export const U = 4.445;          // 1 rack unit, cm
const EIA_OPEN = 45.085;         // 19in rack opening
const EIA_EXT = 48.26;           // 19in flange-to-flange

// ---------------------------------------------------------------------------
// Muted engineering palette — desaturated, close-value hues. Reads like a
// CAD viewport with layer colours, not a neon render.
// ---------------------------------------------------------------------------
export const TAG_COLORS = {
  frame:        0x7d8794, // structural steel / sheet metal
  chassis:      0x7d8794,
  rail:         0x6b7682,
  pcb:          0x5f8a6e, // solder-mask green, muted
  gpu:          0x7fa8c9, // steel blue
  heatsink:     0x9aa6b2,
  coldplate:    0x8fb0c4,
  tube:         0x6f93a8, // coolant
  manifold:     0x6f93a8,
  memory:       0xa08fb5, // muted violet
  cpu:          0xc4ad7a, // muted brass
  power:        0xbf9468,
  busbar:       0xc9a26b,
  fan:          0x8b97a3,
  nic:          0x9b8fc0,
  interconnect: 0x9b8fc0,
  cable:        0x8a7f9e,
  drive:        0x7fa394,
  connector:    0xb3a274,
  bezel:        0x848e9a,
  label:        0x9aa4b0,
  default:      0x8c96a2,
};

// ---------------------------------------------------------------------------
// Construction helpers
// ---------------------------------------------------------------------------
function mesh(geo, tag, pos, rot) {
  const m = new THREE.Mesh(geo);
  m.userData.tag = tag || 'default';
  if (pos) m.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  return m;
}
function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function cyl(r, h, seg = 14) { return new THREE.CylinderGeometry(r, r, h, seg); }
function add(parent, geo, tag, pos, rot) {
  const m = mesh(geo, tag, pos, rot);
  parent.add(m);
  return m;
}

// Parallel-fin heatsink with base plate.
function finStack(parent, w, h, d, count, tag, pos) {
  const g = new THREE.Group();
  const t = Math.min(0.08, (w / count) * 0.35);
  for (let i = 0; i < count; i++) {
    add(g, box(t, h, d), tag, [-w / 2 + (i + 0.5) * (w / count), 0, 0]);
  }
  add(g, box(w, h * 0.12, d), tag, [0, -h / 2, 0]);
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// Axial fan: shroud, ring, hub, 7 blades.
function fanUnit(parent, radius, depth, tag, pos) {
  const g = new THREE.Group();
  const s = radius * 2.15;
  add(g, box(s, s, depth), tag, [0, 0, 0]);
  add(g, new THREE.TorusGeometry(radius, radius * 0.06, 6, 20), tag, [0, 0, depth * 0.1]);
  add(g, cyl(radius * 0.3, depth * 0.8, 12), tag, [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const bl = add(g, box(radius * 0.58, depth * 0.55, 0.06), tag,
      [Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55, 0]);
    bl.rotation.z = a; bl.rotation.y = 0.55;
  }
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// Bank of vertical DIMMs.
function dimmBank(parent, count, pos, spacing = 0.85, h = 3.2, d = 13.3) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    add(g, box(0.12, h, d), 'memory', [(-count / 2 + i + 0.5) * spacing, h / 2, 0]);
  }
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// Blind-mate quick disconnect (body + nozzle).
function qdFitting(parent, r, pos, rot) {
  const g = new THREE.Group();
  add(g, cyl(r, r * 2.4, 12), 'tube', [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(g, cyl(r * 0.55, r * 1.6, 10), 'tube', [0, 0, r * 1.9], [Math.PI / 2, 0, 0]);
  if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// Front-panel latch handle (ejector style).
function latch(parent, pos, mirror = false) {
  const g = new THREE.Group();
  add(g, box(0.5, 2.2, 0.5), 'frame', [0, 0, 0]);
  add(g, box(1.6, 0.5, 0.5), 'frame', [mirror ? -0.7 : 0.7, -1.0, 0]);
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

function center(group) {
  const bb = new THREE.Box3().setFromObject(group);
  const c = bb.getCenter(new THREE.Vector3());
  group.position.sub(c);
  const wrap = new THREE.Group();
  wrap.add(group);
  return wrap;
}

// ===========================================================================
// Grace-Blackwell "Bianca" superchip module: 1 Grace CPU + 2 Blackwell GPUs
// on one carrier with a shared cold plate and coolant tubes.
// Local frame: +z toward tray rear. Carrier ≈ 20 × 44 cm.
// ===========================================================================
function biancaModule(parent, pos) {
  const g = new THREE.Group();
  add(g, box(20, 0.25, 44), 'pcb', [0, 0, 0]);                         // carrier board

  add(g, box(8.0, 0.55, 8.0), 'cpu', [0, 0.4, 14]);                    // Grace package
  for (const dz of [-2.6, 2.6])                                        // LPDDR5X flanks
    for (const dx of [-6.2, 6.2])
      add(g, box(2.6, 0.45, 4.2), 'memory', [dx, 0.35, 14 + dz]);

  for (const z of [-13, -1]) {                                         // 2× Blackwell
    add(g, box(11, 0.6, 9.5), 'gpu', [0, 0.42, z]);
    for (const dx of [-4.2, 4.2])                                      // HBM3e stacks
      for (const dz of [-3.2, 0, 3.2])
        add(g, box(1.9, 0.5, 2.6), 'memory', [dx, 0.5, z + dz]);
  }

  // Shared cold plate spanning CPU + both GPUs, with machined steps
  add(g, box(13, 1.1, 36), 'coldplate', [0, 1.35, -1]);
  add(g, box(9, 0.5, 7), 'coldplate', [0, 2.15, 14]);
  add(g, box(11.5, 0.5, 22), 'coldplate', [0, 2.15, -7]);

  // Coolant in/out tubes running to tray rear (-z here = rear of module)
  for (const dx of [-4.5, 4.5]) {
    add(g, cyl(0.55, 24, 10), 'tube', [dx, 1.6, -10], [Math.PI / 2, 0, 0]);
    add(g, cyl(0.55, 3.2, 10), 'tube', [dx, 1.6, -22], [Math.PI / 2, 0, 0]);
  }

  // VRM banks along both edges
  for (const dx of [-8.6, 8.6])
    for (let i = 0; i < 7; i++)
      add(g, box(1.6, 0.7, 4.6), 'power', [dx, 0.5, -18 + i * 6]);

  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

// Shared MGX 1U tray shell: floor, low side walls, rear wall, faceplate
// with latches. Interior left open (lid omitted) so internals read in x-ray.
function trayShell(g, W, H, D) {
  add(g, box(W, 0.15, D), 'chassis', [0, -H / 2 + 0.1, 0]);
  for (const sx of [-W / 2, W / 2]) add(g, box(0.15, H, D), 'chassis', [sx, 0, 0]);
  add(g, box(W, H, 0.15), 'chassis', [0, 0, D / 2]);                   // rear
  add(g, box(W, H, 0.3), 'bezel', [0, 0, -D / 2]);                     // faceplate
  latch(g, [-W / 2 + 1.6, 0, -D / 2 - 0.5], false);
  latch(g, [W / 2 - 1.6, 0, -D / 2 - 0.5], true);
}

// ===========================================================================
// 1. NVL72 compute tray — 1U MGX, 2× Bianca (2 Grace + 4 Blackwell)
// ===========================================================================
function buildNvl72ComputeTray() {
  const g = new THREE.Group();
  const W = 54, H = U * 1.0 + 0.6, D = 90;     // MGX tray is wider than EIA 19"
  trayShell(g, W, H, D);

  biancaModule(g, [-12.5, -H / 2 + 0.6, 4]);
  biancaModule(g, [12.5, -H / 2 + 0.6, 4]);

  // Front bay: 4× E1.S NVMe + 2× BlueField-3 DPU low-profile
  for (let i = 0; i < 4; i++)
    add(g, box(1.2, 2.8, 12), 'drive', [-7 + i * 2.2, 0, -D / 2 + 7]);
  for (const dx of [6, 14])
    add(g, box(6.5, 0.2, 13), 'nic', [dx, -0.6, -D / 2 + 8]);

  // Rear blind-mate block: busbar clip (centre), NVLink connector array,
  // 2× liquid QDs each side
  add(g, box(5.5, 2.6, 2.2), 'busbar', [0, 0, D / 2 - 1.2]);
  add(g, box(30, 1.6, 1.4), 'interconnect', [0, -0.4, D / 2 - 0.8]);
  for (let i = 0; i < 9; i++)
    add(g, box(2.6, 1.2, 1.6), 'connector', [-12.8 + i * 3.2, -0.4, D / 2 - 0.4]);
  for (const dx of [-22, 22]) {
    qdFitting(g, 0.9, [dx, 0, D / 2 - 1.2], [0, Math.PI, 0]);
    qdFitting(g, 0.9, [dx + (dx < 0 ? 3 : -3), 0, D / 2 - 1.2], [0, Math.PI, 0]);
  }

  return {
    group: center(g),
    info: {
      id: 'nvl72-compute-tray',
      name: 'GB200 NVL72 Compute Tray',
      tagline: '1U MGX · 2× Grace-Blackwell superchip · liquid-cooled',
      dims: '44 H × 540 W × 900 D mm · 1U',
      specs: ['2× GB200 superchip (2 Grace + 4 Blackwell)', 'HBM3e: 6 stacks per GPU',
        'Shared cold plate per module', '4× E1.S NVMe + 2× BlueField-3',
        'Rear blind-mate: 48 V busbar, NVLink, QD pairs', '≈5.4 kW per tray'],
      featureTags: ['gpu', 'cpu', 'coldplate', 'tube'],
    },
  };
}

// ===========================================================================
// 2. NVL72 NVLink switch tray — 1U, 2× NVLink-5 switch ASICs
// ===========================================================================
function buildNvl72SwitchTray() {
  const g = new THREE.Group();
  const W = 54, H = U + 0.6, D = 90;
  trayShell(g, W, H, D);

  add(g, box(W - 6, 0.2, D - 14), 'pcb', [0, -H / 2 + 0.5, 1]);

  // 2× NVLink-5 switch ASICs with stepped cold plates
  for (const x of [-11, 11]) {
    add(g, box(8.5, 0.5, 8.5), 'interconnect', [x, -H / 2 + 0.85, -4]);
    add(g, box(10, 1.0, 10), 'coldplate', [x, -H / 2 + 1.6, -4]);
    for (const dx of [-7.5, 7.5])
      for (let i = 0; i < 5; i++)
        add(g, box(1.4, 0.6, 3.6), 'power', [x + dx, -H / 2 + 0.8, -12 + i * 4.5]);
    add(g, cyl(0.55, 30, 10), 'tube', [x - 3, -H / 2 + 2.1, 14], [Math.PI / 2, 0, 0]);
    add(g, cyl(0.55, 30, 10), 'tube', [x + 3, -H / 2 + 2.1, 14], [Math.PI / 2, 0, 0]);
  }

  // Rear: full-width NVLink cable-cartridge connector field (2×18 grid)
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 18; i++)
      add(g, box(2.2, 1.1, 1.5), 'connector', [-23 + i * 2.7, -1 + r * 2, D / 2 - 0.6]);
  add(g, box(5.5, 2.6, 2.2), 'busbar', [0, 0, D / 2 - 1.4]);
  for (const dx of [-24, 24]) qdFitting(g, 0.9, [dx, 0, D / 2 - 1.2], [0, Math.PI, 0]);

  // Front: management ports
  for (let i = 0; i < 4; i++)
    add(g, box(1.6, 1.2, 1.0), 'nic', [-20 + i * 2.4, 0, -D / 2 + 0.6]);

  return {
    group: center(g),
    info: {
      id: 'nvl72-switch-tray',
      name: 'NVL72 NVLink Switch Tray',
      tagline: '1U · 2× NVLink-5 switch ASIC · 14.4 TB/s',
      dims: '44 H × 540 W × 900 D mm · 1U',
      specs: ['2× NVLink-5 switch ASIC', '14.4 TB/s aggregate per tray',
        'Cold-plate cooled, blind-mate QD', 'Rear cable-cartridge connector field',
        '48 V busbar clip', '9 trays serve the 72-GPU domain'],
      featureTags: ['interconnect', 'connector', 'coldplate'],
    },
  };
}

// ===========================================================================
// 3. Full GB200 NVL72 rack
// Layout (top→bottom): 2U ToR/mgmt, 4× power shelf, 10× compute, 9× switch,
// 8× compute, 2× power shelf, blanks. Vertical 48 V busbar + coolant
// manifolds + NVLink cable cartridge at rear. One compute tray drawn in
// service position (pulled out, internals visible).
// ===========================================================================
function buildNvl72Rack() {
  const g = new THREE.Group();
  const W = 60, D = 110;
  const RU = 48;
  const H = RU * U + 16;
  const openW = 54.5;

  // Frame: corner posts, top/bottom decks, side panels (open front/rear)
  for (const sx of [-W / 2 + 1.2, W / 2 - 1.2])
    for (const sz of [-D / 2 + 1.2, D / 2 - 1.2])
      add(g, box(2.4, H, 2.4), 'frame', [sx, 0, sz]);
  add(g, box(W, 2, D), 'frame', [0, H / 2 - 1, 0]);
  add(g, box(W, 2, D), 'frame', [0, -H / 2 + 1, 0]);
  for (const sx of [-W / 2 + 1.2, W / 2 - 1.2])              // side cross-braces
    for (const by of [-H / 4, H / 4])
      add(g, box(2, 1.6, D - 6), 'frame', [sx, by, 0]);

  // Mounting rails with per-U hole marks (front pair)
  for (const sx of [-openW / 2 - 0.8, openW / 2 + 0.8]) {
    add(g, box(1.2, RU * U, 0.8), 'rail', [sx, 0, -D / 2 + 3]);
    for (let uu = 0; uu < RU; uu += 2)
      add(g, box(1.4, 0.7, 0.3), 'rail', [sx, -RU * U / 2 + (uu + 0.5) * U, -D / 2 + 2.6]);
  }

  // Rear vertical 48 V DC busbar (centre) + coolant supply/return manifolds
  add(g, box(4.5, RU * U, 1.6), 'busbar', [0, 0, D / 2 - 4]);
  for (const mx of [-16, 16])
    add(g, cyl(2.2, RU * U, 16), 'manifold', [mx, 0, D / 2 - 5]);

  // --- tray stack -----------------------------------------------------------
  const trayW = openW;
  let u = RU;
  const yOf = (uTop, hU) => -RU * U / 2 + (uTop - hU / 2) * U;

  function computeTrayFace(yU) {
    const t = new THREE.Group();
    add(t, box(trayW, U - 0.5, 0.5), 'bezel', [0, 0, 0]);
    latch(t, [-trayW / 2 + 1.5, 0, -0.6], false);
    latch(t, [trayW / 2 - 1.5, 0, -0.6], true);
    for (let i = 0; i < 4; i++)                                       // E1.S
      add(t, box(1.0, 2.6, 0.4), 'drive', [-6 + i * 2.0, 0, -0.4]);
    for (const dx of [8, 15])                                          // DPU ports
      add(t, box(4.0, 1.4, 0.4), 'nic', [dx, 0, -0.4]);
    add(t, box(2.2, 0.9, 0.3), 'label', [-15, 0.8, -0.4]);
    t.position.set(0, yOf(yU, 1), -D / 2 + 4.2);
    g.add(t);
  }
  function switchTrayFace(yU) {
    const t = new THREE.Group();
    add(t, box(trayW, U - 0.5, 0.5), 'bezel', [0, 0, 0]);
    latch(t, [-trayW / 2 + 1.5, 0, -0.6], false);
    latch(t, [trayW / 2 - 1.5, 0, -0.6], true);
    for (let i = 0; i < 4; i++)
      add(t, box(1.6, 1.1, 0.4), 'interconnect', [-19 + i * 2.3, 0, -0.4]);
    add(t, box(2.2, 0.9, 0.3), 'label', [15, 0.8, -0.4]);
    t.position.set(0, yOf(yU, 1), -D / 2 + 4.2);
    g.add(t);
  }
  function powerShelf(yU) {
    const t = new THREE.Group();
    add(t, box(trayW, U - 0.4, 0.5), 'bezel', [0, 0, 0]);
    for (let i = 0; i < 6; i++) {                                      // 6× rectifier
      add(t, box(7.6, U - 1.2, 0.6), 'power', [-trayW / 2 + 4.6 + i * 8.6, 0, -0.5]);
      add(t, box(0.8, 0.8, 0.4), 'label', [-trayW / 2 + 7.6 + i * 8.6, U / 2 - 1.4, -0.8]);
    }
    t.position.set(0, yOf(yU, 1), -D / 2 + 4.2);
    g.add(t);
  }

  // ToR / mgmt switch (2U)
  add(g, box(trayW, 2 * U - 1, 2), 'nic', [0, yOf(u, 2), -D / 2 + 4.5]); u -= 2;
  for (let i = 0; i < 4; i++) { powerShelf(u); u -= 1; }
  for (let i = 0; i < 10; i++) {
    if (i === 2) {
      // service position: full compute tray pulled 26 cm out of the rack
      const full = buildNvl72ComputeTray().group;
      full.position.set(0, yOf(u, 1), -D / 2 + 45 - 26);
      g.add(full);
      add(g, box(trayW, U - 0.5, 0.4), 'frame', [0, yOf(u, 1), -D / 2 + 3.8]);
    } else computeTrayFace(u);
    u -= 1;
  }
  const switchTopU = u;
  for (let i = 0; i < 9; i++) { switchTrayFace(u); u -= 1; }
  for (let i = 0; i < 8; i++) { computeTrayFace(u); u -= 1; }
  for (let i = 0; i < 2; i++) { powerShelf(u); u -= 1; }
  while (u > 0) {
    add(g, box(trayW, U - 0.3, 0.3), 'chassis', [0, yOf(u, 1), -D / 2 + 4]);
    u -= 1;
  }

  // NVLink copper cable cartridge: vertical block behind the switch section
  const cartH = 9 * U;
  const cartYTop = yOf(switchTopU, 0);
  add(g, box(34, cartH, 7), 'cable', [0, cartYTop - cartH / 2, D / 2 - 11]);
  for (let i = 1; i < 9; i++)
    add(g, box(34.2, 0.4, 7.2), 'cable', [0, cartYTop - i * U, D / 2 - 11]);

  return {
    group: center(g),
    info: {
      id: 'gb200-nvl72',
      name: 'GB200 NVL72 Rack',
      tagline: 'Rack-scale: 72× Blackwell + 36× Grace, one NVLink domain',
      dims: '2236 H × 600 W × 1100 D mm · 48U-class MGX',
      specs: ['18× 1U compute trays (10 + 8 split)', '9× NVLink switch trays, centre',
        '72 GPU / 36 Grace · 13.5 TB HBM3e', '130 TB/s NVLink-5 domain',
        '6× power shelves · 48 V busbar · ≈120 kW', 'Rack liquid loop: dual manifold + cartridge',
        'One tray shown in service position'],
      featureTags: ['gpu', 'busbar', 'manifold', 'cable'],
    },
  };
}

// ===========================================================================
// 4. HGX H100 8-GPU baseboard
// ===========================================================================
function buildHgxH100() {
  const g = new THREE.Group();
  // Baseboard ≈ 583 × 540 mm
  add(g, box(58.3, 0.32, 54), 'pcb', [0, 0, 0]);

  const cols = [-21, -7, 7, 21], rows = [-15, 15];
  for (const z of rows) for (const x of cols) {
    add(g, box(9.6, 0.7, 7.8), 'gpu', [x, 0.5, z]);                    // SXM5 package
    for (const dx of [-3.6, 3.6])                                       // HBM3 ×6
      for (const dz of [-2.6, 0, 2.6])
        add(g, box(1.7, 0.55, 2.2), 'memory', [x + dx, 0.62, z + dz]);
    finStack(g, 9.4, 5.2, 7.6, 22, 'heatsink', [x, 3.6, z]);           // 2U-class sink
    for (const dz of [-5.6, 5.6])                                       // VRM rows
      for (let i = 0; i < 5; i++)
        add(g, box(1.5, 0.8, 1.3), 'power', [x - 3.4 + i * 1.7, 0.55, z + dz]);
    for (const dx of [-4.4, 4.4])                                       // mounting posts
      for (const dz of [-3.5, 3.5])
        add(g, cyl(0.25, 0.9, 8), 'frame', [x + dx, 0.45, z + dz]);
  }

  // 4× NVSwitch (centre spine) with low sinks
  for (const x of [-16, -5.3, 5.3, 16]) {
    add(g, box(5.4, 0.5, 5.4), 'interconnect', [x, 0.4, 0]);
    finStack(g, 5.2, 2.2, 5.2, 12, 'heatsink', [x, 1.9, 0]);
  }

  // Front edge: 8× PCIe Gen5 x16 mezzanine connectors (2 rows)
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 4; i++)
      add(g, box(9.5, 0.9, 1.2), 'connector', [-19.5 + i * 13, 0.5, -25.8 + r * 2]);
  // Rear edge: power input connectors
  for (let i = 0; i < 4; i++)
    add(g, box(5.5, 1.1, 1.4), 'power', [-15 + i * 10, 0.6, 26]);
  // Guide pins
  for (const dx of [-27, 27]) add(g, cyl(0.5, 2.4, 10), 'frame', [dx, 1.2, -25]);

  return {
    group: center(g),
    info: {
      id: 'hgx-h100',
      name: 'HGX H100 8-GPU Baseboard',
      tagline: '8× SXM5 + 4× NVSwitch · 583 × 540 mm board',
      dims: '583 × 540 mm baseboard',
      specs: ['8× H100 SXM5, 700 W TDP each', '6× HBM3 stacks per package',
        '4× NVSwitch (3rd gen), 900 GB/s per GPU', '2U-class fin-stack heatsinks',
        '8× PCIe Gen5 ×16 mezzanine, front edge', '4-zone VRM per socket'],
      featureTags: ['gpu', 'interconnect', 'memory', 'heatsink'],
    },
  };
}

// ===========================================================================
// 5. DGX H100 — 8U system
// ===========================================================================
function buildDgxH100() {
  const g = new THREE.Group();
  const W = EIA_EXT, H = 8 * U, D = 90;   // 356 × 482.6 × ~897 mm

  // Chassis (open top for x-ray)
  add(g, box(W, 0.2, D), 'chassis', [0, -H / 2, 0]);
  for (const sx of [-W / 2, W / 2]) add(g, box(0.2, H, D), 'chassis', [sx, 0, 0]);
  add(g, box(W, H, 0.2), 'chassis', [0, 0, D / 2]);
  for (const tz of [-D / 2 + 6, 0, D / 2 - 6]) add(g, box(W, 0.4, 2), 'chassis', [0, H / 2, tz]);

  // Front: vented bezel field + centre column of 8× U.2 NVMe
  add(g, box(W, H, 0.4), 'bezel', [0, 0, -D / 2]);
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 5; c++) {
      if (c === 2 && r > 1 && r < 9) continue; // centre column open for drives
      add(g, box(7.2, 2.2, 0.3), 'bezel', [-W / 2 + 5.6 + c * 9.3, H / 2 - 3.4 - r * 3.2, -D / 2 - 0.3]);
    }
  for (let i = 0; i < 8; i++)
    add(g, box(7.0, 2.6, 0.5), 'drive', [0, H / 2 - 8.5 - i * 3.0, -D / 2 - 0.4]);

  // Lower 2U: host motherboard, 2× Xeon + 32 DIMM
  const mbY = -H / 2 + 1.2;
  add(g, box(W - 4, 0.2, 50), 'pcb', [0, mbY, 12]);
  for (const cx of [-10, 10]) {
    add(g, box(7.8, 0.5, 5.6), 'cpu', [cx, mbY + 0.4, 2]);
    finStack(g, 7.6, 2.6, 5.4, 14, 'heatsink', [cx, mbY + 2.0, 2]);
    dimmBank(g, 8, [cx - 6.5, mbY + 0.1, 14], 0.8, 3.2, 13);
    dimmBank(g, 8, [cx + 6.5, mbY + 0.1, 14], 0.8, 3.2, 13);
  }

  // Mid fan wall: 2 rows × 5 hot-swap dual-rotor fans
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 5; i++)
      fanUnit(g, 3.4, 2.6, 'fan', [-W / 2 + 6.4 + i * 8.9, -H / 2 + 5 + r * 7.4, -18]);

  // Upper 6U: HGX-8 complex (reuse the baseboard, lifted into position)
  const hgx = buildHgxH100().group;
  hgx.scale.setScalar(0.78);
  hgx.position.set(0, H / 2 - 9.5, 8);
  g.add(hgx);

  // Rear: 8× CX-7 OSFP cages (top) + 6× 3.3 kW PSUs (bottom)
  for (let i = 0; i < 8; i++)
    add(g, box(4.6, 2.6, 4), 'nic', [-W / 2 + 4.4 + i * 5.6, H / 2 - 4, D / 2 - 2.4]);
  for (let i = 0; i < 6; i++) {
    add(g, box(6.8, 4.0, 26), 'power', [-W / 2 + 5.4 + i * 7.6, -H / 2 + 2.6, D / 2 - 14]);
    finStack(g, 6.4, 3.6, 0.2, 12, 'power', [-W / 2 + 5.4 + i * 7.6, -H / 2 + 2.6, D / 2 - 0.9]);
  }

  return {
    group: center(g),
    info: {
      id: 'dgx-h100',
      name: 'DGX H100 System',
      tagline: '8U · 8× H100 SXM5 · 2× Xeon 8480C · 10.2 kW max',
      dims: '356 H × 482.6 W × 897 D mm · 8U · ~130 kg',
      specs: ['8× H100 SXM5 on HGX board (upper 6U)', '2× Xeon Platinum 8480C, 32× DDR5 DIMM',
        '8× ConnectX-7 400 Gb/s OSFP, rear top', '8× U.2 NVMe, front centre column',
        '10× dual-rotor hot-swap fans, mid-wall', '6× 3.3 kW PSU, rear bottom'],
      featureTags: ['gpu', 'cpu', 'fan', 'power', 'nic'],
    },
  };
}

// ===========================================================================
// 6. Full H100 rack — 42U EIA-310 with 4× DGX H100
// ===========================================================================
function buildH100Rack() {
  const g = new THREE.Group();
  const W = 60, D = 120, RU = 42;
  const H = RU * U + 14;

  for (const sx of [-W / 2 + 1.2, W / 2 - 1.2])
    for (const sz of [-D / 2 + 1.2, D / 2 - 1.2])
      add(g, box(2.4, H, 2.4), 'frame', [sx, 0, sz]);
  add(g, box(W, 2, D), 'frame', [0, H / 2 - 1, 0]);
  add(g, box(W, 2, D), 'frame', [0, -H / 2 + 1, 0]);
  for (const sx of [-W / 2 + 1.2, W / 2 - 1.2])              // side cross-braces
    for (const by of [-H / 4, H / 4])
      add(g, box(2, 1.6, D - 6), 'frame', [sx, by, 0]);

  // EIA rails + U-marks
  for (const sx of [-EIA_OPEN / 2 - 0.9, EIA_OPEN / 2 + 0.9]) {
    add(g, box(1.4, RU * U, 0.9), 'rail', [sx, 0, -D / 2 + 4]);
    for (let uu = 0; uu < RU; uu += 2)
      add(g, box(1.6, 0.7, 0.3), 'rail', [sx, -RU * U / 2 + (uu + 0.5) * U, -D / 2 + 3.5]);
  }

  // Vertical PDUs (A+B feeds), rear corners
  for (const sx of [-W / 2 + 4, W / 2 - 4]) {
    add(g, box(2.6, RU * U - 8, 5), 'power', [sx, 0, D / 2 - 6]);
    for (let i = 0; i < 12; i++)
      add(g, box(2.8, 1.0, 1.2), 'connector', [sx, -RU * U / 2 + 8 + i * 12, D / 2 - 8.4]);
  }

  const yOf = (uTop, hU) => -RU * U / 2 + (uTop - hU / 2) * U;
  let u = RU;

  // Top: 2× 1U ToR switches + 1U mgmt
  for (let s = 0; s < 2; s++) {
    const t = new THREE.Group();
    add(t, box(EIA_OPEN, U - 0.6, 1.4), 'nic', [0, 0, 0]);
    for (let i = 0; i < 16; i++)
      add(t, box(1.7, 1.0, 0.5), 'connector', [-EIA_OPEN / 2 + 2.6 + i * 2.6, 0, -0.9]);
    t.position.set(0, yOf(u, 1), -D / 2 + 5); g.add(t); u -= 1;
  }
  const mg = new THREE.Group();
  add(mg, box(EIA_OPEN, U - 0.6, 1.4), 'nic', [0, 0, 0]);
  mg.position.set(0, yOf(u, 1), -D / 2 + 5); g.add(mg); u -= 1;
  u -= 1; // blank gap

  // 4× DGX H100 (8U each) with 1U spacers
  for (let s = 0; s < 4; s++) {
    const dgx = buildDgxH100().group;
    dgx.scale.setScalar(0.985);
    dgx.position.set(0, yOf(u, 8), -8);
    g.add(dgx);
    u -= 8;
    if (s < 3) {
      add(g, box(EIA_OPEN, U - 0.4, 0.3), 'chassis', [0, yOf(u, 1), -D / 2 + 4.5]);
      u -= 1;
    }
  }
  while (u > 0) {
    add(g, box(EIA_OPEN, U - 0.4, 0.3), 'chassis', [0, yOf(u, 1), -D / 2 + 4.5]);
    u -= 1;
  }

  return {
    group: center(g),
    info: {
      id: 'h100-rack',
      name: 'H100 Rack — 4× DGX H100',
      tagline: '42U EIA-310 · 32× H100 total · air-cooled',
      dims: '2000 H × 600 W × 1200 D mm · 42U',
      specs: ['4× DGX H100 (8U each), full internals', '2× 1U ToR + 1U management switch',
        'A+B vertical PDUs, rear', '32× H100 SXM5 / 8× Xeon total',
        '≈41 kW IT load fully populated', 'EIA-310 rails with U-marks'],
      featureTags: ['gpu', 'power', 'nic', 'frame'],
    },
  };
}

// ===========================================================================
// 7. 4U PCIe GPU server (air-cooled PCIe option)
// ===========================================================================
function buildPcieServer() {
  const g = new THREE.Group();
  const W = EIA_EXT, H = 4 * U, D = 80;

  add(g, box(W, 0.2, D), 'chassis', [0, -H / 2, 0]);
  add(g, box(W, H, 0.2), 'chassis', [0, 0, D / 2]);
  for (const sx of [-W / 2, W / 2]) add(g, box(0.2, H, D), 'chassis', [sx, 0, 0]);
  for (const tz of [-D / 2 + 5, D / 2 - 5]) add(g, box(W, 0.4, 2.4), 'chassis', [0, H / 2, tz]);
  add(g, box(W, H, 0.4), 'bezel', [0, 0, -D / 2]);
  for (let i = 0; i < 12; i++)
    add(g, box(3.2, H * 0.66, 0.5), 'drive', [-W / 2 + 3.4 + i * 3.6, 0, -D / 2 - 0.4]);

  // 8× dual-slot FHFL GPUs (312 × 111 mm cards)
  for (let i = 0; i < 8; i++) {
    const x = -W / 2 + 3.8 + i * 5.3;
    const card = new THREE.Group();
    add(card, box(0.16, 11.1, 31.2), 'pcb', [0, 0, 0]);
    add(card, box(3.8, 10.6, 30.4), 'gpu', [0.1, 0, 0]);
    finStack(card, 3.2, 9.2, 26, 18, 'heatsink', [0.15, 0, -1]);
    add(card, box(0.16, 1.2, 8.0), 'connector', [0, -5.9, -6]);        // PCIe edge
    add(card, box(2.0, 0.8, 3.2), 'power', [0.2, 5.9, 8]);             // 12VHPWR
    add(card, box(0.3, 11.1, 1.2), 'frame', [0, 0, -15.9]);            // bracket
    card.position.set(x, 0.6, -12);
    g.add(card);
  }

  // Mid fan wall: 4× 92 mm counter-rotating
  for (let i = 0; i < 4; i++)
    fanUnit(g, 4.6, 3.8, 'fan', [-W / 2 + 6.8 + i * 11.6, 0, 6]);

  // Rear third: dual-socket board, 24 DIMM, PSUs
  add(g, box(W - 4, 0.2, 28), 'pcb', [0, -H / 2 + 0.6, 24]);
  for (const cx of [-9, 9]) {
    add(g, box(7.8, 0.5, 5.6), 'cpu', [cx, -H / 2 + 1.0, 18]);
    finStack(g, 7.6, 3.4, 5.4, 14, 'heatsink', [cx, -H / 2 + 3.0, 18]);
    dimmBank(g, 6, [cx - 5.8, -H / 2 + 0.7, 30], 0.85, 3.2, 13);
    dimmBank(g, 6, [cx + 5.8, -H / 2 + 0.7, 30], 0.85, 3.2, 13);
  }
  for (const px of [-15, 15]) {
    add(g, box(10.5, 4.2, 20), 'power', [px, H / 2 - 3, D / 2 - 11]);
    finStack(g, 10, 3.8, 0.2, 14, 'power', [px, H / 2 - 3, D / 2 - 0.8]);
  }

  return {
    group: center(g),
    info: {
      id: 'pcie-4u',
      name: '4U PCIe GPU Server',
      tagline: '8× dual-slot FHFL PCIe · air-cooled · EIA 19in',
      dims: '178 H × 482.6 W × 800 D mm · 4U',
      specs: ['8× dual-slot FHFL GPU (312 mm)', 'PCIe Gen5 ×16 per card + 12VHPWR',
        '4× 92 mm counter-rotating fan wall', '2× CPU, 24× DIMM, rear third',
        '12× 2.5in hot-swap bays, front', '2+2 redundant PSU'],
      featureTags: ['gpu', 'fan', 'cpu', 'power'],
    },
  };
}

// ---------------------------------------------------------------------------
// Registry — rack-scale first, then systems, then boards
// ---------------------------------------------------------------------------
export const BUILDERS = {
  'gb200-nvl72': buildNvl72Rack,
  'nvl72-compute-tray': buildNvl72ComputeTray,
  'nvl72-switch-tray': buildNvl72SwitchTray,
  'h100-rack': buildH100Rack,
  'dgx-h100': buildDgxH100,
  'hgx-h100': buildHgxH100,
  'pcie-4u': buildPcieServer,
};

export const MODELS = Object.keys(BUILDERS).map((id) => BUILDERS[id]().info);

export function build(id) {
  const fn = BUILDERS[id];
  if (!fn) return null;
  return fn();
}
