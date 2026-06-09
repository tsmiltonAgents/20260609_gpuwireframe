// theme-picker.js — floating bottom-right control to flip the whole site
// between design systems. Builds its own DOM, persists choice, applies live.

import { THEMES, currentThemeId, applyTheme, bootTheme } from './themes.js';
import './themes-extra.js'; // registers the agent-designed themes

export function mountThemePicker() {
  bootTheme();

  const root = document.createElement('div');
  root.className = 'theme-picker';
  root.innerHTML = `
    <button class="tp-toggle" title="Switch design (t)" aria-label="Switch design">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3 a9 9 0 0 1 0 18" fill="currentColor" stroke="none" opacity="0.45"/>
        <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/>
      </svg>
    </button>
    <div class="tp-panel">
      <div class="tp-head">Design system <span>${THEMES.length} variants</span></div>
      <div class="tp-list"></div>
    </div>`;
  document.body.appendChild(root);

  const list = root.querySelector('.tp-list');
  const toggle = root.querySelector('.tp-toggle');

  function render() {
    const cur = currentThemeId();
    list.innerHTML = THEMES.map((t) => `
      <button class="tp-item ${t.id === cur ? 'cur' : ''}" data-id="${t.id}">
        <span class="tp-sw">${t.swatches.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="tp-name">${t.name}</span>
        <span class="tp-blurb">${t.blurb}</span>
      </button>`).join('');
  }
  render();

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.tp-item');
    if (!item) return;
    applyTheme(item.dataset.id);
    render();
  });
  toggle.addEventListener('click', () => root.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) root.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 't' && !/input|select|textarea/i.test(document.activeElement.tagName)) {
      // quick-cycle to the next theme
      const ids = THEMES.map((t) => t.id);
      const next = ids[(ids.indexOf(currentThemeId()) + 1) % ids.length];
      applyTheme(next);
      render();
    }
  });
  return root;
}
