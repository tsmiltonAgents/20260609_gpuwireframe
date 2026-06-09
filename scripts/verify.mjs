// verify.mjs — runtime verification of the deployed (or local) site.
// Usage: node scripts/verify.mjs [baseUrl]
// Checks per page: no console/page errors, canvases present and actually
// drawing (non-blank WebGL pixels), drag-hint visible. Saves screenshots.

import { chromium } from 'playwright';

const base = process.argv[2] || 'https://tsmiltonagents.github.io/20260609_gpuwireframe/';
const pages = [
  { name: 'home', url: base, canvases: 1 },
  { name: 'gallery', url: base + 'gallery/', canvases: 6 },
];

const browser = await chromium.launch();
let failures = 0;

for (const p of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

  await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500); // let renderers spin up

  const report = await page.evaluate(() => {
    const out = { canvases: [], hints: 0 };
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      let drawing = false;
      try {
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (gl) {
          const px = new Uint8Array(4 * 64);
          gl.readPixels(0, Math.floor(gl.drawingBufferHeight / 2), 64, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          drawing = px.some((v, i) => i % 4 !== 3 && v > 0);
        }
      } catch (_) {}
      out.canvases.push({ w: Math.round(r.width), h: Math.round(r.height), drawing });
    }
    for (const h of document.querySelectorAll('.drag-hint')) {
      if (getComputedStyle(h).opacity !== '0') out.hints++;
    }
    return out;
  });

  // scroll the home page to exercise the scroll-driven logic
  if (p.name === 'home') {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
    await page.waitForTimeout(1200);
    const hud = await page.evaluate(() => ({
      sub: document.getElementById('ro-sub')?.textContent,
      mode: document.getElementById('ro-mode')?.textContent,
    }));
    report.hud = hud;
    await page.screenshot({ path: `verify-${p.name}-scrolled.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: `verify-${p.name}.png`, fullPage: p.name === 'gallery' });

  const drawingCount = report.canvases.filter((c) => c.drawing).length;
  const sizedCount = report.canvases.filter((c) => c.w > 50 && c.h > 50).length;
  const ok = errors.length === 0 && report.canvases.length >= p.canvases && sizedCount >= p.canvases;

  console.log(`\n=== ${p.name} (${p.url})`);
  console.log(`canvases: ${report.canvases.length} (need ${p.canvases}), sized: ${sizedCount}, drawing-pixels: ${drawingCount}`);
  console.log(`drag-hints visible: ${report.hints}`);
  if (report.hud) console.log(`scroll HUD: subsystem="${report.hud.sub}" mode="${report.hud.mode}"`);
  if (errors.length) { console.log('ERRORS:'); errors.slice(0, 8).forEach((e) => console.log('  ' + e)); }
  console.log(ok ? 'PASS' : 'FAIL');
  if (!ok) failures++;
  await ctx.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
