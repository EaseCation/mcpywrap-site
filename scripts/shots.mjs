// 用 Playwright 对本地预览站点截图，供人工检查视觉。
// 用法：先 `pnpm build && pnpm preview`，再 `pnpm shots [路径...]`
// 输出到 shots/<视口>-<路径>.png（shots/ 已 gitignore）
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/wiki/', '/wiki/start/install/'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

await mkdir('shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && console.log(`[console] ${m.text()}`));
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  for (const p of paths) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(Number(process.env.WAIT ?? 2800)); // 等开场动画
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const file = `shots/${vp.name}${p.replaceAll('/', '_') || '_'}.png`;
    await page.screenshot({ path: file });
    console.log(`${file}${overflow ? '  ⚠ 横向溢出' : ''}`);
  }
  await page.close();
}
await browser.close();
