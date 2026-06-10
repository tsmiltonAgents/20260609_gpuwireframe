// viewer.js — a small reusable Three.js wireframe viewer.
// Unlit line rendering (no lights needed), transparent background so the CSS
// neon gradient shows through, orbit controls, auto-framing, optional bloom,
// and render-pausing when the canvas scrolls off-screen (gallery performance).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { currentTheme } from './themes.js';

export class Viewer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
    this.camera.position.set(14, 9, 18);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.enableZoom = false; // wheel/pinch scrolls the page, never zooms
    this.controls.autoRotate = opts.autoRotate !== false;
    this.controls.autoRotateSpeed = opts.autoRotateSpeed != null ? opts.autoRotateSpeed : 0.45;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 200;

    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);

    if (opts.floor !== false) this._addFloor();
    if (opts.bloom) this._initBloom();

    this._running = false;
    this._tick = this._tick.bind(this);
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();

    // Pause rendering when off-screen
    if (opts.autoPause !== false && 'IntersectionObserver' in window) {
      this._io = new IntersectionObserver((es) => {
        for (const e of es) e.isIntersecting ? this.start() : this.stop();
      }, { threshold: 0.01 });
      this._io.observe(canvas);
    } else {
      this.start();
    }
  }

  _addFloor() {
    const g = (currentTheme() && currentTheme().grid) || [0x2e332f, 0x232825];
    const grid = new THREE.GridHelper(400, 40, g[0], g[1]);
    grid.position.y = this._grid ? this._grid.position.y : -0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    if (this._grid) {
      grid.scale.copy(this._grid.scale);
      this.scene.remove(this._grid);
      this._grid.geometry.dispose();
      this._grid.material.dispose();
    }
    this.scene.add(grid);
    this._grid = grid;
    if (!this._themeListener) {
      this._themeListener = () => this._addFloor();
      window.addEventListener('scc-theme', this._themeListener);
    }
  }

  _initBloom() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const b = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.6, 0.0);
    this.bloom = b;
    this.composer.addPass(b);
  }

  setModel(ctrl) {
    while (this.modelRoot.children.length) this.modelRoot.remove(this.modelRoot.children[0]);
    this.ctrl = ctrl;
    this.modelRoot.add(ctrl.root);
    this.frame();
  }

  frame(fit = 1.25) {
    const bb = new THREE.Box3().setFromObject(this.modelRoot);
    if (bb.isEmpty()) return;
    const sphere = bb.getBoundingSphere(new THREE.Sphere());
    this._center = sphere.center.clone();
    const r = sphere.radius;
    if (this._grid) {
      this._grid.position.y = bb.min.y - 0.4;
      this._grid.scale.setScalar(Math.max(1, r / 20));
    }
    const dist = r / Math.sin((this.camera.fov / 2) * Math.PI / 180) * fit;
    const dir = new THREE.Vector3(0.85, 0.4, -1).normalize();
    this.camera.position.copy(this._center).add(dir.multiplyScalar(dist));
    this.camera.near = dist / 100;
    this.camera.far = dist * 10;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = dist * 0.25;
    this.controls.maxDistance = dist * 4;
    this.controls.target.copy(this._center);
    this.controls.update();
  }

  _onResize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.resolution.set(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() { if (!this._running) { this._running = true; this._tick(); } }
  stop() { this._running = false; }

  _tick() {
    if (!this._running) return;
    requestAnimationFrame(this._tick);
    this.controls.update();
    if (this.onFrame) this.onFrame();
    if (this.renderOverride) this.renderOverride();
    else if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    if (this._themeListener) window.removeEventListener('scc-theme', this._themeListener);
    window.removeEventListener('resize', this._onResize);
    if (this._io) this._io.disconnect();
    this.renderer.dispose();
  }
}
