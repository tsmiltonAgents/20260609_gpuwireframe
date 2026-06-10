// theme-picker.js — floating bottom-right control to flip the whole site
// between design systems, plus edge arrows for prev/next browsing and a
// shortlist (starred designs persisted in localStorage).

import { THEMES, currentThemeId, applyTheme, bootTheme } from './themes.js';
import './themes-extra.js'; // registers the agent-designed themes
import './themes-modes.js'; // representation-mode themes (points/exploded/ascii/ortho/flux)
import './themes-families.js'; // Brutalist + Acid Lab families x experimental modes
import './themes-vibes.js'; // pure-vibe stages (scope/thermal/console/survey/observatory)

const SHORTLIST_KEY = 'scc-shortlist';

function getShortlist() {
  try { return JSON.parse(localStorage.getItem(SHORTLIST_KEY)) || []; } catch (_) { return []; }
}
function setShortlist(list) {
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(list));
}
function toggleShortlist(id) {
  const list = getShortlist();
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  setShortlist(list);
  return list;
}

export function mountThemePicker() {
  bootTheme();

  // #channels (and #<themeId> / ?theme=) deep-links
  window.addEventListener('hashchange', () => {
    const alias = { channels: 'brutal-multi', channels2: 'brutal-multi2', '3': 'brutal-multi3', channels3: 'brutal-multi3' };
    const h = location.hash.replace('#', '');
    const id = alias[h] || h;
    if (id && THEMES.some((t) => t.id === id) && id !== currentThemeId()) {
      applyTheme(id);
      location.reload();
    }
  });

  const root = document.createElement('div');
  root.className = 'theme-picker';
  root.innerHTML = `
    <button class="tp-star" title="Add to shortlist" aria-label="Shortlist this design"></button>
    <button class="tp-toggle" title="Switch design (t)" aria-label="Switch design">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3 a9 9 0 0 1 0 18" fill="currentColor" stroke="none" opacity="0.45"/>
        <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/>
      </svg>
    </button>
    <div class="tp-panel">
      <div class="tp-head">
        <span>Design system</span>
        <button class="tp-filter" title="Show shortlist only">★ <i>0</i></button>
      </div>
      <div class="tp-list"></div>
    </div>`;
  document.body.appendChild(root);

  // edge arrows
  const arrows = document.createElement('div');
  arrows.innerHTML = `
    <button class="theme-arrow left" title="Previous design (←)" aria-label="Previous design">‹</button>
    <button class="theme-arrow right" title="Next design (→)" aria-label="Next design">›</button>
    <div class="theme-toast" aria-live="polite"></div>`;
  while (arrows.firstChild) document.body.appendChild(arrows.firstChild);
  const toast = document.querySelector('.theme-toast');

  const list = root.querySelector('.tp-list');
  const toggle = root.querySelector('.tp-toggle');
  const star = root.querySelector('.tp-star');
  const filterBtn = root.querySelector('.tp-filter');
  let filterOn = false;
  let toastTimer = null;

  function showToast(theme) {
    const starred = getShortlist().includes(theme.id);
    toast.innerHTML = `<b>${theme.name}</b> <span>${theme.blurb}</span>${starred ? ' <em>★</em>' : ''}`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function render() {
    const cur = currentThemeId();
    const sl = getShortlist();
    filterBtn.querySelector('i').textContent = sl.length;
    filterBtn.classList.toggle('on', filterOn);
    star.textContent = sl.includes(cur) ? '★' : '☆';
    star.classList.toggle('on', sl.includes(cur));
    const items = filterOn ? THEMES.filter((t) => sl.includes(t.id)) : THEMES;
    list.innerHTML = items.map((t) => `
      <button class="tp-item ${t.id === cur ? 'cur' : ''}" data-id="${t.id}">
        <span class="tp-sw">${t.swatches.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="tp-name">${t.name}${sl.includes(t.id) ? ' <em class="tp-fav">★</em>' : ''}</span>
        <span class="tp-blurb">${t.blurb}</span>
      </button>`).join('') ||
      '<div class="tp-empty">No shortlisted designs yet — hit ☆ on ones you like.</div>';
  }
  render();

  function step(dir) {
    const ids = THEMES.map((t) => t.id);
    const next = ids[(ids.indexOf(currentThemeId()) + dir + ids.length) % ids.length];
    const theme = applyTheme(next);
    render();
    showToast(theme);
  }

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.tp-item');
    if (!item) return;
    showToast(applyTheme(item.dataset.id));
    render();
  });
  toggle.addEventListener('click', () => root.classList.toggle('open'));
  star.addEventListener('click', () => { toggleShortlist(currentThemeId()); render(); });
  filterBtn.addEventListener('click', (e) => { e.stopPropagation(); filterOn = !filterOn; render(); });
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) root.classList.remove('open');
  });
  document.querySelector('.theme-arrow.left').addEventListener('click', () => step(-1));
  document.querySelector('.theme-arrow.right').addEventListener('click', () => step(1));

  document.addEventListener('keydown', (e) => {
    if (/input|select|textarea/i.test(document.activeElement.tagName)) return;
    if (e.key === 't') step(1);
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 's') { toggleShortlist(currentThemeId()); render(); showToast(THEMES.find((t) => t.id === currentThemeId())); }
  });
  return root;
}
