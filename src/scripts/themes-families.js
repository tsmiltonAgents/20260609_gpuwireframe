// themes-families.js — the Brutalist and Acid Lab families: each base vibe
// crossed with five experimental representations.
import { registerThemes } from './themes.js';

// Shared 3D palettes ---------------------------------------------------------
const BRUTAL_TAGS = {
  frame: 0x111111, chassis: 0x111111, rail: 0x3a3a3a, pcb: 0x2a2a2a,
  gpu: 0xeac800, heatsink: 0x6e6e6e, coldplate: 0x4a4a4a, tube: 0x3a3a3a,
  manifold: 0x3a3a3a, memory: 0x222222, cpu: 0x111111, power: 0xeac800,
  busbar: 0xd4b400, fan: 0x7a7a7a, nic: 0x2e2e2e, interconnect: 0x2e2e2e,
  cable: 0x444444, drive: 0x383838, connector: 0x9a8a00, bezel: 0x1a1a1a,
  label: 0x8a8a8a, default: 0x2a2a2a,
};
const ACID_TAGS = {
  frame: 0x1c2024, chassis: 0x1c2024, rail: 0x4a5258, pcb: 0x3a4a3e,
  gpu: 0x6a00ff, heatsink: 0x5a626a, coldplate: 0x00a890, tube: 0x009880,
  manifold: 0x009880, memory: 0x8a3aff, cpu: 0x9a6a00, power: 0xff7a00,
  busbar: 0xff5a00, fan: 0x6a7278, nic: 0xb800c8, interconnect: 0xb800c8,
  cable: 0x8a00a8, drive: 0x00a86a, connector: 0xc89a00, bezel: 0x2c3236,
  label: 0x7a828a, default: 0x3a4248,
};
const ACID_DARK_TAGS = {
  frame: 0x9aa6a0, chassis: 0x9aa6a0, rail: 0x7a8680, pcb: 0x8ab890,
  gpu: 0xb48cff, heatsink: 0x8a968e, coldplate: 0x4de8c0, tube: 0x44d0ac,
  manifold: 0x44d0ac, memory: 0xc8a0ff, cpu: 0xe8c878, power: 0xffb45e,
  busbar: 0xff9a3e, fan: 0x8a968e, nic: 0xe070f0, interconnect: 0xe070f0,
  cable: 0xc060d0, drive: 0x6ae8a0, connector: 0xe8c878, bezel: 0x8a9690,
  label: 0xaab6b0, default: 0x96a29c,
};
const BRUTAL_BASE = {
  dark: false, fill: 0xf4f4f4, grid: [0xdedede, 0xececec], tags: BRUTAL_TAGS,
};
const ACID_BASE = {
  dark: false, fill: 0xdfe2dd, grid: [0xc8ccc4, 0xd6dad2], tags: ACID_TAGS,
};

registerThemes([
  // ---- Brutalist family ----------------------------------------------------
  {
    ...BRUTAL_BASE, id: 'brutal-blocks', name: 'Blocks', blurb: 'The rack as stacked concrete voxels',
    swatches: ['#ffffff', '#0a0a0a', '#ffe600'],
    stageMode: 'voxel', model: 'gb200-nvl72', voxel: { div: 50 },
  },
  {
    ...BRUTAL_BASE, id: 'brutal-stamp', name: 'Stamp', blurb: 'Flat screen-print poster fills',
    swatches: ['#ffffff', '#0a0a0a', '#ffe600'],
    stageMode: 'stamp', model: 'dgx-h100',
    stamp: { accent: 0xffe600, dark: 0x0a0a0a, mid: 0x8e8e8e,
      accentTags: ['gpu', 'power', 'busbar'], midTags: ['heatsink', 'fan', 'drive', 'label', 'bezel'] },
    fill: 0x0a0a0a,
  },
  {
    ...BRUTAL_BASE, id: 'brutal-type', name: 'Type', blurb: 'Whole rack as crushing ASCII',
    swatches: ['#ffffff', '#0a0a0a', '#ffe600'],
    stageMode: 'ascii', model: 'h100-rack', ascii: { resolution: 0.14, charset: ' .#@' },
  },
  {
    ...BRUTAL_BASE, id: 'brutal-tear', name: 'Tearsheet', blurb: 'Hard-shadow teardown, parts apart',
    swatches: ['#ffffff', '#0a0a0a', '#ffe600'],
    stageMode: 'exploded', model: 'pcie-4u',
  },
  {
    ...BRUTAL_BASE, id: 'brutal-spec', name: 'Spec', blurb: 'Black-ink elevations, massive numerals',
    swatches: ['#ffffff', '#0a0a0a', '#e3342f'],
    stageMode: 'ortho', model: 'nvl72-compute-tray',
  },

  {
    ...BRUTAL_BASE, id: 'brutal-multi', name: 'Channels', blurb: 'FLIR, terminal, contours — per section',
    swatches: ['#ffffff', '#0a0a0a', '#e3342f'],
    stageMode: 'channels', model: 'gb200-nvl72',
    multi: {
      default: 'topo',
      map: [
        // order matters: first match wins. Tags mirror each section's topic.
        { tags: ['power', 'busbar'], mode: 'scope' },        // power: DC-bus trace
        { tags: ['nic', 'interconnect'], mode: 'logstream' }, // network TAPs: packet feed
        { tags: ['memory', 'gpu'], mode: 'emanate' },        // SDR / EM: waves off the rack
        { tags: ['cpu', 'pcb', 'drive'], mode: 'voxel' },     // bare metal: the machine
        { tags: ['connector', 'cable'], mode: 'flux' },       // reconfigurable: data through inserted HW
      ],
    },
    topo: { ink: 0x0a0a0a, paper: 0xffffff, mark: 0xe3342f },
    scope: { trace: 0x0a0a0a, trace2: 0xe3342f, grid: 0xd6d6d6 },
    emanate: { color: 0xe3342f, rackOpacity: 0.42 },
    flux: { power: 0xb88a00, coolant: 0x00657a, fabric: 0x5a00b8 },
    voxel: { div: 50 },
  },

  {
    id: 'brutal-multi2', name: 'Channels 2', blurb: 'Channels in the Amodo extended palette',
    dark: false, swatches: ['#ffffff', '#CA4F3E', '#314492'],
    stageMode: 'channels', model: 'gb200-nvl72',
    fill: 0xf6f6f6, grid: [0xdedede, 0xececec],
    tags: {
      frame: 0x4d4d4d, chassis: 0x4d4d4d, rail: 0x6a6a6a, pcb: 0x79bcba,
      gpu: 0xca4f3e, heatsink: 0x79bcba, coldplate: 0x4d9fb1, tube: 0x4d9fb1,
      manifold: 0x4d9fb1, memory: 0x6a3866, cpu: 0x924157, power: 0x924157,
      busbar: 0xca4f3e, fan: 0x6a6a6a, nic: 0x314492, interconnect: 0x314492,
      cable: 0x403577, drive: 0x3984c2, connector: 0x3984c2, bezel: 0x5a5a5a,
      label: 0x7a7a7a, default: 0x5a5a5a,
    },
    multi: {
      default: 'topo',
      map: [
        { tags: ['power', 'busbar'], mode: 'scope' },
        { tags: ['nic', 'interconnect'], mode: 'logstream' },
        { tags: ['memory', 'gpu'], mode: 'emanate' },
        { tags: ['cpu', 'pcb', 'drive'], mode: 'voxel' },
        { tags: ['connector', 'cable'], mode: 'rotate' },
      ],
    },
    topo: { ink: 0x4d4d4d, paper: 0xffffff, mark: 0xca4f3e },
    scope: { trace: 0x314492, trace2: 0xca4f3e, grid: 0xdcdcdc },
    flux: { power: 0x924157, coolant: 0x4d9fb1, fabric: 0x6a3866 },
    emanate: { color: 0x3984c2, rackOpacity: 0.42 },
    voxel: { div: 50 },
  },

  {
    id: 'brutal-multi3', name: 'Channels 3', blurb: 'Rack close-up right, title + form left',
    dark: false, swatches: ['#ffffff', '#CA4F3E', '#314492'],
    stageMode: 'channels', model: 'gb200-nvl72', heroFrame: 1.1, heroRotY: -1.4,
    fill: 0xf6f6f6, grid: [0xdedede, 0xececec],
    tags: {
      frame: 0x4d4d4d, chassis: 0x4d4d4d, rail: 0x6a6a6a, pcb: 0x79bcba,
      gpu: 0xca4f3e, heatsink: 0x79bcba, coldplate: 0x4d9fb1, tube: 0x4d9fb1,
      manifold: 0x4d9fb1, memory: 0x6a3866, cpu: 0x924157, power: 0x924157,
      busbar: 0xca4f3e, fan: 0x6a6a6a, nic: 0x314492, interconnect: 0x314492,
      cable: 0x403577, drive: 0x3984c2, connector: 0x3984c2, bezel: 0x5a5a5a,
      label: 0x7a7a7a, default: 0x5a5a5a,
    },
    topo: { ink: 0x4d4d4d, paper: 0xffffff, mark: 0xca4f3e },
    scope: { trace: 0x314492, trace2: 0xca4f3e, grid: 0xdcdcdc },
    flux: { power: 0x924157, coolant: 0x4d9fb1, fabric: 0x6a3866 },
    emanate: { color: 0x3984c2, rackOpacity: 0.42 },
    voxel: { div: 50 },
  },

  {
    id: 'brutal-multi4', name: 'Channels 4', blurb: 'Compact form over the rack, classic copy',
    dark: false, swatches: ['#ffffff', '#CA4F3E', '#314492'],
    stageMode: 'channels', model: 'gb200-nvl72', heroFrame: 1.1, heroRotY: -1.4,
    fill: 0xf6f6f6, grid: [0xdedede, 0xececec],
    tags: {
      frame: 0x4d4d4d, chassis: 0x4d4d4d, rail: 0x6a6a6a, pcb: 0x79bcba,
      gpu: 0xca4f3e, heatsink: 0x79bcba, coldplate: 0x4d9fb1, tube: 0x4d9fb1,
      manifold: 0x4d9fb1, memory: 0x6a3866, cpu: 0x924157, power: 0x924157,
      busbar: 0xca4f3e, fan: 0x6a6a6a, nic: 0x314492, interconnect: 0x314492,
      cable: 0x403577, drive: 0x3984c2, connector: 0x3984c2, bezel: 0x5a5a5a,
      label: 0x7a7a7a, default: 0x5a5a5a,
    },
    topo: { ink: 0x4d4d4d, paper: 0xffffff, mark: 0xca4f3e },
    scope: { trace: 0x314492, trace2: 0xca4f3e, grid: 0xdcdcdc },
    flux: { power: 0x924157, coolant: 0x4d9fb1, fabric: 0x6a3866 },
    emanate: { color: 0x3984c2, rackOpacity: 0.42 },
    voxel: { div: 50 },
  },

  // ---- Acid Lab family -----------------------------------------------------
  {
    ...ACID_BASE, id: 'acid-reagent', name: 'Reagent', blurb: 'UV particle suspension, condensing',
    swatches: ['#e9ebe7', '#6a00ff', '#9dff00'],
    stageMode: 'points', model: 'gb200-nvl72',
  },
  {
    ...ACID_BASE, id: 'acid-glitch', name: 'Glitch', blurb: 'RGB-split jitter over the baseboard',
    swatches: ['#e9ebe7', '#6a00ff', '#ff7a00'],
    stageMode: 'glitch', model: 'hgx-h100',
  },
  {
    id: 'acid-tomo', name: 'Tomograph', blurb: 'CT slice sweep, gel-imaging negative',
    dark: true, swatches: ['#101413', '#c8ff4d', '#b48cff'],
    stageMode: 'slices', model: 'dgx-h100', slices: { count: 48, scan: 0xc8ff4d },
    fill: 0x121615, grid: [0x242a28, 0x1a201e], tags: ACID_DARK_TAGS,
  },
  {
    ...ACID_BASE, id: 'acid-assay', name: 'Assay', blurb: 'Telemetry titration on lab grey',
    swatches: ['#e9ebe7', '#ff7a00', '#00a890'],
    stageMode: 'flux', model: 'h100-rack',
    flux: { power: 0xff7a00, coolant: 0x00a890, fabric: 0x6a00ff },
  },
  {
    ...ACID_BASE, id: 'acid-cubes', name: 'Sugarcube', blurb: 'The CDU as candy voxels',
    swatches: ['#e9ebe7', '#6a00ff', '#00a86a'],
    stageMode: 'voxel', model: 'cdu-4u', voxel: { div: 44 },
  },
]);
