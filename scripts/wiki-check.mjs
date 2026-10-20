// Wiki 验收：内链无死链 + Pagefind 中文搜索命中。用法：pnpm build && pnpm preview，再 node scripts/wiki-check.mjs
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
let failed = 0;

// 1. 死链：扫描 dist 下所有 HTML 的站内 href
async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const exists = async (p) => stat(p).then(() => true, () => false);
const bad = new Set();
for (const file of await walk(DIST)) {
  const html = await readFile(file, 'utf8');
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
    if (href.startsWith('/_astro') || href.startsWith('/pagefind')) continue;
    const target = join(DIST, href);
    const ok = (await exists(join(target, 'index.html'))) || (await exists(target));
    if (!ok) bad.add(`${href}  ←  ${file.replace(DIST, '')}`);
  }
}
if (bad.size) {
  failed++;
  console.log('FAIL  死链：');
  for (const b of bad) console.log('   ', b);
} else console.log('PASS  站内链接无死链');

// 2. 中文搜索：关键词 → 期望页面出现在前 3 条
const cases = [
  ['依赖', '/wiki/project/dependencies/'],
  ['QuMod', '/wiki/project/dependencies/'],
  ['热更', '/wiki/runtime/debug/'],
  ['服务器', '/wiki/network/server/'],
  ['截图', '/wiki/runtime/capture/'],
  ['录屏', '/wiki/runtime/capture/'],
  ['生命周期', '/wiki/project/scripts/'],
  ['双客户端', '/wiki/network/dual-clients/'],
  ['远程', '/wiki/network/remote/'],
  ['输入计划', '/wiki/runtime/input/'],
  ['苹果', '/wiki/local/macos/'],
  ['安装', '/wiki/start/install/'],
];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE + '/wiki/', { waitUntil: 'networkidle' });
for (const [q, want] of cases) {
  const urls = await page.evaluate(async (q) => {
    const pf = await import('/pagefind/pagefind.js');
    await pf.init();
    const r = await pf.search(q);
    const d = await Promise.all(r.results.slice(0, 3).map((x) => x.data()));
    return d.map((x) => x.url);
  }, q);
  const ok = urls.some((u) => u.replace(/\.html$/, '/').startsWith(want));
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  搜索「${q}」→ ${urls.join(' , ') || '(无结果)'}`);
}
await browser.close();
console.log(failed ? `\n${failed} 项未通过` : '\n全部通过');
process.exit(failed ? 1 : 0);
