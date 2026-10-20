// 无障碍扫描：axe-core（WCAG 2.1 A/AA 规则）。自动扫描只能发现部分问题，完整结论需要读屏软件实测。
// 用法：pnpm preview 后 node scripts/a11y.mjs [路径...]
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSrc = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/wiki/', '/wiki/network/server/'];

const browser = await chromium.launch();
let total = 0;
for (const path of paths) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.addScriptTag({ content: axeSrc });
  const res = await page.evaluate(async () =>
    // @ts-ignore
    axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }),
  );
  console.log(`\n${path}: ${res.violations.length} 类问题`);
  for (const v of res.violations) {
    total++;
    console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 4)) console.log(`      ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`);
  }
  await page.close();
}
await browser.close();
process.exit(total ? 1 : 0);
