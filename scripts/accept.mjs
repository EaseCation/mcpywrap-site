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
  check('Tab 到达"快速开始"', names.includes('快速开始'));
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

// 5b. 点击方块：开发半球不能被整片翻成游玩态（回归：跳过开场时曾把开发侧全部翻成泥土）；点击处弹出命令
{
  // 左半球开发态像素（薄荷/深蓝）与游玩态像素（草/土）的比例
  const devVsPlay = async (page) => {
    const box = await page.locator('[data-planet-wrap]').boundingBox();
    const buf = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width / 2, height: box.height } });
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let dev = 0, play = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
        if (b > r * 1.3 && b > 20 && g > r) dev++; // 深蓝面与薄荷格线
        else if ((g > r * 1.15 && g > b * 1.4 && g > 60) || (r > g && g > b && r > 70)) play++;
      }
      return { dev, play };
    }, buf.toString('base64'));
  };
  for (const reduced of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/?seam=line', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    const box = await page.locator('[data-planet-wrap]').boundingBox();
    // 点击开发半球（左侧）上的一个方块
    await page.mouse.click(box.x + box.width * 0.36, box.y + box.height * 0.5);
    await page.waitForTimeout(400);
    const tag = (await page.locator('.ptap').textContent()) ?? '';
    await page.waitForTimeout(3500); // 等波纹结束
    const r = await devVsPlay(page);
    const label = reduced ? '（减少动态）' : '';
    check(`点击后开发半球保持开发态${label}`, r.dev > r.play * 2, JSON.stringify(r));
    check(`点击方块弹出命令${label}`, tag.includes('mcpy'), JSON.stringify(tag));
    await ctx.close();
  }
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
