// gallery.js — the "choice demo": render every model option as an interactive
// wireframe card so you can compare and pick one. Includes a per-card x-ray
// toggle, global subsystem highlight, a drop-in GLB/GLTF loader, and a
// drag-to-rotate hint on every canvas.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODELS, build, TAG_COLORS } from './models.js';
import { wireifyLoaded, wireify } from './wireframe.js';
import { Viewer } from './viewer.js';
import { attachDragHint } from './drag-hint.js';
import { mountThemePicker } from './theme-picker.js';

mountThemePicker();

const BASE = ((document.body.dataset.base || '/').replace(/\/+$/, '')) + '/';

const LEGEND = [
  ['gpu', 'GPU / accelerator'], ['memory', 'HBM / DIMM'], ['heatsink', 'Air heatsink'],
  ['coldplate', 'Cold plate'], ['tube', 'Coolant loop'], ['cpu', 'CPU'],
  ['power', 'Power / VRM'], ['nic', 'Fabric / NIC'], ['drive', 'NVMe'],
  ['pcb', 'PCB'], ['frame', 'Chassis'], ['fan', 'Fan'],
  ['busbar', 'Busbar'], ['cable', 'Cable cartridge'], ['connector', 'Connectors'],
];

const cards = []; // { ctrl, viewer, el }
const grid = document.getElementById('grid');
const chosenKey = 'scc-chosen';

function specList(specs) {
  return specs.map((s) => `<li>${s}</li>`).join('');
}

function makeCard(info, builder) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.id = info.id;
  el.innerHTML = `
    <span class="badge tag">${info.format || 'procedural'}</span>
    <span class="fmt">${info.id}</span>
    <span class="picked-flag">✓ Picked</span>
    <div class="stage"><canvas></canvas></div>
    <div class="meta">
      <h3>${info.name}</h3>
      <div class="tl">${info.tagline}</div>
      ${info.dims ? `<div class="dims">${info.dims}</div>` : ''}
      <ul class="specs">${specList(info.specs)}</ul>
      <div class="actions">
        <button class="btn act-xray">X-ray</button>
        <button class="btn act-spin on">Spin</button>
        <button class="btn act-choose">Pick</button>
      </div>
    </div>`;
  grid.appendChild(el);

  const canvas = el.querySelector('canvas');
  const viewer = new Viewer(canvas, { autoRotate: true, autoRotateSpeed: 0.5, bloom: false });
  const ctrl = builder();
  viewer.setModel(ctrl);
  attachDragHint(el.querySelector('.stage'), canvas);

  const rec = { info, ctrl, viewer, el, xray: false };
  cards.push(rec);

  el.querySelector('.act-xray').addEventListener('click', (e) => {
    rec.xray = !rec.xray; ctrl.setXray(rec.xray); e.target.classList.toggle('on', rec.xray);
  });
  el.querySelector('.act-spin').addEventListener('click', (e) => {
    viewer.controls.autoRotate = !viewer.controls.autoRotate;
    e.target.classList.toggle('on', viewer.controls.autoRotate);
  });
  el.querySelector('.act-choose').addEventListener('click', () => choose(info.id));
  return rec;
}

function choose(id) {
  localStorage.setItem(chosenKey, id);
  for (const c of cards) c.el.classList.toggle('chosen', c.info.id === id);
  const banner = document.getElementById('chosen-banner');
  const m = MODELS.find((x) => x.id === id) || cards.find((c) => c.info.id === id)?.info;
  banner.innerHTML = `Dev model: <b>${m ? m.name : id}</b> — ` +
    `<a href="${BASE}?model=${encodeURIComponent(id)}">view it on the landing page →</a>`;
  banner.style.display = 'block';
}

// ---- global controls -------------------------------------------------------
function setAllXray(on) {
  for (const c of cards) { c.xray = on; c.ctrl.setXray(on); c.el.querySelector('.act-xray').classList.toggle('on', on); }
}
function highlightTag(tag) {
  for (const c of cards) c.ctrl.highlight(tag ? [tag] : []);
}

// ---- drop-in GLB / GLTF loader --------------------------------------------
const loader = new GLTFLoader();
function addLoadedModel(scene, name, format) {
  const ctrl = wireifyLoaded(scene);
  const info = {
    id: 'loaded-' + name.replace(/\W+/g, '-').toLowerCase(),
    name, tagline: 'Imported CAD model', format,
    specs: ['Imported geometry', 'Auto-wireframed', 'Drag to orbit', 'Toggle x-ray'],
  };
  makeCard(info, () => ctrl);
}

function wireUpLoader() {
  const input = document.getElementById('glb-input');
  input.addEventListener('change', (ev) => {
    for (const file of ev.target.files) {
      const url = URL.createObjectURL(file);
      loader.load(url, (gltf) => {
        addLoadedModel(gltf.scene, file.name, file.name.split('.').pop().toUpperCase());
        URL.revokeObjectURL(url);
      }, undefined, (err) => { console.error(err); alert('Could not load ' + file.name); });
    }
  });
}

// ---- optional manifest of files already sitting in /public/models ---------
async function loadManifest() {
  try {
    const res = await fetch(BASE + 'models/manifest.json', { cache: 'no-store' });
    if (!res.ok) return;
    const list = await res.json();
    for (const entry of list) {
      const url = BASE + 'models/' + entry.file;
      loader.load(url, (gltf) => {
        addLoadedModel(gltf.scene, entry.name || entry.file, (entry.file.split('.').pop() || '').toUpperCase());
      }, undefined, (e) => console.warn('manifest load failed', entry, e));
    }
  } catch (_) { /* no manifest — fine */ }
}

function buildLegend() {
  const wrap = document.getElementById('legend');
  wrap.innerHTML = LEGEND.map(([tag, label]) => {
    const c = '#' + (TAG_COLORS[tag] || 0x6fa8c0).toString(16).padStart(6, '0');
    return `<span class="sw" data-tag="${tag}"><span class="dot" style="color:${c};background:${c}"></span>${label}</span>`;
  }).join('') + '<span class="sw" data-tag=""><span class="dot" style="color:#fff;background:#fff"></span>show all</span>';
  wrap.querySelectorAll('.sw').forEach((sw) => {
    sw.style.cursor = 'pointer';
    sw.addEventListener('mouseenter', () => highlightTag(sw.dataset.tag || null));
  });
  wrap.addEventListener('mouseleave', () => highlightTag(null));
}

// ---- boot ------------------------------------------------------------------
function boot() {
  for (const info of MODELS) {
    makeCard(info, () => wireify(build(info.id).group));
  }
  buildLegend();
  wireUpLoader();
  loadManifest();

  document.getElementById('xray-all').addEventListener('click', (e) => {
    const on = !e.target.classList.contains('on'); e.target.classList.toggle('on', on); setAllXray(on);
  });

  const prev = localStorage.getItem(chosenKey);
  if (prev) choose(prev);
}
boot();
