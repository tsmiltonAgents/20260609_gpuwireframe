// wireframe.js — turn a group of tagged meshes into a clean technical wireframe.
//
// Strategy: for each mesh we (a) keep a near-black transparent fill so back
// lines are occluded (hidden-line look), and (b) overlay EdgesGeometry lines
// coloured by the mesh's subsystem tag. Toggling x-ray hides the fill so you
// can see every internal component at once — used by the scroll reveal.

import * as THREE from 'three';
import { TAG_COLORS } from './models.js';

const EDGE_ANGLE = 24; // degrees — only keep meaningful edges, not triangulation

export function tagColor(tag) {
  return TAG_COLORS[tag] != null ? TAG_COLORS[tag] : TAG_COLORS.default;
}

// Convert a freshly built model group in place. Returns a controller object.
export function wireify(root, opts = {}) {
  const fillColor = opts.fill != null ? opts.fill : 0x171b19;
  const lines = [];   // { line, tag, baseColor, fill }
  const byTag = {};

  root.traverse((obj) => {
    if (!obj.isMesh || obj.userData.__wired) return;
    obj.userData.__wired = true;

    // Fill material for occlusion
    const fill = new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0.94,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    obj.material = fill;

    // Edge overlay
    const tag = obj.userData.tag || 'default';
    const base = new THREE.Color(tagColor(tag)).offsetHSL(0, 0.02, 0.06);
    const edges = new THREE.EdgesGeometry(obj.geometry, EDGE_ANGLE);
    const lineMat = new THREE.LineBasicMaterial({
      color: base.clone(),
      transparent: true,
      opacity: 1.0,
    });
    const line = new THREE.LineSegments(edges, lineMat);
    line.userData.tag = tag;
    obj.add(line); // inherits transform from the mesh

    const rec = { line, mesh: obj, fill, tag, baseColor: base.clone(), mat: lineMat };
    lines.push(rec);
    (byTag[tag] = byTag[tag] || []).push(rec);
  });

  const ctrl = {
    root,
    lines,
    byTag,
    tags: Object.keys(byTag),

    // X-ray: hide/show occluding fills (reveals every internal component)
    setXray(on) {
      for (const r of lines) r.mesh.material.visible = !on;
    },

    // Dim everything except the given tags (used to spotlight a subsystem)
    highlight(tags) {
      const set = new Set(tags || []);
      for (const r of lines) {
        const on = set.size === 0 || set.has(r.tag);
        r.mat.color.copy(r.baseColor);
        r.mat.opacity = on ? 1.0 : 0.15;
      }
    },

    // Restore default look
    reset() {
      for (const r of lines) { r.mat.color.copy(r.baseColor); r.mat.opacity = 1.0; }
      this.setXray(false);
    },

    // Global line opacity (for fade-ins)
    setOpacity(o) {
      for (const r of lines) r.mat.opacity = o;
    },

    dispose() {
      for (const r of lines) { r.line.geometry.dispose(); r.mat.dispose(); r.fill.dispose(); }
    },
  };
  return ctrl;
}

// Wireify an arbitrary loaded GLB/GLTF scene (meshes have no subsystem tags).
// We colour by a rotating accent palette per mesh so structure stays readable.
export function wireifyLoaded(root, accent = 0x3df0ff) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.userData.tag = obj.userData.tag || 'default';
  });
  return wireify(root, { fill: 0x171b19 });
}
