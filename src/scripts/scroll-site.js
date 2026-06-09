// scroll-site.js — the landing prototype. A wireframe model is pinned on the
// right; copy scrolls on the left. Scroll position drives model rotation, and
// each section spotlights a subsystem (and toggles x-ray to reveal internals).
// The user can also grab the model and orbit it directly (OrbitControls).

import * as THREE from 'three';
import { build, MODELS } from './models.js';
import { wireify } from './wireframe.js';
import { Viewer } from './viewer.js';
import { attachDragHint } from './drag-hint.js';

// Which model? ?model=<id>, else last chosen in the gallery, else default.
const params = new URLSearchParams(location.search);
const chosen = params.get('model') || localStorage.getItem('scc-chosen') || 'hgx-tray';
const modelId = MODELS.some((m) => m.id === chosen) ? chosen : 'hgx-tray';

const canvas = document.getElementById('stage-canvas');
const stage = document.querySelector('.scroll-stage');
const viewer = new Viewer(canvas, { autoRotate: false, bloom: true, floor: true, autoPause: false });
let ctrl = wireify(build(modelId).group);
viewer.setModel(ctrl);
attachDragHint(stage, canvas);

// Put the model name into the hero + readout
document.querySelectorAll('[data-model-name]').forEach((el) => {
  el.textContent = (MODELS.find((m) => m.id === modelId) || {}).name || modelId;
});

// --- scroll-driven state ----------------------------------------------------
const sections = Array.from(document.querySelectorAll('.section'));
let targetRotY = 0, curRotY = 0;
let lastTagKey = '__init', lastXray = null;
let userDragging = false;
canvas.addEventListener('pointerdown', () => { userDragging = true; });
canvas.addEventListener('pointerup', () => { userDragging = false; });

function activeSection() {
  const mid = window.innerHeight / 2;
  let best = sections[0], bestD = Infinity;
  for (const s of sections) {
    const r = s.getBoundingClientRect();
    const d = Math.abs((r.top + r.bottom) / 2 - mid);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function pageProgress() {
  const max = document.body.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

function onScroll() {
  const p = pageProgress();
  targetRotY = p * Math.PI * 2.6;                 // a few turns over the page
  document.getElementById('progress').style.width = (p * 100) + '%';

  const sec = activeSection();
  const tags = (sec.dataset.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  const xray = sec.dataset.xray === 'true';

  const key = tags.join('|');
  if (key !== lastTagKey) { ctrl.highlight(tags); lastTagKey = key; }
  if (xray !== lastXray) { ctrl.setXray(xray); lastXray = xray; }

  // readout HUD
  document.getElementById('ro-sub').textContent = tags.length ? tags.join(' · ') : 'all subsystems';
  document.getElementById('ro-mode').textContent = xray ? 'X-RAY' : 'SOLID';
  document.getElementById('ro-pct').textContent = Math.round(p * 100) + '%';
}

// gentle constant drift + scroll-driven target, lerped each frame.
// While the user is actively dragging, hand full control to OrbitControls.
viewer.onFrame = () => {
  if (userDragging) return;
  curRotY += (targetRotY - curRotY) * 0.06;
  viewer.modelRoot.rotation.y = curRotY + performance.now() * 0.00004;
};

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();
