// explorer.js — thumbnail wall of every design system. Click applies the
// theme and opens the landing page; star toggles the shortlist.

import { THEMES, currentThemeId, applyTheme } from './themes.js';
import './themes-extra.js';
import './themes-modes.js';
import './themes-families.js';
import './themes-vibes.js';
import { mountThemePicker } from './theme-picker.js';

mountThemePicker();

const BASE = ((document.body.dataset.base || '/').replace(/\/+$/, '')) + '/';
const SHORTLIST_KEY = 'scc-shortlist';
const grid = document.getElementById('ex-grid');
const filterBtn = document.getElementById('ex-filter');
let filterOn = false;

function shortlist() {
  try { return JSON.parse(localStorage.getItem(SHORTLIST_KEY)) || []; } catch (_) { return []; }
}

function modeLabel(t) {
  const m = t.stageMode || 'wire';
  const names = { wire: 'wireframe', points: 'particles', exploded: 'teardown', ascii: 'ascii',
    ortho: 'elevations', flux: 'streams', voxel: 'voxels', stamp: 'screen-print',
    glitch: 'glitch', slices: 'tomography', scope: 'oscilloscope', heatfield: 'thermal field',
    logstream: 'live log', topo: 'contours', orbital: 'constellation' };
  return names[m] || m;
}

function render() {
  const sl = shortlist();
  const cur = currentThemeId();
  document.getElementById('ex-count').textContent = THEMES.length;
  document.getElementById('ex-sl-count').textContent = sl.length ? `${sl.length} shortlisted` : 'nothing shortlisted yet';
  filterBtn.classList.toggle('on', filterOn);
  const items = filterOn ? THEMES.filter((t) => sl.includes(t.id)) : THEMES;
  grid.innerHTML = items.map((t) => `
    <div class="ex-card ${t.id === cur ? 'cur' : ''}" data-id="${t.id}">
      <button class="ex-star ${sl.includes(t.id) ? 'on' : ''}" title="Shortlist">${sl.includes(t.id) ? '★' : '☆'}</button>
      <a class="ex-thumb" href="${BASE}" data-id="${t.id}">
        <img src="${BASE}thumbs/${t.id}.jpg" alt="${t.name} design preview" loading="lazy" />
        ${t.id === cur ? '<span class="ex-current">current</span>' : ''}
      </a>
      <div class="ex-meta">
        <span class="ex-sw">${t.swatches.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <div>
          <div class="ex-name">${t.name}</div>
          <div class="ex-blurb">${t.blurb}</div>
        </div>
        <span class="ex-mode">${modeLabel(t)}</span>
      </div>
    </div>`).join('') ||
    '<div class="tp-empty">No shortlisted designs yet — star some from the cards.</div>';
}
render();

grid.addEventListener('click', (e) => {
  const star = e.target.closest('.ex-star');
  if (star) {
    e.preventDefault();
    const id = star.closest('.ex-card').dataset.id;
    const sl = shortlist();
    const i = sl.indexOf(id);
    if (i >= 0) sl.splice(i, 1); else sl.push(id);
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(sl));
    render();
    return;
  }
  const thumb = e.target.closest('.ex-thumb');
  if (thumb) {
    // set theme, let the link navigate to the landing page
    applyTheme(thumb.dataset.id);
  }
});

filterBtn.addEventListener('click', () => { filterOn = !filterOn; render(); });
window.addEventListener('scc-theme', render);
