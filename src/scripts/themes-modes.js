// themes-modes.js — the "representation" theme pack: each entry pairs a
// visual identity with an abstract stage mode and a showcase model.
import { registerThemes } from './themes.js';

registerThemes([
  {
    id: 'stardust', name: 'Stardust', blurb: 'Particle cloud condenses as you scroll',
    dark: true, swatches: ['#0b0b14', '#cfd6ff', '#8fb8ff'],
    stageMode: 'points', model: 'gb200-nvl72',
    fill: 0x0b0b14, grid: [0x1c1c2e, 0x131322],
    tags: {
      frame: 0xaab2d0, chassis: 0xaab2d0, rail: 0x8890ae, pcb: 0x9fd0b8,
      gpu: 0xcfe2ff, heatsink: 0xb8c0d8, coldplate: 0xa8d8f0, tube: 0x8fc8e8,
      manifold: 0x8fc8e8, memory: 0xd0b8e8, cpu: 0xf0d8a8, power: 0xf0c890,
      busbar: 0xf8c878, fan: 0xa0a8c0, nic: 0xc8b8f0, interconnect: 0xc8b8f0,
      cable: 0xb0a0d8, drive: 0xa8d8c0, connector: 0xe8d0a0, bezel: 0xa8b0c8,
      label: 0xc8d0e8, default: 0xb0b8d0,
    },
  },
  {
    id: 'showroom', name: 'Showroom', blurb: 'Scroll-driven exploded teardown',
    dark: false, swatches: ['#f2f3f5', '#1d2433', '#2563eb'],
    stageMode: 'exploded', model: 'dgx-h100',
    fill: 0xe8eaee, grid: [0xd0d4dc, 0xdfe2e8],
    tags: {
      frame: 0x39414f, chassis: 0x39414f, rail: 0x5a6271, pcb: 0x4a7a5c,
      gpu: 0x2563eb, heatsink: 0x6b7383, coldplate: 0x3a8fb8, tube: 0x3a7a9a,
      manifold: 0x3a7a9a, memory: 0x7a55b8, cpu: 0xa87a3a, power: 0xb86a3a,
      busbar: 0xc05a2a, fan: 0x707887, nic: 0x6a55c0, interconnect: 0x6a55c0,
      cable: 0x8a55a0, drive: 0x3a8a6a, connector: 0xa8862a, bezel: 0x4a525f,
      label: 0x8a92a1, default: 0x5a6270,
    },
  },
  {
    id: 'teletype', name: 'Teletype', blurb: 'Live ASCII render, ink on ivory',
    dark: false, swatches: ['#efe9dc', '#232019', '#c43c2a'],
    stageMode: 'ascii', model: 'sxm5-module',
    fill: 0xe5dfd0, grid: [0xd0c9b8, 0xded8c8],
    tags: {
      frame: 0x232019, chassis: 0x232019, rail: 0x4a463c, pcb: 0x3a4a3a,
      gpu: 0xc43c2a, heatsink: 0x5a564a, coldplate: 0x3a5a6a, tube: 0x4a6a6a,
      manifold: 0x4a6a6a, memory: 0x6a3a5a, cpu: 0x7a5a2a, power: 0x8a4a2a,
      busbar: 0x9a3a1a, fan: 0x5a564c, nic: 0x4a3a6a, interconnect: 0x4a3a6a,
      cable: 0x5a3a52, drive: 0x3a5a4a, connector: 0x7a6230, bezel: 0x3a362c,
      label: 0x6a665a, default: 0x4a463a,
    },
  },
  {
    id: 'drafting', name: 'Drafting', blurb: 'Snapping elevations — front, side, plan',
    dark: true, swatches: ['#1c1f22', '#e8e4d8', '#d65a4a'],
    stageMode: 'ortho', model: 'nvl72-compute-tray',
    fill: 0x191c1f, grid: [0x32363a, 0x26292d],
    tags: {
      frame: 0xd8d4c8, chassis: 0xd8d4c8, rail: 0xa8a498, pcb: 0xb8c4a8,
      gpu: 0xf0ece0, heatsink: 0xc0bcb0, coldplate: 0xb8d0d8, tube: 0xa0c0c8,
      manifold: 0xa0c0c8, memory: 0xd0b8c8, cpu: 0xe0c8a0, power: 0xd65a4a,
      busbar: 0xd65a4a, fan: 0xb0aca0, nic: 0xc0b0d8, interconnect: 0xc0b0d8,
      cable: 0xb0a0c0, drive: 0xb0c8b0, connector: 0xd8c098, bezel: 0xc8c4b8,
      label: 0xe0dcd0, default: 0xc0bcb0,
    },
  },
  {
    id: 'flux', name: 'Flux', blurb: 'Telemetry streams through a ghost rack',
    dark: true, swatches: ['#06100f', '#5fd4e8', '#ffb45e'],
    stageMode: 'flux', model: 'gb200-nvl72',
    fill: 0x081210, grid: [0x16302c, 0x0e211e],
    tags: {
      frame: 0x3d5a55, chassis: 0x3d5a55, rail: 0x324a46, pcb: 0x3a5a4a,
      gpu: 0x5a8a86, heatsink: 0x46625d, coldplate: 0x4a7a82, tube: 0x44707a,
      manifold: 0x44707a, memory: 0x5a4a6a, cpu: 0x6a5a42, power: 0x7a5a3a,
      busbar: 0x8a5a32, fan: 0x425853, nic: 0x564a72, interconnect: 0x564a72,
      cable: 0x4e4262, drive: 0x3e6252, connector: 0x6a5a3e, bezel: 0x3a524d,
      label: 0x4e6a64, default: 0x425a55,
    },
  },
]);
