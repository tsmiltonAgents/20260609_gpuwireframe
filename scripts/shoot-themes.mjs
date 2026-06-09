// shoot-themes.mjs — screenshot every theme on the landing page (hero + a
// scrolled tech section) and the gallery. Usage:
//   node scripts/shoot-themes.mjs [baseUrl] [themeId ...]

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const args = process.argv.slice(2);
const base = args[0] && args[0].startsWith('http')
  ? args[0] : 'http://localhost:4329/20260609_gpuwireframe/';
const only = args.filter((a) => !a.startsWith('http'));

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// discover theme ids from the picker on the live page
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
let ids = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.tp-item')).map((b) => b.dataset.id));
if (only.length) ids = ids.filter((id) => only.includes(id));
console.log('themes:', ids.join(', '));

for (const id of ids) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate((tid) => localStorage.setItem('scc-theme', tid), id);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `shots/${id}-hero.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `shots/${id}-section.png` });

  await page.goto(base + 'gallery/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `shots/${id}-gallery.png` });
  console.log('shot', id);
}
await browser.close();
console.log('done');
