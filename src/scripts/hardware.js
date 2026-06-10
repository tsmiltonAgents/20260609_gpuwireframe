// hardware.js — builds 10 "hardware-y" decoration motifs into their stages.
// Each builder fills a .hw-stage with SVG/canvas and may return { onFrame }.
// A single rAF loop drives only the motifs currently on screen.

const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function mkSVG(w, h) {
  const s = svg('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid slice', class: 'hw-svg' });
  return s;
}
// tiny seeded RNG so each motif is stable across reloads
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// ===========================================================================
// 01 — PCB traces: orthogonal copper routes, vias, pads, travelling pulses
// ===========================================================================
function pcbTraces(stage) {
  const W = 1000, H = 600, s = mkSVG(W, H);
  const r = rng(7);
  const grid = svg('g', { class: 'pcb-grid' });
  for (let x = 0; x <= W; x += 25) grid.appendChild(svg('line', { x1: x, y1: 0, x2: x, y2: H }));
  for (let y = 0; y <= H; y += 25) grid.appendChild(svg('line', { x1: 0, y1: y, x2: W, y2: y }));
  s.appendChild(grid);
  for (let i = 0; i < 26; i++) {
    let x = 0, y = Math.round((r() * H) / 25) * 25;
    let d = `M ${x} ${y}`;
    const pts = [[x, y]];
    while (x < W) {
      x += (1 + Math.floor(r() * 4)) * 25;
      d += ` L ${x} ${y}`;
      if (r() > 0.45) { y += (Math.floor(r() * 5) - 2) * 25; y = Math.max(25, Math.min(H - 25, y)); d += ` L ${x} ${y}`; }
      pts.push([x, y]);
    }
    s.appendChild(svg('path', { d, class: 'pcb-trace' }));
    const pulse = svg('path', { d, class: 'pcb-pulse' });
    pulse.style.animationDelay = `${r() * 4}s`;
    pulse.style.animationDuration = `${2.4 + r() * 3}s`;
    s.appendChild(pulse);
    for (const [px, py] of pts) if (r() > 0.6) s.appendChild(svg('circle', { cx: px, cy: py, r: 4.5, class: 'pcb-via' }));
  }
  // a couple of IC footprints + ref-des
  for (let i = 0; i < 4; i++) {
    const gx = 140 + i * 200, gy = 90 + (i % 2) * 360, w = 90, h = 60;
    const g = svg('g', { class: 'pcb-ic' });
    g.appendChild(svg('rect', { x: gx, y: gy, width: w, height: h, rx: 4 }));
    for (let p = 0; p < 5; p++) {
      g.appendChild(svg('rect', { x: gx + 10 + p * 17, y: gy - 8, width: 6, height: 8 }));
      g.appendChild(svg('rect', { x: gx + 10 + p * 17, y: gy + h, width: 6, height: 8 }));
    }
    const t = svg('text', { x: gx + w / 2, y: gy + h / 2 + 4, class: 'pcb-ref' }); t.textContent = `U${i + 1}`;
    g.appendChild(t); s.appendChild(g);
  }
  stage.appendChild(s);
}

// ===========================================================================
// 02 — Gold edge connector: a PCB card with gold fingers + silkscreen
// ===========================================================================
function edgeConnector(stage) {
  const W = 1000, H = 600, s = mkSVG(W, H);
  s.appendChild(svg('rect', { x: 40, y: 60, width: 920, height: 480, rx: 10, class: 'ec-board' }));
  // mounting holes
  for (const [cx, cy] of [[80, 100], [920, 100], [80, 500], [920, 500]])
    s.appendChild(svg('circle', { cx, cy, r: 14, class: 'ec-hole' }));
  // gold fingers along the bottom
  const fingers = 34, fw = 800 / fingers;
  for (let i = 0; i < fingers; i++) {
    const x = 100 + i * fw;
    s.appendChild(svg('rect', { x: x + 2, y: 470, width: fw - 5, height: 70, rx: 2, class: 'ec-finger' }));
  }
  s.appendChild(svg('rect', { x: 96, y: 462, width: 808, height: 8, class: 'ec-finger-bar' }));
  // silkscreen traces + components
  const r = rng(3);
  for (let i = 0; i < 10; i++) {
    const x = 120 + r() * 760, y = 110 + r() * 300;
    s.appendChild(svg('rect', { x, y, width: 26 + r() * 40, height: 12, rx: 2, class: 'ec-part' }));
    const t = svg('text', { x: x + 2, y: y - 4, class: 'ec-silk' }); t.textContent = ['R', 'C', 'L', 'Q'][i % 4] + (i + 1);
    s.appendChild(t);
  }
  const lbl = svg('text', { x: 110, y: 130, class: 'ec-board-lbl' }); lbl.textContent = 'SCC-NVL72  REV A'; s.appendChild(lbl);
  stage.appendChild(s);
}

// ===========================================================================
// 03 — Rack rails: EIA-310 uprights with numbered U holes framing the page
// ===========================================================================
function rackRails(stage) {
  const W = 1000, H = 600, s = mkSVG(W, H);
  const U = 13, rails = [120, 880];
  for (const rx of rails) {
    s.appendChild(svg('rect', { x: rx - 22, y: 20, width: 44, height: H - 40, rx: 4, class: 'rr-rail' }));
    for (let u = 0; u < (H - 60) / U; u++) {
      const y = 40 + u * U;
      s.appendChild(svg('rect', { x: rx - 6, y, width: 12, height: 7, rx: 1.5, class: 'rr-hole' }));
      if (u % 3 === 0) {
        const t = svg('text', { x: rx + (rx < 500 ? 16 : -16), y: y + 7, class: 'rr-num', 'text-anchor': rx < 500 ? 'start' : 'end' });
        t.textContent = Math.floor((H - 60) / U / 3 - u / 3) + 'U'; s.appendChild(t);
      }
    }
  }
  // a couple of cage nuts to imply mounted gear, kept clear of the hero text
  for (const ny of [120, 160, 440, 480]) for (const rx of [120, 880])
    s.appendChild(svg('rect', { x: rx - 7, y: ny, width: 14, height: 9, rx: 1.5, class: 'rr-nut' }));
  stage.appendChild(s);
}

// ===========================================================================
// 04 — LED status wall: blinking port LEDs like a switch / storage faceplate
// ===========================================================================
function ledWall(stage) {
  const wrap = document.createElement('div'); wrap.className = 'led-wrap';
  const cols = 24, rows = 6, leds = [];
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div'); row.className = 'led-row';
    for (let c = 0; c < cols; c++) {
      const d = document.createElement('i'); d.className = 'led';
      row.appendChild(d); leds.push(d);
    }
    wrap.appendChild(row);
  }
  stage.appendChild(wrap);
  const states = ['g', 'g', 'g', 'a', 'off', 'off'];
  let t = 0;
  return {
    onFrame() {
      t++; if (t % 6) return; // ~10fps flicker
      for (const d of leds) if (Math.random() > 0.78) {
        const st = states[(Math.random() * states.length) | 0];
        d.className = 'led' + (st === 'off' ? '' : ' on ' + st);
      }
    },
  };
}

// ===========================================================================
// 05 — Oscilloscope: graticule + live trace + bezel knobs/readouts
// ===========================================================================
function scope(stage) {
  const cv = document.createElement('canvas'); cv.className = 'hw-canvas';
  stage.appendChild(cv);
  const bezel = document.createElement('div'); bezel.className = 'scope-bezel';
  bezel.innerHTML = '<div class="scope-knobs"><span></span><span></span><span></span><span></span></div>' +
    '<div class="scope-read">CH1 2V/div · 5µs/div · TRIG ↑</div>';
  stage.appendChild(bezel);
  const ctx = cv.getContext('2d');
  function size() { const r = stage.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size(); window.addEventListener('resize', size);
  let t = 0;
  return {
    onFrame() {
      t += 0.03; const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(80,255,160,0.16)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) { const x = i / 12 * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let i = 0; i <= 8; i++) { const y = i / 8 * h; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      const N = 400;
      ctx.strokeStyle = '#46ff9c'; ctx.lineWidth = 2; ctx.shadowColor = '#46ff9c'; ctx.shadowBlur = 8; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const x = i / N * w; const xn = i / N * Math.PI * 2;
        const v = (Math.sin(xn * 4 + t * 2) > 0 ? 0.5 : -0.5) + Math.sin(xn * 32 + t * 9) * 0.07;
        const y = h / 2 - v * h * 0.34; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,180,60,0.7)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const x = i / N * w; const xn = i / N * Math.PI * 2;
        const y = h / 2 - Math.sin(xn * 2 + t) * Math.cos(xn + t * 0.5) * h * 0.16; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    },
  };
}

// ===========================================================================
// 06 — Ribbon harness: flat rainbow ribbon cables + round bundles + headers
// ===========================================================================
function ribbon(stage) {
  const W = 1000, H = 600, s = mkSVG(W, H);
  const cols = ['#e23b3b', '#e2873b', '#e2c73b', '#5bd36b', '#3bb6e2', '#6b6be2', '#b96be2', '#888'];
  const r = rng(11);
  for (let band = 0; band < 4; band++) {
    const y0 = 80 + band * 130 + r() * 30;
    const cp1 = 250 + r() * 120, cp2 = 700 + r() * 120, y1 = 80 + band * 130 + (r() - 0.5) * 120;
    for (let k = 0; k < cols.length; k++) {
      const off = (k - cols.length / 2) * 7;
      const d = `M -20 ${y0 + off} C ${cp1} ${y0 + off - 40}, ${cp2} ${y1 + off + 40}, 1020 ${y1 + off}`;
      const p = svg('path', { d, class: 'rb-wire', stroke: cols[k] }); s.appendChild(p);
    }
    // zip tie
    s.appendChild(svg('rect', { x: 480, y: ((y0 + y1) / 2) - 36, width: 20, height: 72, rx: 6, class: 'rb-tie' }));
    // connector headers at both ends
    for (const ex of [-4, 980]) s.appendChild(svg('rect', { x: ex, y: y0 - 36, width: 40, height: 72, rx: 4, class: 'rb-conn' }));
  }
  stage.appendChild(s);
}

// ===========================================================================
// 07 — Heatsink + fan: extruded fins behind a spinning fan
// ===========================================================================
function heatsink(stage) {
  const fins = document.createElement('div'); fins.className = 'hs-fins'; stage.appendChild(fins);
  const W = 1000, H = 600, s = mkSVG(W, H);
  const cx = 500, cy = 300, R = 150;
  s.appendChild(svg('rect', { x: cx - R - 30, y: cy - R - 30, width: (R + 30) * 2, height: (R + 30) * 2, rx: 16, class: 'hs-shroud' }));
  s.appendChild(svg('circle', { cx, cy, r: R, class: 'hs-ring' }));
  const fan = svg('g', { class: 'hs-fan' });
  fan.style.transformOrigin = `${cx}px ${cy}px`;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 55, by = cy + Math.sin(a) * 55;
    const blade = svg('path', { d: `M ${bx} ${by} q ${Math.cos(a + 1) * 120} ${Math.sin(a + 1) * 120}, ${Math.cos(a + 0.4) * 150} ${Math.sin(a + 0.4) * 150} L ${cx} ${cy} Z`, class: 'hs-blade' });
    fan.appendChild(blade);
  }
  fan.appendChild(svg('circle', { cx, cy, r: 42, class: 'hs-hub' }));
  s.appendChild(fan);
  stage.appendChild(s);
}

// ===========================================================================
// 08 — Schematic: ink-on-cream symbols, net labels, title block
// ===========================================================================
function schematic(stage) {
  const W = 1000, H = 600, s = mkSVG(W, H);
  const g = svg('g', { class: 'sc-ink' });
  const wire = (d) => g.appendChild(svg('path', { d, class: 'sc-wire' }));
  const txt = (x, y, t, cls) => { const e = svg('text', { x, y, class: cls || 'sc-net' }); e.textContent = t; g.appendChild(e); };
  // resistor
  wire('M 120 160 H 200'); g.appendChild(svg('path', { d: 'M 200 160 l 10 -12 l 20 24 l 20 -24 l 20 24 l 20 -24 l 10 12', class: 'sc-wire' }));
  wire('M 300 160 H 380'); txt(120, 150, '48V');
  // capacitor
  wire('M 380 160 V 240'); g.appendChild(svg('line', { x1: 350, y1: 240, x2: 410, y2: 240, class: 'sc-wire' }));
  g.appendChild(svg('line', { x1: 350, y1: 252, x2: 410, y2: 252, class: 'sc-wire' })); wire('M 380 252 V 320');
  g.appendChild(svg('path', { d: 'M 360 320 H 400 M 368 330 H 392 M 376 340 H 384', class: 'sc-wire' })); txt(414, 246, 'C1');
  // IC box with pins
  g.appendChild(svg('rect', { x: 560, y: 130, width: 200, height: 160, class: 'sc-ic' }));
  txt(600, 220, 'GH100', 'sc-ic-lbl');
  for (let p = 0; p < 5; p++) { const y = 150 + p * 30; wire(`M 520 ${y} H 560`); wire(`M 760 ${y} H 800`); txt(500, y + 4, 'D' + p); }
  // ground + more nets
  wire('M 800 150 H 880 V 420'); g.appendChild(svg('path', { d: 'M 860 420 H 900 M 868 430 H 892 M 876 440 H 884', class: 'sc-wire' }));
  // title block
  const tb = svg('g', { class: 'sc-tb' });
  tb.appendChild(svg('rect', { x: 640, y: 470, width: 320, height: 90 }));
  tb.appendChild(svg('line', { x1: 640, y1: 500, x2: 960, y2: 500 }));
  tb.appendChild(svg('line', { x1: 800, y1: 500, x2: 800, y2: 560 }));
  const a = svg('text', { x: 654, y: 492, class: 'sc-tb-t' }); a.textContent = 'SIDE CHANNEL CLOUD · POWER STAGE'; tb.appendChild(a);
  const b = svg('text', { x: 654, y: 535, class: 'sc-tb-s' }); b.textContent = 'SHEET 1/4'; tb.appendChild(b);
  const c = svg('text', { x: 814, y: 535, class: 'sc-tb-s' }); c.textContent = 'REV A'; tb.appendChild(c);
  g.appendChild(tb); s.appendChild(g); stage.appendChild(s);
}

// ===========================================================================
// 09 — Copper busbar: vertical bars, bolt holes, lugs, rising current
// ===========================================================================
function busbar(stage) {
  const W = 1000, H = 600, s = mkSVG(W, H);
  const bars = [430, 570];
  for (const bx of bars) {
    s.appendChild(svg('rect', { x: bx - 34, y: 20, width: 68, height: H - 40, rx: 8, class: 'bb-bar' }));
    s.appendChild(svg('rect', { x: bx - 24, y: 20, width: 14, height: H - 40, class: 'bb-hi' }));
    for (let y = 70; y < H - 40; y += 80) s.appendChild(svg('circle', { cx: bx, cy: y, r: 11, class: 'bb-bolt' }));
    // current particles
    for (let i = 0; i < 7; i++) {
      const dot = svg('circle', { cx: bx, cy: 0, r: 5, class: 'bb-flow' });
      dot.style.animationDelay = `${i * 0.5}s`;
      s.appendChild(dot);
    }
  }
  // cross lug
  s.appendChild(svg('rect', { x: 396, y: 280, width: 208, height: 40, rx: 6, class: 'bb-lug' }));
  const t = svg('text', { x: 500, y: 305, class: 'bb-lbl' }); t.textContent = '48 V DC'; s.appendChild(t);
  stage.appendChild(s);
}

// ===========================================================================
// 10 — Thermal IR: moving inferno hotspots + crosshair + temp readout
// ===========================================================================
function thermal(stage) {
  const cv = document.createElement('canvas'); cv.className = 'hw-canvas'; stage.appendChild(cv);
  const hud = document.createElement('div'); hud.className = 'ir-hud';
  hud.innerHTML = '<div class="ir-cross"></div><div class="ir-read">SP 78.4°C · MAX 91.2°C · ε0.95</div><div class="ir-scale"></div>';
  stage.appendChild(hud);
  const ctx = cv.getContext('2d');
  function size() { const r = stage.getBoundingClientRect(); cv.width = Math.max(2, r.width / 6); cv.height = Math.max(2, r.height / 6); }
  size(); window.addEventListener('resize', size);
  cv.style.cssText = 'width:100%;height:100%;image-rendering:auto;filter:blur(7px)';
  const blobs = []; const r = rng(5);
  for (let i = 0; i < 6; i++) blobs.push({ x: r(), y: 0.2 + r() * 0.6, vx: (r() - 0.5) * 0.0007, vy: (r() - 0.5) * 0.0006, h: 0.35 + r() * 0.45 });
  // inferno-style ramp: black -> deep purple -> red -> orange -> yellow (low blue)
  function inferno(t) {
    t = Math.max(0, Math.min(1, t));
    const rC = Math.min(1, 1.9 * t);
    const gC = Math.max(0, 1.45 * t - 0.55);
    const bC = t < 0.28 ? 0.85 * t : Math.max(0, 0.55 - 1.2 * (t - 0.28));
    return `rgb(${(rC * 235) | 0},${(gC * 205) | 0},${(bC * 120) | 0})`;
  }
  return {
    onFrame() {
      const w = cv.width, h = cv.height; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0a0406'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.62;
      for (const b of blobs) {
        b.x += b.vx; b.y += b.vy; if (b.x < 0 || b.x > 1) b.vx *= -1; if (b.y < 0.15 || b.y > 0.85) b.vy *= -1;
        const cx = b.x * w, cy = b.y * h, rad = w * 0.42 * b.h;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, inferno(b.h)); g.addColorStop(0.45, inferno(b.h * 0.55)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
}

// ---------------------------------------------------------------------------
const MOTIFS = {
  'pcb-traces': pcbTraces, 'edge-connector': edgeConnector, 'rack-rails': rackRails,
  'led-wall': ledWall, 'scope': scope, 'ribbon': ribbon, 'heatsink': heatsink,
  'schematic': schematic, 'busbar': busbar, 'thermal': thermal,
};

const active = new Set();
document.querySelectorAll('[data-motif]').forEach((sec) => {
  const fn = MOTIFS[sec.dataset.motif];
  if (!fn) return;
  const stage = sec.querySelector('.hw-stage');
  const api = fn(stage) || {};
  sec._hw = api;
});
const io = new IntersectionObserver((es) => {
  for (const e of es) { if (e.isIntersecting) active.add(e.target); else active.delete(e.target); }
}, { threshold: 0.15 });
document.querySelectorAll('[data-motif]').forEach((s) => io.observe(s));
function loop() { for (const s of active) if (s._hw && s._hw.onFrame) s._hw.onFrame(); requestAnimationFrame(loop); }
loop();
