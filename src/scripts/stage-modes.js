// stage-modes.js — abstract representation/interaction modes for the landing
// stage. A theme may declare stageMode: 'points' | 'exploded' | 'ascii' |
// 'ortho' | 'flux' (default 'wire'). Each adapter gets {viewer, ctrl, stage}
// and returns hooks:
//   onScroll(p, tags, xray)  — scroll progress 0..1 + active section state
//   onFrame()                — per-frame animation
//   noRotate                 — true to suppress the default scroll rotation
//   handlesHighlight         — true to suppress default highlight()/setXray()
//   dispose()

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AsciiEffect } from 'three/addons/effects/AsciiEffect.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { currentTheme } from './themes.js';

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------------------
// points — the model as a particle cloud that condenses as you scroll
// ---------------------------------------------------------------------------
function pointsMode({ viewer, ctrl }) {
  const root = ctrl.root;
  root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const theme = currentTheme();
  const pal = theme.tags || {};
  const targets = [], colors = [], tagsArr = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const rel = new THREE.Matrix4().multiplyMatrices(invRoot, o.matrixWorld);
    const c = new THREE.Color(pal[o.userData.tag] != null ? pal[o.userData.tag] : 0xffffff);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(rel);
      targets.push(v.x, v.y, v.z);
      colors.push(c.r, c.g, c.b);
      tagsArr.push(o.userData.tag);
    }
  });
  const n = targets.length / 3;
  const bb = new THREE.Box3().setFromObject(root);
  const radius = bb.getBoundingSphere(new THREE.Sphere()).radius * 1.7;

  const scatter = new Float32Array(targets.length);
  let seed = 1234567;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < n; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1), r = radius * (0.55 + 0.45 * rand());
    scatter[i * 3] = r * Math.sin(ph) * Math.cos(th);
    scatter[i * 3 + 1] = r * Math.cos(ph) * 0.8;
    scatter[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(scatter), 3);
  geo.setAttribute('position', posAttr);
  const colAttr = new THREE.BufferAttribute(new Float32Array(colors), 3);
  geo.setAttribute('color', colAttr);
  const dark = theme.dark !== false;
  const mat = new THREE.PointsMaterial({
    size: radius / 110, vertexColors: true, transparent: true, opacity: dark ? 0.9 : 0.95,
    depthWrite: false, blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending,
    sizeAttenuation: true,
  });
  const cloud = new THREE.Points(geo, mat);
  root.visible = false;
  viewer.modelRoot.add(cloud);

  let conv = 0, targetConv = 0;
  const baseColors = new Float32Array(colors);

  return {
    handlesHighlight: true,
    onScroll(p, tags) {
      targetConv = ease(clamp01((p - 0.04) / 0.3));
      // tint: emphasized tags brighten, others dim — only when tags given
      const set = new Set(tags);
      const arr = colAttr.array;
      for (let i = 0; i < n; i++) {
        const on = set.size === 0 || set.has(tagsArr[i]);
        const f = on ? 1.0 : 0.18;
        arr[i * 3] = baseColors[i * 3] * f;
        arr[i * 3 + 1] = baseColors[i * 3 + 1] * f;
        arr[i * 3 + 2] = baseColors[i * 3 + 2] * f;
      }
      colAttr.needsUpdate = true;
    },
    onFrame() {
      conv += (targetConv - conv) * 0.045;
      const t = performance.now() * 0.001;
      const arr = posAttr.array;
      for (let i = 0; i < n; i++) {
        const ix = i * 3;
        const wob = (1 - conv) * radius * 0.012;
        arr[ix] = scatter[ix] + (targets[ix] - scatter[ix]) * conv + Math.sin(t * 0.8 + i * 0.37) * wob;
        arr[ix + 1] = scatter[ix + 1] + (targets[ix + 1] - scatter[ix + 1]) * conv + Math.cos(t * 0.7 + i * 0.61) * wob;
        arr[ix + 2] = scatter[ix + 2] + (targets[ix + 2] - scatter[ix + 2]) * conv + Math.sin(t * 0.9 + i * 0.23) * wob;
      }
      posAttr.needsUpdate = true;
    },
    dispose() { viewer.modelRoot.remove(cloud); geo.dispose(); mat.dispose(); root.visible = true; },
  };
}

// ---------------------------------------------------------------------------
// exploded — scroll drives a teardown of the model's top-level assemblies
// ---------------------------------------------------------------------------
function explodedMode({ viewer, ctrl }) {
  const inner = ctrl.root.children[0]; // center() wrap → original group
  const groupCenter = new THREE.Box3().setFromObject(inner).getCenter(new THREE.Vector3());
  const parts = inner.children.map((child) => {
    const c = new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3());
    const dir = c.clone().sub(groupCenter);
    dir.y *= 1.8;                               // bias vertical separation
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();
    return { child, orig: child.position.clone(), dir };
  });
  const radius = new THREE.Box3().setFromObject(inner).getBoundingSphere(new THREE.Sphere()).radius;
  let amt = 0, target = 0;

  return {
    onScroll(p) {
      // assembled at hero, fully exploded mid-page, reassembles at the end
      const ramp = ease(clamp01((p - 0.08) / 0.3)) * (1 - ease(clamp01((p - 0.82) / 0.15)));
      target = ramp * radius * 0.55;
    },
    onFrame() {
      amt += (target - amt) * 0.06;
      for (const part of parts) {
        part.child.position.copy(part.orig).addScaledVector(part.dir, amt);
      }
    },
    dispose() { for (const part of parts) part.child.position.copy(part.orig); },
  };
}

// ---------------------------------------------------------------------------
// ascii — render the scene as live ASCII art
// ---------------------------------------------------------------------------
function asciiMode({ viewer, stage }) {
  const a = (currentTheme() && currentTheme().ascii) || {};
  const effect = new AsciiEffect(viewer.renderer, a.charset || ' .:-=+*#%@',
    { invert: true, resolution: a.resolution || 0.205 });
  const el = effect.domElement;
  el.className = 'ascii-stage';
  el.style.cssText = 'position:absolute;inset:0;z-index:1;cursor:grab;';
  stage.insertBefore(el, stage.firstChild);
  viewer.canvas.style.visibility = 'hidden';

  const size = () => {
    const r = stage.getBoundingClientRect();
    effect.setSize(r.width, r.height);
  };
  size();
  window.addEventListener('resize', size);

  // rebind controls to the ascii element
  const old = viewer.controls;
  viewer.controls = new OrbitControls(viewer.camera, el);
  viewer.controls.enableDamping = true;
  viewer.controls.dampingFactor = 0.08;
  viewer.controls.enablePan = false;
  viewer.controls.minDistance = old.minDistance;
  viewer.controls.maxDistance = old.maxDistance;
  viewer.controls.target.copy(old.target);
  old.dispose();

  viewer.renderOverride = () => effect.render(viewer.scene, viewer.camera);

  return {
    dispose() {
      window.removeEventListener('resize', size);
      viewer.renderOverride = null;
      viewer.canvas.style.visibility = '';
      el.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// ortho — drafting elevations: scroll snaps between front/side/top/iso views
// ---------------------------------------------------------------------------
function orthoMode({ viewer }) {
  viewer.camera.fov = 9;                       // long lens ≈ orthographic
  viewer.camera.updateProjectionMatrix();
  viewer.frame(1.05);
  const dist = viewer.camera.position.distanceTo(viewer.controls.target);
  const center = viewer.controls.target.clone();
  // az (rad), el (rad) — front faces -z
  const VIEWS = [
    { az: Math.PI, el: 0.02 },                 // front elevation
    { az: Math.PI / 2, el: 0.02 },             // side elevation
    { az: Math.PI, el: Math.PI / 2 - 0.04 },   // plan (top)
    { az: Math.PI * 0.78, el: 0.42 },          // isometric-ish
  ];
  let cur = { az: VIEWS[0].az, el: VIEWS[0].el };
  let tgt = VIEWS[0];

  return {
    noRotate: true,
    onScroll(p) {
      const idx = Math.min(VIEWS.length - 1, Math.floor(p * 1.18 * VIEWS.length));
      tgt = VIEWS[idx];
    },
    onFrame() {
      cur.az += (tgt.az - cur.az) * 0.07;
      cur.el += (tgt.el - cur.el) * 0.07;
      const ce = Math.cos(cur.el), se = Math.sin(cur.el);
      viewer.camera.position.set(
        center.x + dist * ce * Math.sin(cur.az),
        center.y + dist * se,
        center.z + dist * ce * Math.cos(cur.az));
      viewer.camera.lookAt(center);
    },
    dispose() { viewer.camera.fov = 38; viewer.camera.updateProjectionMatrix(); },
  };
}

// ---------------------------------------------------------------------------
// flux — ghost model + telemetry particle streams (power / coolant / fabric)
// ---------------------------------------------------------------------------
function fluxMode({ viewer, ctrl }) {
  const theme = currentTheme();
  const fl = theme.flux || {};
  const dark = theme.dark !== false;
  ctrl.setOpacity(0.22);
  const bb = new THREE.Box3().setFromObject(ctrl.root);
  const size = bb.getSize(new THREE.Vector3());
  const c = bb.getCenter(new THREE.Vector3());

  function curveFromPoints(pts, closed = false) {
    return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  }
  const zBus = c.z + size.z * 0.36, zMan = c.z + size.z * 0.30, zNet = c.z + size.z * 0.24;
  const yLo = bb.min.y + size.y * 0.06, yHi = bb.max.y - size.y * 0.06;
  const streams = [
    { // power — straight climb up the busbar, amber
      key: 'power',
      tags: ['power', 'busbar'],
      color: fl.power != null ? fl.power : 0xffb45e, n: 260, speed: 0.085,
      curve: curveFromPoints([[c.x, yLo, zBus], [c.x, (yLo + yHi) / 2, zBus], [c.x, yHi, zBus]]),
    },
    { // coolant — closed loop down one manifold, across, up the other
      key: 'coolant',
      tags: ['coldplate', 'tube', 'manifold'],
      color: fl.coolant != null ? fl.coolant : 0x5fd4e8, n: 340, speed: 0.05,
      curve: curveFromPoints([
        [c.x - size.x * 0.27, yHi, zMan], [c.x - size.x * 0.27, yLo, zMan],
        [c.x, yLo - size.y * 0.015, zMan],
        [c.x + size.x * 0.27, yLo, zMan], [c.x + size.x * 0.27, yHi, zMan],
        [c.x, yHi + size.y * 0.015, zMan],
      ], true),
    },
    { // fabric — lacing zig-zag through the switch/cartridge belt, violet
      key: 'fabric',
      tags: ['nic', 'interconnect', 'cable', 'connector'],
      color: fl.fabric != null ? fl.fabric : 0xc99cf0, n: 300, speed: 0.12,
      curve: curveFromPoints((() => {
        const pts = []; const y0 = c.y - size.y * 0.10, y1 = c.y + size.y * 0.10;
        for (let i = 0; i <= 8; i++) {
          pts.push([c.x + (i % 2 ? 0.3 : -0.3) * size.x, y0 + (y1 - y0) * (i / 8), zNet]);
        }
        return pts;
      })()),
    },
  ];

  for (const s of streams) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(s.n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    s.mat = new THREE.PointsMaterial({
      color: s.color, size: size.y / 90, transparent: true, opacity: dark ? 0.85 : 0.95,
      depthWrite: false, blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    s.pts = new THREE.Points(geo, s.mat);
    s.attr = geo.attributes.position;
    s.phase = Array.from({ length: s.n }, (_, i) => i / s.n);
    viewer.modelRoot.add(s.pts);
    // faint guide line
    const lineGeo = new THREE.BufferGeometry().setFromPoints(s.curve.getPoints(120));
    s.guide = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
      color: s.color, transparent: true, opacity: 0.18 }));
    viewer.modelRoot.add(s.guide);
  }

  let t0 = performance.now();
  return {
    handlesHighlight: true,
    onScroll(p, tags) {
      const set = new Set(tags);
      for (const s of streams) {
        const active = set.size === 0 || s.tags.some((tg) => set.has(tg));
        s.mat.opacity = active ? 0.95 : 0.16;
        s.guide.material.opacity = active ? 0.3 : 0.05;
      }
      // ghost stays ghost; brighten slightly when no spotlight
      ctrl.setOpacity(set.size ? 0.14 : 0.25);
    },
    onFrame() {
      const dt = (performance.now() - t0) / 1000; t0 = performance.now();
      const v = new THREE.Vector3();
      for (const s of streams) {
        for (let i = 0; i < s.n; i++) {
          s.phase[i] = (s.phase[i] + s.speed * dt) % 1;
          s.curve.getPointAt(s.phase[i], v);
          s.attr.array[i * 3] = v.x; s.attr.array[i * 3 + 1] = v.y; s.attr.array[i * 3 + 2] = v.z;
        }
        s.attr.needsUpdate = true;
      }
    },
    dispose() {
      for (const s of streams) {
        viewer.modelRoot.remove(s.pts, s.guide);
        s.pts.geometry.dispose(); s.mat.dispose();
        s.guide.geometry.dispose(); s.guide.material.dispose();
      }
      ctrl.setOpacity(1);
    },
  };
}

// ---------------------------------------------------------------------------
// voxel — the model quantised into chunky cubes that stack in as you scroll
// ---------------------------------------------------------------------------
function voxelMode({ viewer, ctrl }) {
  const theme = currentTheme();
  const pal = theme.tags || {};
  const root = ctrl.root;
  root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const bb = new THREE.Box3().setFromObject(root);
  const size = bb.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const div = (theme.voxel && theme.voxel.div) || 52;
  const cell = maxDim / div;

  const cells = new Map();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const rel = new THREE.Matrix4().multiplyMatrices(invRoot, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(rel);
      const k = Math.floor((v.x - bb.min.x) / cell) + ',' +
                Math.floor((v.y - bb.min.y) / cell) + ',' +
                Math.floor((v.z - bb.min.z) / cell);
      if (!cells.has(k)) cells.set(k, o.userData.tag);
    }
  });

  const n = cells.size;
  const geo = new THREE.BoxGeometry(cell * 0.92, cell * 0.92, cell * 0.92);
  const mat = new THREE.MeshBasicMaterial();
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const targets = new Float32Array(n * 3);
  const normY = new Float32Array(n);
  const tagsArr = [];
  const baseCol = [];
  let i = 0;
  const col = new THREE.Color();
  for (const [k, tag] of cells) {
    const [qx, qy, qz] = k.split(',').map(Number);
    targets[i * 3] = bb.min.x + (qx + 0.5) * cell;
    targets[i * 3 + 1] = bb.min.y + (qy + 0.5) * cell;
    targets[i * 3 + 2] = bb.min.z + (qz + 0.5) * cell;
    normY[i] = (targets[i * 3 + 1] - bb.min.y) / size.y;
    tagsArr.push(tag);
    col.set(pal[tag] != null ? pal[tag] : 0x333333);
    baseCol.push(col.r, col.g, col.b);
    inst.setColorAt(i, col);
    i++;
  }
  root.visible = false;
  viewer.modelRoot.add(inst);

  const dimTarget = new THREE.Color(theme.dark === false ? 0xeaeaea : 0x161616);
  const m4 = new THREE.Matrix4();
  let conv = 0, target = 0, lastApplied = -1;

  return {
    handlesHighlight: true,
    onScroll(p, tags) {
      target = ease(clamp01((p - 0.03) / 0.34));
      const set = new Set(tags);
      for (let j = 0; j < n; j++) {
        const on = set.size === 0 || set.has(tagsArr[j]);
        col.setRGB(baseCol[j * 3], baseCol[j * 3 + 1], baseCol[j * 3 + 2]);
        if (!on) col.lerp(dimTarget, 0.68);
        inst.setColorAt(j, col);
      }
      inst.instanceColor.needsUpdate = true;
    },
    onFrame() {
      conv += (target - conv) * 0.06;
      if (Math.abs(conv - lastApplied) < 0.0005) return;
      lastApplied = conv;
      for (let j = 0; j < n; j++) {
        const s = ease(clamp01((conv - normY[j] * 0.82) / 0.18));
        m4.makeScale(s, s, s);
        m4.setPosition(targets[j * 3], targets[j * 3 + 1], targets[j * 3 + 2]);
        inst.setMatrixAt(j, m4);
      }
      inst.instanceMatrix.needsUpdate = true;
    },
    dispose() { viewer.modelRoot.remove(inst); geo.dispose(); mat.dispose(); root.visible = true; },
  };
}

// ---------------------------------------------------------------------------
// stamp — flat screen-print poster: solid fills, no linework; the active
// section gets the accent ink
// ---------------------------------------------------------------------------
function stampMode({ ctrl }) {
  const theme = currentTheme();
  const st = theme.stamp || {};
  const accent = new THREE.Color(st.accent != null ? st.accent : 0xffe600);
  const dark = new THREE.Color(st.dark != null ? st.dark : 0x0a0a0a);
  const mid = new THREE.Color(st.mid != null ? st.mid : 0x8e8e8e);
  const accentTags = new Set(st.accentTags || ['gpu', 'power', 'busbar']);
  const midTags = new Set(st.midTags || ['heatsink', 'fan', 'drive', 'label']);
  const ghostTags = new Set(st.ghostTags || ['chassis', 'frame', 'bezel', 'rail']);

  const saved = ctrl.lines.map((r) => ({
    r, fillColor: r.fill.color.clone(), fillOpacity: r.fill.opacity,
    fillTransparent: r.fill.transparent, lineOpacity: r.mat.opacity,
  }));
  for (const r of ctrl.lines) {
    r.mat.opacity = 0;
    if (ghostTags.has(r.tag)) {
      r.fill.transparent = true;
      r.fill.opacity = 0.1;
    } else {
      r.fill.transparent = false;
      r.fill.opacity = 1;
    }
  }
  function paint(activeTags) {
    const set = new Set(activeTags || []);
    for (const r of ctrl.lines) {
      if (ghostTags.has(r.tag)) {
        r.fill.color.copy(mid);
        // bring the shell back when it is the spotlit subsystem
        r.fill.opacity = set.has(r.tag) ? 0.85 : 0.1;
        if (set.has(r.tag)) r.fill.color.copy(accent);
        continue;
      }
      if (set.size ? set.has(r.tag) : accentTags.has(r.tag)) r.fill.color.copy(accent);
      else if (midTags.has(r.tag)) r.fill.color.copy(mid);
      else r.fill.color.copy(dark);
    }
  }
  paint([]);

  return {
    handlesHighlight: true,
    onScroll(p, tags) { paint(tags); },
    dispose() {
      for (const s of saved) {
        s.r.fill.color.copy(s.fillColor); s.r.fill.opacity = s.fillOpacity;
        s.r.fill.transparent = s.fillTransparent; s.r.mat.opacity = s.lineOpacity;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// glitch — wireframe through an RGB-split + digital glitch post chain
// ---------------------------------------------------------------------------
function glitchMode({ viewer }) {
  const composer = new EffectComposer(viewer.renderer);
  composer.addPass(new RenderPass(viewer.scene, viewer.camera));
  const rgb = new ShaderPass(RGBShiftShader);
  rgb.uniforms.amount.value = 0.0018;
  composer.addPass(rgb);
  const glitch = new GlitchPass();
  glitch.goWild = false;
  composer.addPass(glitch);

  const size = () => {
    const r = viewer.canvas.getBoundingClientRect();
    composer.setSize(Math.max(1, r.width), Math.max(1, r.height));
  };
  size();
  window.addEventListener('resize', size);
  viewer.renderOverride = () => composer.render();

  let lastP = 0, surge = 0;
  return {
    onScroll(p) { surge = Math.min(0.006, surge + Math.abs(p - lastP) * 0.12); lastP = p; },
    onFrame() {
      surge *= 0.94;
      rgb.uniforms.amount.value = 0.0018 + surge;
    },
    dispose() {
      window.removeEventListener('resize', size);
      viewer.renderOverride = null;
    },
  };
}

// ---------------------------------------------------------------------------
// slices — tomography: vertices snapped to horizontal scan planes; scroll
// sweeps the scan upward, frontier slice glows
// ---------------------------------------------------------------------------
function slicesMode({ viewer, ctrl }) {
  const theme = currentTheme();
  const pal = theme.tags || {};
  const darkTheme = theme.dark !== false;
  const scanColor = new THREE.Color((theme.slices && theme.slices.scan) != null ? theme.slices.scan : 0xc8ff4d);
  const root = ctrl.root;
  root.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const bb = new THREE.Box3().setFromObject(root);
  const size = bb.getSize(new THREE.Vector3());
  const SL = (theme.slices && theme.slices.count) || 46;

  const positions = [], base = [], sliceN = [];
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const rel = new THREE.Matrix4().multiplyMatrices(invRoot, o.matrixWorld);
    c.set(pal[o.userData.tag] != null ? pal[o.userData.tag] : 0x888888);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(rel);
      const sn = Math.round(((v.y - bb.min.y) / size.y) * (SL - 1)) / (SL - 1);
      positions.push(v.x, bb.min.y + sn * size.y, v.z);
      base.push(c.r, c.g, c.b);
      sliceN.push(sn);
    }
  });
  const n = sliceN.length;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const colAttr = new THREE.BufferAttribute(new Float32Array(base), 3);
  geo.setAttribute('color', colAttr);
  const mat = new THREE.PointsMaterial({
    size: Math.max(size.x, size.y, size.z) / 230, vertexColors: true, transparent: true,
    opacity: darkTheme ? 0.95 : 1.0, depthWrite: false,
    blending: darkTheme ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const cloud = new THREE.Points(geo, mat);
  root.visible = false;
  viewer.modelRoot.add(cloud);

  const hidden = darkTheme ? 0.04 : 0.92; // factor toward invisible
  const bg = new THREE.Color(theme.fill != null ? theme.fill : (darkTheme ? 0x000000 : 0xffffff));

  return {
    handlesHighlight: true,
    onScroll(p) {
      const scan = clamp01(p * 1.22);
      const arr = colAttr.array;
      for (let i = 0; i < n; i++) {
        const visible = sliceN[i] <= scan;
        const frontier = Math.abs(sliceN[i] - scan) < 1.6 / SL;
        if (frontier) {
          arr[i * 3] = scanColor.r; arr[i * 3 + 1] = scanColor.g; arr[i * 3 + 2] = scanColor.b;
        } else if (visible) {
          arr[i * 3] = base[i * 3]; arr[i * 3 + 1] = base[i * 3 + 1]; arr[i * 3 + 2] = base[i * 3 + 2];
        } else {
          arr[i * 3] = base[i * 3] + (bg.r - base[i * 3]) * (darkTheme ? 1 - hidden : hidden);
          arr[i * 3 + 1] = base[i * 3 + 1] + (bg.g - base[i * 3 + 1]) * (darkTheme ? 1 - hidden : hidden);
          arr[i * 3 + 2] = base[i * 3 + 2] + (bg.b - base[i * 3 + 2]) * (darkTheme ? 1 - hidden : hidden);
        }
      }
      colAttr.needsUpdate = true;
    },
    dispose() { viewer.modelRoot.remove(cloud); geo.dispose(); mat.dispose(); root.visible = true; },
  };
}


// ===========================================================================
// PURE-VIBE STAGES — no rack model; the stage becomes its own instrument.
// Shared helper: swap the wireframe out for an adapter-owned group.
// ===========================================================================
function takeStage(viewer, ctrl, stage, { drag = true } = {}) {
  viewer.modelRoot.remove(ctrl.root);
  if (viewer._grid) viewer._grid.visible = false;
  const group = new THREE.Group();
  viewer.modelRoot.add(group);
  if (!drag) {
    viewer.controls.enableRotate = false;
    viewer.controls.enableZoom = false;
    stage.classList.add('no-drag');
  }
  return {
    group,
    release() {
      viewer.modelRoot.remove(group);
      viewer.modelRoot.add(ctrl.root);
      if (viewer._grid) viewer._grid.visible = true;
      viewer.controls.enableRotate = true;
      viewer.controls.enableZoom = true;
      stage.classList.remove('no-drag');
      viewer.frame();
    },
  };
}

// ---------------------------------------------------------------------------
// scope — oscilloscope: graticule + animated traces; sections switch signals
// ---------------------------------------------------------------------------
function scopeMode({ viewer, ctrl, stage }) {
  const theme = currentTheme();
  const sc = theme.scope || {};
  const trace1Color = sc.trace != null ? sc.trace : 0x28ff9e;
  const trace2Color = sc.trace2 != null ? sc.trace2 : 0xffb000;
  const gridColor = sc.grid != null ? sc.grid : 0x153528;
  const st = takeStage(viewer, ctrl, stage, { drag: false });

  const W = 120, H = 70;
  // graticule
  const gpts = [];
  for (let i = 0; i <= 12; i++) gpts.push(new THREE.Vector3(-W / 2 + (i * W) / 12, -H / 2, 0), new THREE.Vector3(-W / 2 + (i * W) / 12, H / 2, 0));
  for (let i = 0; i <= 8; i++) gpts.push(new THREE.Vector3(-W / 2, -H / 2 + (i * H) / 8, 0), new THREE.Vector3(W / 2, -H / 2 + (i * H) / 8, 0));
  st.group.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(gpts),
    new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.8 })));

  const N = 480;
  function makeTrace(color, op) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
    st.group.add(line);
    return geo.attributes.position;
  }
  const tr1 = makeTrace(trace1Color, 0.95);
  const tr2 = makeTrace(trace2Color, 0.55);
  viewer.frame(1.15);

  // signal generators per section family
  const SIGS = {
    hero:    (x, t) => Math.sin(x * 4 + t * 2.0) * Math.sin(t * 0.7) * 0.8,
    compute: (x, t) => Math.sin(x * 6 + t * 3) * 0.5 + Math.sin(x * 17 + t * 7) * 0.18,
    thermal: (x, t) => Math.sin(x * 2 + t * 0.6) * 0.65 + Math.sin(x * 5 + t * 0.23) * 0.2,
    network: (x, t) => { const burst = Math.sin(x * 3 - t * 5); return (burst > 0.55 ? Math.sin(x * 60 + t * 30) * 0.8 : 0.04 * Math.sin(x * 30 + t * 9)); },
    power:   (x, t) => (Math.sin(x * 5 + t * 2.4) > 0 ? 0.62 : -0.62) + Math.sin(x * 40 + t * 18) * 0.06,
    taps:    (x, t) => (Math.sin(x * 93.7 + t * 41) + Math.sin(x * 57.3 - t * 23)) * 0.22,
  };
  function sigFor(tags) {
    const set = new Set(tags);
    if (set.has('power') || set.has('busbar')) return SIGS.power;
    if (set.has('coldplate') || set.has('tube') || set.has('manifold')) return SIGS.thermal;
    if (set.has('nic') || set.has('interconnect') || set.has('cable')) return SIGS.network;
    if (set.has('connector')) return SIGS.taps;
    if (set.has('gpu') || set.has('cpu') || set.has('memory')) return SIGS.compute;
    return SIGS.hero;
  }
  let cur = SIGS.hero, prev = SIGS.hero, blend = 1;

  return {
    noRotate: true, handlesHighlight: true,
    onScroll(p, tags) {
      const next = sigFor(tags);
      if (next !== cur) { prev = cur; cur = next; blend = 0; }
    },
    onFrame() {
      const t = performance.now() / 1000;
      blend = Math.min(1, blend + 0.03);
      for (let i = 0; i < N; i++) {
        const x = -W / 2 + (i / (N - 1)) * W;
        const xn = (i / (N - 1)) * Math.PI * 2;
        const y = (prev(xn, t) * (1 - blend) + cur(xn, t) * blend) * (H / 2.4);
        tr1.array[i * 3] = x; tr1.array[i * 3 + 1] = y; tr1.array[i * 3 + 2] = 0.5;
        const y2 = Math.sin(xn * 3 + t * 1.1) * Math.cos(xn + t * 0.4) * (H / 5);
        tr2.array[i * 3] = x; tr2.array[i * 3 + 1] = y2; tr2.array[i * 3 + 2] = 0;
      }
      tr1.needsUpdate = true; tr2.needsUpdate = true;
    },
    dispose() { st.release(); },
  };
}

// ---------------------------------------------------------------------------
// heatfield — thermal-camera shader plane; sections move the hotspots
// ---------------------------------------------------------------------------
function heatfieldMode({ viewer, ctrl, stage }) {
  const st = takeStage(viewer, ctrl, stage, { drag: false });
  const uniforms = {
    uTime: { value: 0 }, uHot: { value: 0.55 },
    uFocus: { value: new THREE.Vector2(0.5, 0.45) }, uScale: { value: 2.2 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime, uHot, uScale; uniform vec2 uFocus;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(11.7, 5.3); a *= 0.55; } return v; }
      vec3 inferno(float t){
        t = clamp(t, 0.0, 1.0);
        return vec3(
          clamp(2.2*t - 0.20, 0.0, 1.0) * (0.95 + 0.05*t),
          clamp(1.9*t - 0.65, 0.0, 1.0),
          clamp(t < 0.42 ? 1.4*t + 0.18 : 2.2 - 3.4*t, 0.0, 1.0) * 0.85);
      }
      void main(){
        vec2 p = vUv * uScale * vec2(1.7, 1.0);
        float n = fbm(p + uTime * 0.06 + fbm(p * 1.7 - uTime * 0.04));
        float d = distance(vUv, uFocus);
        float heat = n * 0.72 + uHot * smoothstep(0.55, 0.05, d) * 0.75;
        vec3 col = inferno(heat * 0.92);
        gl_FragColor = vec4(col * 0.92, 1.0);
      }`,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(130, 78), mat);
  st.group.add(plane);
  viewer.frame(1.12);

  const FOCI = {
    hero: [0.5, 0.45, 0.45], compute: [0.5, 0.62, 0.85], thermal: [0.46, 0.4, 1.0],
    network: [0.7, 0.55, 0.6], power: [0.5, 0.16, 0.95], taps: [0.26, 0.5, 0.7],
  };
  function fociFor(tags) {
    const set = new Set(tags);
    if (set.has('power') || set.has('busbar')) return FOCI.power;
    if (set.has('coldplate') || set.has('tube')) return FOCI.thermal;
    if (set.has('nic') || set.has('cable')) return FOCI.network;
    if (set.has('connector')) return FOCI.taps;
    if (set.has('gpu')) return FOCI.compute;
    return FOCI.hero;
  }
  const target = { x: 0.5, y: 0.45, hot: 0.45 };

  return {
    noRotate: true, handlesHighlight: true,
    onScroll(p, tags) { const f = fociFor(tags); target.x = f[0]; target.y = f[1]; target.hot = f[2]; },
    onFrame() {
      uniforms.uTime.value = performance.now() / 1000;
      uniforms.uFocus.value.x += (target.x - uniforms.uFocus.value.x) * 0.04;
      uniforms.uFocus.value.y += (target.y - uniforms.uFocus.value.y) * 0.04;
      uniforms.uHot.value += (target.hot - uniforms.uHot.value) * 0.04;
    },
    dispose() { st.release(); mat.dispose(); plane.geometry.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// logstream — DOM telemetry console; sections switch the feed
// ---------------------------------------------------------------------------
function logstreamMode({ viewer, ctrl, stage }) {
  const st = takeStage(viewer, ctrl, stage, { drag: false });
  viewer.canvas.style.display = 'none';
  const el = document.createElement('div');
  el.className = 'log-stage';
  stage.insertBefore(el, stage.firstChild);

  const r = () => Math.random();
  const pad = (v, n) => String(v).padStart(n, '0');
  const ts = () => { const d = new Date(); return `${pad(d.getHours(),2)}:${pad(d.getMinutes(),2)}:${pad(d.getSeconds(),2)}.${pad(d.getMilliseconds(),3)}`; };
  const GEN = {
    hero: () => [
      `<i>scc-agent</i> session attach rack=mgx-07 bare_metal=true`,
      `<i>telemetry</i> channels open: power(214) thermal(96) fabric(1318)`,
      `<i>scc-agent</i> tray nv-${1 + (r() * 18 | 0)} lease verified · key rotation ok`,
    ],
    compute: () => [
      `<i>gpu${r() * 72 | 0}</i> sm_act ${(62 + r() * 35).toFixed(1)}% tensor ${(55 + r() * 42).toFixed(1)}% hbm ${(2.1 + r() * 1.6).toFixed(2)}TB/s`,
      `<i>grace${r() * 36 | 0}</i> c2c ${(580 + r() * 280).toFixed(0)}GB/s lpddr ${(310 + r() * 110).toFixed(0)}GB/s`,
    ],
    thermal: () => [
      `<i>plate${r() * 72 | 0}</i> in ${(16.5 + r() * 2).toFixed(1)}C out ${(38 + r() * 9).toFixed(1)}C flow ${(1.4 + r() * 0.7).toFixed(2)}lpm`,
      `<i>cdu-a</i> dP ${(14 + r() * 9).toFixed(1)}kPa reservoir ${(61 + r() * 7).toFixed(1)}% pump2 ${(2900 + r() * 400 | 0)}rpm`,
      r() > 0.9 ? `<b class="warn">warn</b> plate${r() * 72 | 0} dT trending +${(0.3 + r() * 0.5).toFixed(2)}C/min` : `<i>loop</i> facility supply ${(14.8 + r() * 1.2).toFixed(1)}C ok`,
    ],
    network: () => [
      `<i>nvsw${1 + (r() * 9 | 0)}/p${r() * 72 | 0}</i> tx ${(1.1 + r() * 0.7).toFixed(2)}TB/s rx ${(1.0 + r() * 0.8).toFixed(2)}TB/s crc 0 replay ${r() > 0.93 ? 1 : 0}`,
      `<i>fabric</i> domain bisection ${(118 + r() * 11).toFixed(0)}TB/s topology stable`,
    ],
    power: () => [
      `<i>shelf${1 + (r() * 6 | 0)}</i> 48V ${(47.6 + r() * 0.7).toFixed(2)}V ${(310 + r() * 220).toFixed(1)}A ${(15 + r() * 11).toFixed(2)}kW pf ${(0.985 + r() * 0.012).toFixed(3)}`,
      `<i>busbar</i> tap nv-${1 + (r() * 18 | 0)} ripple ${(8 + r() * 14).toFixed(1)}mVpp`,
      r() > 0.92 ? `<b class="err">excursion</b> vrm gpu${r() * 72 | 0} phase${1 + (r() * 13 | 0)} +${(2 + r() * 5).toFixed(1)}%` : `<i>rectifier</i> efficiency ${(96.8 + r() * 1.1).toFixed(2)}%`,
    ],
    taps: () => [
      `<i>bmc nv-${1 + (r() * 18 | 0)}</i> sdr dump ok · ${(118 + r() * 40 | 0)} sensors`,
      `<i>probe</i> qd-${r() > 0.5 ? 'supply' : 'return'} fixture armed · scope trig ${(2 + r() * 6).toFixed(1)}mV`,
      `<i>interposer</i> nvlink cartridge lane ${r() * 18 | 0} eye ${(0.62 + r() * 0.2).toFixed(2)}UI`,
    ],
  };
  function genFor(tags) {
    const set = new Set(tags);
    if (set.has('power') || set.has('busbar')) return GEN.power;
    if (set.has('coldplate') || set.has('tube')) return GEN.thermal;
    if (set.has('nic') || set.has('cable')) return GEN.network;
    if (set.has('connector')) return GEN.taps;
    if (set.has('gpu')) return GEN.compute;
    return GEN.hero;
  }
  let gen = GEN.hero;
  el.innerHTML = `<div class="log-line head">side channel cloud · telemetry multiplex · rack mgx-07</div>`;
  const timer = setInterval(() => {
    const lines = gen();
    const line = lines[(Math.random() * lines.length) | 0];
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `<span class="t">${ts()}</span> ${line}`;
    el.appendChild(div);
    while (el.children.length > 160) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }, 140);

  return {
    noRotate: true, handlesHighlight: true,
    onScroll(p, tags) { gen = genFor(tags); },
    dispose() { clearInterval(timer); el.remove(); viewer.canvas.style.display = ''; st.release(); },
  };
}

// ---------------------------------------------------------------------------
// topo — drifting topographic contour shader; sections move the survey mark
// ---------------------------------------------------------------------------
function topoMode({ viewer, ctrl, stage }) {
  const theme = currentTheme();
  const tp = theme.topo || {};
  const ink = new THREE.Color(tp.ink != null ? tp.ink : 0x2b2a26);
  const paper = new THREE.Color(tp.paper != null ? tp.paper : 0xf1ecdf);
  const mark = new THREE.Color(tp.mark != null ? tp.mark : 0xd23b2e);
  const st = takeStage(viewer, ctrl, stage, { drag: false });
  const uniforms = {
    uTime: { value: 0 }, uInk: { value: new THREE.Vector3(ink.r, ink.g, ink.b) },
    uPaper: { value: new THREE.Vector3(paper.r, paper.g, paper.b) },
    uMark: { value: new THREE.Vector3(mark.r, mark.g, mark.b) },
    uFocus: { value: new THREE.Vector2(0.5, 0.5) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform vec3 uInk, uPaper, uMark; uniform vec2 uFocus;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.1 + vec2(7.3, 3.1); a *= 0.52; } return v; }
      void main(){
        vec2 p = vUv * vec2(2.6, 1.6);
        float h = fbm(p + vec2(uTime*0.012, -uTime*0.008));
        float bands = h * 26.0;
        float f = abs(fract(bands) - 0.5);
        float w = fwidth(bands) * 1.4;
        float line = 1.0 - smoothstep(0.06, 0.06 + w, f);
        float idx = step(fract(bands / 5.0), 0.2 / 5.0) * 0.6;
        vec3 col = mix(uPaper, uInk, clamp(line * (0.42 + idx), 0.0, 1.0));
        // survey cross
        vec2 d = vUv - uFocus;
        float cross_ = (1.0 - smoothstep(0.001, 0.0035, abs(d.x))) * step(abs(d.y), 0.035)
                     + (1.0 - smoothstep(0.001, 0.0035, abs(d.y))) * step(abs(d.x), 0.035);
        float ring = 1.0 - smoothstep(0.012, 0.016, abs(length(d) - 0.05));
        col = mix(col, uMark, clamp(cross_ + ring, 0.0, 1.0) * 0.9);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(130, 80), mat);
  st.group.add(plane);
  viewer.frame(1.12);

  const SPOTS = { hero: [0.5, 0.5], compute: [0.62, 0.6], thermal: [0.42, 0.38],
    network: [0.72, 0.46], power: [0.5, 0.22], taps: [0.3, 0.58] };
  function spotFor(tags) {
    const set = new Set(tags);
    if (set.has('power') || set.has('busbar')) return SPOTS.power;
    if (set.has('coldplate') || set.has('tube')) return SPOTS.thermal;
    if (set.has('nic') || set.has('cable')) return SPOTS.network;
    if (set.has('connector')) return SPOTS.taps;
    if (set.has('gpu')) return SPOTS.compute;
    return SPOTS.hero;
  }
  const tgt = { x: 0.5, y: 0.5 };
  return {
    noRotate: true, handlesHighlight: true,
    onScroll(p, tags) { const sp = spotFor(tags); tgt.x = sp[0]; tgt.y = sp[1]; },
    onFrame() {
      uniforms.uTime.value = performance.now() / 1000;
      uniforms.uFocus.value.x += (tgt.x - uniforms.uFocus.value.x) * 0.05;
      uniforms.uFocus.value.y += (tgt.y - uniforms.uFocus.value.y) * 0.05;
    },
    dispose() { st.release(); mat.dispose(); plane.geometry.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// orbital — the NVLink domain as a constellation: 72 GPU stars, 9 switch
// hubs, pulses travelling the edges
// ---------------------------------------------------------------------------
function orbitalMode({ viewer, ctrl, stage }) {
  const theme = currentTheme();
  const ob = theme.orbital || {};
  const starCol = new THREE.Color(ob.star != null ? ob.star : 0xe8ecf8);
  const hubCol = new THREE.Color(ob.hub != null ? ob.hub : 0xd8b36a);
  const edgeCol = ob.edge != null ? ob.edge : 0x26304e;
  const pulseCol = ob.pulse != null ? ob.pulse : 0xd8b36a;
  const st = takeStage(viewer, ctrl, stage, { drag: true });

  const gpuPos = [], hubPos = [];
  for (let ring = 0; ring < 4; ring++) {
    const y = -27 + ring * 18;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + ring * 0.18;
      gpuPos.push(new THREE.Vector3(Math.cos(a) * 36, y, Math.sin(a) * 36));
    }
  }
  for (let i = 0; i < 9; i++) hubPos.push(new THREE.Vector3(0, -22 + i * 5.5, 0));

  function pointCloud(list, color, size) {
    const geo = new THREE.BufferGeometry().setFromPoints(list);
    const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, m);
    st.group.add(pts);
    return m;
  }
  const gpuMat = pointCloud(gpuPos, starCol, 1.7);
  const hubMat = pointCloud(hubPos, hubCol, 2.6);

  // edges: each gpu to its 2 nearest hubs
  const edges = [];
  const epts = [];
  for (const g of gpuPos) {
    const sorted = [...hubPos].sort((a, b) => g.distanceTo(a) - g.distanceTo(b));
    for (const h of sorted.slice(0, 2)) { edges.push([g, h]); epts.push(g, h); }
  }
  const edgeMat = new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.4 });
  st.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(epts), edgeMat));

  // pulses
  const PN = 180;
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
  const pulseMat = new THREE.PointsMaterial({ color: pulseCol, size: 1.2, transparent: true,
    opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const ppts = new THREE.Points(pgeo, pulseMat);
  st.group.add(ppts);
  const pattr = pgeo.attributes.position;
  const pstate = Array.from({ length: PN }, () => ({ e: (Math.random() * edges.length) | 0, t: Math.random(), v: 0.004 + Math.random() * 0.012 }));

  viewer.frame(1.2);
  let speedMul = 1;

  return {
    handlesHighlight: true,
    onScroll(p, tags) {
      const set = new Set(tags);
      const net = set.has('nic') || set.has('interconnect') || set.has('cable');
      const pow = set.has('power') || set.has('busbar');
      const cmp = set.has('gpu') || set.has('memory');
      speedMul = net ? 3.2 : 1;
      gpuMat.opacity = cmp || set.size === 0 ? 0.95 : 0.4;
      hubMat.opacity = pow || net || set.size === 0 ? 0.95 : 0.45;
      edgeMat.opacity = net ? 0.8 : 0.4;
      pulseMat.opacity = net ? 1.0 : set.size === 0 ? 0.9 : 0.35;
    },
    onFrame() {
      const v = new THREE.Vector3();
      for (let i = 0; i < PN; i++) {
        const ps = pstate[i];
        ps.t += ps.v * speedMul;
        if (ps.t >= 1) { ps.t = 0; ps.e = (Math.random() * edges.length) | 0; }
        const [a, b] = edges[ps.e];
        v.lerpVectors(a, b, ps.t);
        pattr.array[i * 3] = v.x; pattr.array[i * 3 + 1] = v.y; pattr.array[i * 3 + 2] = v.z;
      }
      pattr.needsUpdate = true;
    },
    dispose() { st.release(); },
  };
}


// ---------------------------------------------------------------------------
// multi — the stage itself changes representation per section: a plan maps
// section tag-sets to sub-modes, built/torn down as you scroll between them
// ---------------------------------------------------------------------------
function multiMode(env) {
  const theme = currentTheme();
  const plan = theme.multi || { default: 'wire', map: [] };
  let cur = null, curId = null;
  let lastP = 0, lastTags = [], lastXray = false;

  function pick(tags) {
    const set = new Set(tags);
    for (const entry of plan.map || []) {
      if (entry.tags.some((t) => set.has(t))) return entry.mode;
    }
    return plan.default || 'wire';
  }
  function ensure(id) {
    if (id === curId) return;
    if (cur && cur.dispose) cur.dispose();
    curId = id;
    cur = id === 'wire' ? null : createStageAdapter(id, env);
    if (!cur) {
      env.ctrl.highlight(lastTags);
      env.ctrl.setXray(lastXray);
    }
  }

  return {
    handlesHighlight: true,
    get noRotate() { return cur ? !!cur.noRotate : false; },
    onScroll(p, tags, xray) {
      lastP = p; lastTags = tags; lastXray = xray;
      ensure(pick(tags));
      if (cur && cur.onScroll) cur.onScroll(p, tags, xray);
      else if (!cur) { env.ctrl.highlight(tags); env.ctrl.setXray(xray); }
    },
    onFrame() { if (cur && cur.onFrame) cur.onFrame(); },
    dispose() { if (cur && cur.dispose) cur.dispose(); },
  };
}

const MODES = { points: pointsMode, exploded: explodedMode, ascii: asciiMode, ortho: orthoMode, flux: fluxMode, voxel: voxelMode, stamp: stampMode, glitch: glitchMode, slices: slicesMode, scope: scopeMode, heatfield: heatfieldMode, logstream: logstreamMode, topo: topoMode, orbital: orbitalMode, multi: multiMode };

export function createStageAdapter(modeId, env) {
  const fn = MODES[modeId];
  if (!fn) return null;
  try { return fn(env); } catch (e) { console.error('stage mode failed', modeId, e); return null; }
}
