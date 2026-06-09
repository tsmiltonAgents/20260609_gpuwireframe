// scroll-site.js — the landing page. The right column is pinned: during the
// hero it shows the access-request card; from the explainer down, the picked
// dev-model wireframe fades in and scroll drives rotation + subsystem x-ray.

import * as THREE from 'three';
import { build, MODELS } from './models.js';
import { wireify } from './wireframe.js';
import { Viewer } from './viewer.js';
import { attachDragHint } from './drag-hint.js';
import { mountThemePicker } from './theme-picker.js';
import { currentTheme } from './themes.js';
import { createStageAdapter } from './stage-modes.js';

mountThemePicker();
const theme = currentTheme();

// Which model? ?model=<id> wins, then the theme's showcase model, then the
// model picked in the Dev Model Picker.
const params = new URLSearchParams(location.search);
const picked = localStorage.getItem('scc-chosen');
const chosen = params.get('model') || theme.model || picked || 'gb200-nvl72';
const modelId = MODELS.some((m) => m.id === chosen) ? chosen : 'gb200-nvl72';

const stage = document.getElementById('stage');
const canvas = document.getElementById('stage-canvas');
const viewer = new Viewer(canvas, { autoRotate: false, bloom: false, floor: true, autoPause: false });
let ctrl = wireify(build(modelId).group);
viewer.setModel(ctrl);
attachDragHint(stage, canvas);

// Abstract representation mode (per-theme): points / exploded / ascii / ortho / flux
const activeMode = theme.stageMode || 'wire';
const adapter = createStageAdapter(activeMode, { viewer, ctrl, stage });

// Mode and showcase-model changes need a fresh scene graph — reload for those.
window.addEventListener('scc-theme', (e) => {
  const t = e.detail;
  const nextModel = params.get('model') || t.model || picked || 'gb200-nvl72';
  if ((t.stageMode || 'wire') !== activeMode || nextModel !== modelId) location.reload();
});

// Model name + dims into the readout; flag it when it came from the picker
const modelInfo = MODELS.find((m) => m.id === modelId) || {};
document.querySelectorAll('[data-model-name]').forEach((el) => {
  el.textContent = (modelInfo.name || modelId) + (picked === modelId ? ' ✓ picked' : '');
});
document.querySelectorAll('[data-model-dims]').forEach((el) => {
  el.textContent = modelInfo.dims || '—';
});

// --- access form ------------------------------------------------------------
const accessCard = document.getElementById('access-card');
const accessForm = document.getElementById('access-form');
if (accessForm) {
  accessForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(accessForm));
    data.model = modelId;
    data.at = new Date().toISOString();
    localStorage.setItem('scc-access-request', JSON.stringify(data));
    accessCard.classList.add('done');
  });
  // returning visitor who already registered
  if (localStorage.getItem('scc-access-request')) accessCard.classList.add('done');
}

// --- scroll-driven state ----------------------------------------------------
const sections = Array.from(document.querySelectorAll('.section'));
let targetRotY = 0, curRotY = 0;
let lastTagKey = '__init', lastXray = null, lastMode = '__init';
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
  targetRotY = p * Math.PI * 2.6;
  document.getElementById('progress').style.width = (p * 100) + '%';

  const sec = activeSection();
  const mode = sec.dataset.stage || 'model';        // 'form' | 'hidden' | 'model'
  if (mode !== lastMode) {
    stage.classList.toggle('stage-dim', mode !== 'model');
    if (accessCard) accessCard.classList.toggle('show', mode === 'form');
    lastMode = mode;
  }

  const tags = (sec.dataset.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  const xray = sec.dataset.xray === 'true';

  const key = tags.join('|');
  if (key !== lastTagKey || xray !== lastXray) {
    if (!(adapter && adapter.handlesHighlight)) {
      if (key !== lastTagKey) ctrl.highlight(tags);
      if (xray !== lastXray) ctrl.setXray(xray);
    }
    if (adapter && adapter.onScroll) adapter.onScroll(p, tags, xray);
    lastTagKey = key; lastXray = xray;
  } else if (adapter && adapter.onScroll) {
    adapter.onScroll(p, tags, xray);
  }

  document.getElementById('ro-sub').textContent = tags.length ? tags.join(' · ') : 'all';
  document.getElementById('ro-mode').textContent = xray ? 'X-RAY' : 'ASSEMBLY';
  document.getElementById('ro-pct').textContent = Math.round(p * 100) + '%';
}

// gentle constant drift + scroll-driven target, lerped each frame.
// While the user is actively dragging, hand full control to OrbitControls.
viewer.onFrame = () => {
  if (adapter && adapter.onFrame) adapter.onFrame();
  if (userDragging) return;
  if (!(adapter && adapter.noRotate)) {
    curRotY += (targetRotY - curRotY) * 0.06;
    viewer.modelRoot.rotation.y = curRotY + performance.now() * 0.00004;
  }
};

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();
