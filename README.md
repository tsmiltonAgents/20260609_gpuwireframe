# Side Channel Cloud — GPU rack & tray wireframes

Astro static site with procedurally built, true-to-life GPU tray / rack 3D
wireframe models (Three.js). Built for the **Side Channel Cloud** landing page:
text scrolls on the left while a technical wireframe of the hardware rotates on
the right, revealing internal subsystems (GPUs, HBM, cold plates, coolant loop,
fabric, power) section by section.

## Pages

- `/` — landing prototype: scroll-driven wireframe, subsystem spotlight + x-ray per section
- `/gallery/` — model picker: all 6 hardware options side by side, drag to rotate,
  per-card x-ray, subsystem legend, `.glb/.gltf` drop-in import

## Models (all procedural, dimensionally accurate)

| id | model |
|----|-------|
| `gb200-nvl72` | GB200 NVL72 rack (18 compute + 9 switch trays, busbar, manifolds, cable cartridge) |
| `h100-rack` | 42U EIA-310 rack with 4× DGX H100 + ToR switches + PDUs |
| `nvl72-compute-tray` | 1U MGX tray, 2× Grace-Blackwell superchip, liquid-cooled |
| `nvl72-switch-tray` | 1U NVLink-5 switch tray |
| `dgx-h100` | DGX H100 8U system, full internals |
| `hgx-h100` | HGX H100 8-GPU baseboard |
| `pcie-4u` | 4U PCIe GPU server |
| `gb200-superchip` | GB200 superchip board close-up |
| `sxm5-module` | H100 SXM5 module, exploded heatsink |
| `fabric-switch-1u` | 1U 32× OSFP fabric switch |
| `cdu-4u` | 4U in-rack coolant distribution unit |
| `orv3-power-shelf` | ORv3 power shelf, 6× rectifiers |
| `jbof-1u` | 1U 32× E1.S NVMe JBOF |

Pick a model in the gallery (or `/?model=<id>`) and the landing page uses it.
`/debug/?model=<id>&az=30&el=15&xray=1` renders fixed-angle views.

Design language is a dark-mode riff on [Amodo Design](https://amododesign.com/)
(IBM Plex Serif/Sans/Mono, teal + terracotta on warm dark slate, rounded
hairline page frame, numbered nav).

## Design systems

Ten switchable themes (bottom-right picker, `t` to cycle): Amodo Dark (default),
Blueprint, Phosphor, Preprint (paper), Brutalist, Swiss, Synthwave, Mission
Control, Noir, Acid Lab. Eight were designed by parallel agents against a token
contract (`scripts/build-themes.mjs` regenerates from `themes-design.json`).
Each theme restyles the full site *and* re-tints the 3D wireframe layer
palette live. Reference chips (arXiv / RAND / CNAS / Substack / conference)
link out from every section.

## Dev

```sh
npm install
npm run dev      # local dev
npm run build    # static build to dist/
```

Deploys to GitHub Pages via Actions on every push to `main`.

To add a real CAD model: export as `.glb`, drop it in `public/models/`, and list
it in `public/models/manifest.json` as `[{ "file": "name.glb", "name": "Label" }]` —
the gallery auto-wireframes it.
