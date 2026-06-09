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

## Models (all procedural, component-accurate)

| id | model |
|----|-------|
| `hgx-tray` | HGX 8-GPU SXM baseboard (NVSwitch fabric, HBM, heatsinks) |
| `pcie-4u` | 4U PCIe GPU server (8 dual-slot cards, fan wall, dual CPU, PSUs) |
| `coldplate-tray` | Liquid cold-plate tray (manifolds, branch tubes, QDCs) |
| `compute-1u` | 1U dual-CPU compute sled |
| `storage-sled` | 24-bay NVMe storage sled |
| `open-rack` | Populated Open-Rack v3 (busbar, power shelf, trays, switch) |

Pick a model in the gallery (or `/?model=<id>`) and the landing page uses it.

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
