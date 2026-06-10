// themes-vibes.js — pure-vibe stages: the hero visual is its own instrument,
// no rack model required.
import { registerThemes } from './themes.js';

const NEUTRAL_TAGS = {
  frame: 0x888888, chassis: 0x888888, rail: 0x777777, pcb: 0x7a8a7a,
  gpu: 0x9ab8c8, heatsink: 0x909090, coldplate: 0x8aa8b8, tube: 0x7a98a8,
  manifold: 0x7a98a8, memory: 0x9a8aa8, cpu: 0xa89a7a, power: 0xa8907a,
  busbar: 0xb09070, fan: 0x8a8a8a, nic: 0x8a7aa8, interconnect: 0x8a7aa8,
  cable: 0x8a7a98, drive: 0x7aa88a, connector: 0xa89a78, bezel: 0x848484,
  label: 0x9a9a9a, default: 0x8a8a8a,
};

registerThemes([
  {
    id: 'scope', name: 'Oscilloscope', blurb: 'Each section is a different signal',
    dark: true, swatches: ['#0a0f0c', '#28ff9e', '#ffb000'],
    stageMode: 'scope',
    scope: { trace: 0x28ff9e, trace2: 0xffb000, grid: 0x16382a },
    fill: 0x0a0f0c, grid: [0x16382a, 0x0f231b], tags: NEUTRAL_TAGS,
  },
  {
    id: 'thermal', name: 'Thermal', blurb: 'FLIR field — hotspots follow the story',
    dark: true, swatches: ['#0d0b10', '#ed6925', '#fcb519'],
    stageMode: 'heatfield',
    fill: 0x0d0b10, grid: [0x2a1f2a, 0x1c141c], tags: NEUTRAL_TAGS,
  },
  {
    id: 'console', name: 'Ops Console', blurb: 'Live telemetry log, feed per section',
    dark: true, swatches: ['#0c0e12', '#4cc38a', '#e5484d'],
    stageMode: 'logstream',
    fill: 0x0c0e12, grid: [0x22262e, 0x171a20], tags: NEUTRAL_TAGS,
  },
  {
    id: 'survey', name: 'Survey', blurb: 'Drifting contours, a mark per section',
    dark: false, swatches: ['#f1ecdf', '#2b2a26', '#d23b2e'],
    stageMode: 'topo',
    topo: { ink: 0x2b2a26, paper: 0xf1ecdf, mark: 0xd23b2e },
    fill: 0xe9e4d5, grid: [0xd5cfbe, 0xe1dbca], tags: NEUTRAL_TAGS,
  },
  {
    id: 'observatory', name: 'Observatory', blurb: 'The NVLink domain as a constellation',
    dark: true, swatches: ['#070b16', '#e8ecf8', '#d8b36a'],
    stageMode: 'orbital',
    orbital: { star: 0xe8ecf8, hub: 0xd8b36a, edge: 0x26304e, pulse: 0xd8b36a },
    fill: 0x070b16, grid: [0x1a2238, 0x111728], tags: NEUTRAL_TAGS,
  },
]);
