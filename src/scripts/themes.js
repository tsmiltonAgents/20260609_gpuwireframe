// themes.js — theme registry + manager. CSS tokens live in themes.css as
// [data-theme="id"] blocks; this module holds what CSS can't reach: the 3D
// wireframe layer palettes, occlusion-fill and floor-grid colours, plus the
// apply/persist logic. Visual identity changes live: CSS swaps instantly and
// every wireframe viewer re-tints via the 'scc-theme' event.

export const THEME_KEY = 'scc-theme';
export const DEFAULT_THEME = 'amodo-dark';

// Tag list every palette must cover (see models.js TAG_COLORS)
export const TAGS = ['frame', 'chassis', 'rail', 'pcb', 'gpu', 'heatsink', 'coldplate',
  'tube', 'manifold', 'memory', 'cpu', 'power', 'busbar', 'fan', 'nic',
  'interconnect', 'cable', 'drive', 'connector', 'bezel', 'label', 'default'];

// Each theme: id, name, blurb, swatches (picker preview), dark, fill (3D
// occlusion fill), grid [major, minor], tags (3D layer palette).
export const THEMES = [
  {
    id: 'amodo-dark', name: 'Amodo Dark', blurb: 'House style — Plex, teal & terracotta',
    dark: true, swatches: ['#15201d', '#79bcba', '#d4654f'],
    fill: 0x171b19, grid: [0x2e332f, 0x232825],
    tags: {
      frame: 0x8a918b, chassis: 0x8a918b, rail: 0x757c76, pcb: 0x6f8a72,
      gpu: 0x79bcba, heatsink: 0xa2a89f, coldplate: 0x8fbcba, tube: 0x6fa3a1,
      manifold: 0x6fa3a1, memory: 0xa886a4, cpu: 0xc2a886, power: 0xc08a6e,
      busbar: 0xc4705f, fan: 0x969d97, nic: 0x9d8aa8, interconnect: 0x9d8aa8,
      cable: 0x94748f, drive: 0x84a98f, connector: 0xb9a07a, bezel: 0x8d948e,
      label: 0xa8aea8, default: 0x939a94,
    },
  },
  {
    id: 'blueprint', name: 'Blueprint', blurb: 'Cyanotype drawing office, white on cobalt',
    dark: true, swatches: ['#0c2d5c', '#e8f1ff', '#7fd4ff'],
    fill: 0x0a2750, grid: [0x29508c, 0x1d4076],
    tags: {
      frame: 0xdce9fb, chassis: 0xdce9fb, rail: 0xa9c4e8, pcb: 0x9fc6e8,
      gpu: 0xffffff, heatsink: 0xc2d8f2, coldplate: 0xaadcff, tube: 0x7fd4ff,
      manifold: 0x7fd4ff, memory: 0xc9d9ff, cpu: 0xffe9b8, power: 0xffd9a3,
      busbar: 0xffcf8a, fan: 0xb4cdee, nic: 0xc4c9ff, interconnect: 0xc4c9ff,
      cable: 0xaab6e8, drive: 0xa8e0d4, connector: 0xf2e3b8, bezel: 0xc6d8f0,
      label: 0xd8e6f8, default: 0xc4d6f0,
    },
  },
];

export function registerThemes(list) {
  for (const t of list) if (!THEMES.some((x) => x.id === t.id)) THEMES.push(t);
}

export function currentThemeId() {
  const saved = localStorage.getItem(THEME_KEY);
  return THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME;
}

export function currentTheme() {
  return THEMES.find((t) => t.id === currentThemeId()) || THEMES[0];
}

export function applyTheme(id, { persist = true } = {}) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  if (persist) localStorage.setItem(THEME_KEY, theme.id);
  window.dispatchEvent(new CustomEvent('scc-theme', { detail: theme }));
  return theme;
}

// Boot: make sure the attr matches storage (the inline head script already
// set it pre-paint; this keeps JS state consistent).
export function bootTheme() {
  return applyTheme(currentThemeId(), { persist: false });
}
