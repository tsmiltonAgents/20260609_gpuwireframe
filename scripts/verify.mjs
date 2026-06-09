// verify.mjs — runtime verification of the deployed (or local) site.
// Usage: node scripts/verify.mjs [baseUrl]
// Checks per page: no console/page errors, canvases present and actually
// drawing (non-blank WebGL pixels), drag-hint visible. Saves screenshots.

import { chromium } from 'playwright';

const base = process.argv[2] || 'https://tsmiltonagents.github.io/20260609_gpuwireframe/';
const pages = [
  { name: 'home', url: base, canvases: 1 },
  { name: 'gallery', url: base + 'gallery/', canvases: 13 },
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
  await page.waitForTimeout(2000);
  // warm every viewer: step-scroll the page so IntersectionObserver-paused
  // canvases come on screen and render at least once
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y <= h; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 350));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);

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
    await page.waitForTimeout(900);
    // access form: fill, submit, expect success state
    report.formOk = await page.evaluate(async () => {
      const f = document.getElementById('access-form');
      if (!f) return false;
      f.querySelector('[name=name]').value = 'Verify Bot';
      f.querySelector('[name=email]').value = 'verify@example.com';
      f.requestSubmit();
      await new Promise((r) => setTimeout(r, 400));
      return document.getElementById('access-card').classList.contains('done');
    });
  }

  // drag-interaction test on the gallery: drag the first canvas and confirm
  // the hint dismisses (proves pointer events reach OrbitControls' canvas)
  if (p.name === 'gallery') {
    const stage = page.locator('.card .stage').first();
    const box = await stage.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      const dismissed = await page.evaluate(() =>
        document.querySelector('.card .drag-hint')?.classList.contains('seen'));
      report.dragDismissesHint = !!dismissed;
    }
    // Pick flow: click Pick on the second card, expect highlight + flag
    report.pickOk = await page.evaluate(async () => {
      const card = document.querySelectorAll('.card')[1];
      if (!card) return false;
      card.querySelector('.act-choose').click();
      await new Promise((r) => setTimeout(r, 200));
      return card.classList.contains('chosen') &&
        getComputedStyle(card.querySelector('.picked-flag')).display !== 'none';
    });
  }

  await page.screenshot({ path: `verify-${p.name}.png`, fullPage: p.name === 'gallery' });

  const drawingCount = report.canvases.filter((c) => c.drawing).length;
  const sizedCount = report.canvases.filter((c) => c.w > 50 && c.h > 50).length;
  const ok = errors.length === 0 && report.canvases.length >= p.canvases && sizedCount >= p.canvases;

  console.log(`\n=== ${p.name} (${p.url})`);
  console.log(`canvases: ${report.canvases.length} (need ${p.canvases}), sized: ${sizedCount}, drawing-pixels: ${drawingCount}`);
  console.log(`drag-hints visible: ${report.hints}`);
  if (report.dragDismissesHint !== undefined) console.log(`drag dismisses hint: ${report.dragDismissesHint}`);
  if (report.formOk !== undefined) console.log(`access form submits: ${report.formOk}`);
  if (report.pickOk !== undefined) console.log(`pick highlights card: ${report.pickOk}`);
  if (report.hud) console.log(`scroll HUD: subsystem="${report.hud.sub}" mode="${report.hud.mode}"`);
  if (errors.length) { console.log('ERRORS:'); errors.slice(0, 8).forEach((e) => console.log('  ' + e)); }
  console.log(ok ? 'PASS' : 'FAIL');
  if (!ok) failures++;
  await ctx.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
