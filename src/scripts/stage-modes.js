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
  const mat = new THREE.PointsMaterial({
    size: radius / 110, vertexColors: true, transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
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
  const effect = new AsciiEffect(viewer.renderer, ' .:-=+*#%@', { invert: true, resolution: 0.205 });
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
      color: 0xffb45e, n: 260, speed: 0.085,
      curve: curveFromPoints([[c.x, yLo, zBus], [c.x, (yLo + yHi) / 2, zBus], [c.x, yHi, zBus]]),
    },
    { // coolant — closed loop down one manifold, across, up the other
      key: 'coolant',
      tags: ['coldplate', 'tube', 'manifold'],
      color: 0x5fd4e8, n: 340, speed: 0.05,
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
      color: 0xc99cf0, n: 300, speed: 0.12,
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
      color: s.color, size: size.y / 90, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
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

const MODES = { points: pointsMode, exploded: explodedMode, ascii: asciiMode, ortho: orthoMode, flux: fluxMode };

export function createStageAdapter(modeId, env) {
  const fn = MODES[modeId];
  if (!fn) return null;
  try { return fn(env); } catch (e) { console.error('stage mode failed', modeId, e); return null; }
}
