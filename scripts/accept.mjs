// 验收脚本：复制按钮、标签切换、键盘可达、降级场景。用法：先 pnpm preview，再 node scripts/accept.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();

// 1. 复制与标签切换
{
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.click('#install-panel-uv button[data-copy]');
  let clip = await page.evaluate(() => navigator.clipboard.readText());
  check('复制 uv 命令', clip === 'uv tool install mcpywrap', JSON.stringify(clip));
  const label = await page.textContent('#install-panel-uv [data-copy-label]');
  check('显示"已复制"', label === '已复制');
  await page.click('#install-tab-pip');
  await page.click('#install-panel-pip button[data-copy]');
  clip = await page.evaluate(() => navigator.clipboard.readText());
  check('复制 pip 命令', clip === 'pip install mcpywrap', JSON.stringify(clip));
  await ctx.close();
}

// 2. 键盘可达与焦点可见
{
  const page = await browser.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    seen.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        const o = getComputedStyle(el).outlineStyle;
        return { t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), o };
      }),
    );
  }
  const names = seen.map((s) => s.t);
  check('Tab 到达 uv 标签', names.includes('uv'));
  check('Tab 到达复制按钮', names.some((n) => n.startsWith('复制安装命令')));
  check('Tab 到达"交给 AI"', names.includes('交给 AI'));
  check('焦点样式可见', seen.every((s) => s.o !== 'none'), seen.filter((s) => s.o === 'none').map((s) => s.t).join(','));
  await page.close();
}

// 3. 无 WebGL：静态星球保留
{
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      return /webgl/.test(type) ? null : orig.call(this, type, ...a);
    };
  });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({
    canvas: !!document.querySelector('.planet3d canvas'),
    staticVisible: getComputedStyle(document.querySelector('.static-planet')).opacity === '1',
  }));
  check('无 WebGL 不创建画布', !r.canvas);
  check('无 WebGL 显示静态星球', r.staticVisible);
  await page.close();
}

// 4. 减少动态：页面完整，开场跳过
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const live = await page.evaluate(() => document.querySelector('[data-planet-wrap]')?.hasAttribute('data-live'));
  check('减少动态下 3D 正常且无报错', live && errors.length === 0, errors.join(';'));
  await ctx.close();
}

// 5. 徽章点击 → 卡片
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const btn = page.locator('.pbadge', { hasText: '统一输入' });
  await btn.click({ force: true });
  await page.waitForTimeout(1200);
  const card = await page.locator('.pcard').textContent().catch(() => '');
  check('点击徽章展开能力卡片', card.includes('统一输入') && card.includes('mcpy runtime input observe'));
  await page.screenshot({ path: 'shots/accept-card.png' });
  await page.keyboard.press('Escape');
  check('Esc 关闭卡片', (await page.locator('.pcard').count()) === 0);
  await page.close();
}

// 6. 各页面无横向溢出、无运行时报错
for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: vp });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of ['/', '/wiki/']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    check(`${vp.width}px ${path} 无横向溢出`, !over);
  }
  check(`${vp.width}px 无运行时报错`, errors.length === 0, errors.join(';'));
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
