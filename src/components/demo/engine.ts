// 命令演示的方块舞台：16×9 格，开发态（线框代码块）/ 游玩态（草地实心块）与 Hero 星球同一套语言。
// 每个场景函数接收舞台和"是否瞬间完成"，可重复执行；跳到第 n 步时先瞬间重放前面各步。
import type { Scene } from '../../data/demos';

export const COLS = 16;
export const ROWS = 9;
type Cell = 'empty' | 'code' | 'play' | 'dirt' | 'seam';

export class Stage {
  cells: HTMLElement[] = [];
  layer: HTMLElement;
  token = 0;
  instant = false;
  private owner: Stage = this;
  private runToken = 0;

  constructor(public root: HTMLElement) {
    root.style.setProperty('--cols', String(COLS));
    root.style.setProperty('--rows', String(ROWS));
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = document.createElement('i');
      c.dataset.s = 'empty';
      grid.append(c);
      this.cells.push(c);
    }
    this.layer = document.createElement('div');
    this.layer.className = 'layer';
    root.append(grid, this.layer);
  }

  /** 每次播放使用独立的取消标识与速度，旧动画不能写入新画面。 */
  forRun(instant: boolean): Stage {
    const run = Object.create(this) as Stage;
    run.owner = this;
    run.runToken = this.token;
    run.instant = instant;
    return run;
  }

  checkpoint() {
    if (this.owner !== this && this.owner.token !== this.runToken) throw new Error('cancelled');
  }

  /** 清空舞台，并取消正在进行的动画 */
  reset() {
    this.token++;
    this.clear();
  }

  /** 只清空画面（场景内部换景用） */
  clear() {
    this.checkpoint();
    this.cells.forEach((c) => (c.dataset.s = 'empty'));
    this.layer.replaceChildren();
  }

  set(x: number, y: number, s: Cell) {
    this.checkpoint();
    const c = this.cells[y * COLS + x];
    if (c) c.dataset.s = s;
  }

  get(x: number, y: number) {
    return this.cells[y * COLS + x]?.dataset.s as Cell | undefined;
  }

  /** 等待；被新的播放打断时抛出，瞬间模式直接返回 */
  async wait(ms: number) {
    this.checkpoint();
    if (this.instant) return;
    await new Promise((r) => setTimeout(r, ms));
    this.checkpoint();
  }

  /** 在格子坐标处放一个叠加元素 */
  put(cls: string, x: number, y: number, html = '', w = 1, h = 1) {
    this.checkpoint();
    const el = document.createElement('div');
    el.className = `o ${cls}`;
    this.move(el, x, y);
    el.style.setProperty('--w', String(w));
    el.style.setProperty('--h', String(h));
    el.innerHTML = html;
    this.layer.append(el);
    return el;
  }

  move(el: HTMLElement, x: number, y: number) {
    this.checkpoint();
    el.style.setProperty('--x', String(x));
    el.style.setProperty('--y', String(y));
  }

  find(cls: string) {
    return this.layer.querySelector<HTMLElement>(`.${cls}`);
  }

  /** 短暂闪光一个元素或格子 */
  pulse(el: HTMLElement) {
    this.checkpoint();
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }
}

const GROUND = 6;

/** 一列一列地：先画线框代码块，再翻成草地 */
async function buildGround(s: Stage, x0 = 0, x1 = COLS - 1) {
  for (let x = x0; x <= x1; x++) {
    for (let y = GROUND; y < ROWS; y++) s.set(x, y, 'code');
    await s.wait(35);
  }
  for (let x = x0; x <= x1; x++) {
    s.set(x, GROUND, 'play');
    for (let y = GROUND + 1; y < ROWS; y++) s.set(x, y, 'dirt');
    await s.wait(45);
  }
}

const player = (s: Stage, x: number) => s.find('player') ?? s.put('player', x, GROUND - 2, '<b></b><b></b><b></b>', 1, 2);
const chip = (s: Stage, text: string, x: number, y: number, cls = '') => s.put(`chip ${cls}`, x, y, text);

/** 三层依赖：商店玩法 → 经济组件 → QuMod。文字放在节点右侧。 */
function dependencyNode(s: Stage, row: number, name: string) {
  for (const x of [7, 8]) s.set(x, row, 'code');
  chip(s, name, 10, row + 0.1, `dim dep-label-${row}`);
}

async function dependencyLink(s: Stage, row: number, name: string) {
  // 先画连线，再出现对应节点；已有节点保留原位。
  s.put('pipe vertical', 7.9, row - 2, '', 0.2, 2);
  chip(s, '依赖', 9, row - 1.6, 'dim');
  await s.wait(550);
  dependencyNode(s, row, name);
  await s.wait(400);
}

export const scenes: Record<Scene, (s: Stage) => Promise<void>> = {
  async world(s) {
    await buildGround(s);
    const p = player(s, 3);
    s.pulse(p);
  },

  async observe(s) {
    const scan = s.put('scan', 0, 0, '', COLS, GROUND);
    await s.wait(700);
    scan.remove();
    s.put(
      'hud',
      9.5,
      0.4,
      '<span>位置</span><span>朝向</span><span>物品</span><span>准星目标</span>',
      6,
      3,
    );
    s.put('cross', 7.5, 2.5, '+');
  },

  async input(s) {
    const keys = s.put('keys', 0.4, 0.4, '<kbd>W</kbd><kbd>空格</kbd><kbd>鼠标</kbd>', 6, 1);
    const p = player(s, 3);
    const kb = keys.querySelectorAll('kbd');
    for (let x = 3; x <= 8; x++) {
      kb.forEach((k, i) => k.toggleAttribute('data-on', i === 0 || (x === 6 && i === 1)));
      s.move(p, x, x === 6 ? GROUND - 3 : GROUND - 2);
      await s.wait(260);
    }
    kb.forEach((k, i) => k.toggleAttribute('data-on', i === 2));
    s.set(10, GROUND, 'code');
    await s.wait(300);
    kb.forEach((k) => k.removeAttribute('data-on'));
  },

  async shot(s) {
    const f = s.put('flash', 0, 0, '', COLS, ROWS);
    await s.wait(260);
    f.remove();
    s.put('thumb', 12.2, 4.2, '<em></em>', 3.2, 1.8);
  },

  async py(s) {
    const code = s.put('codeblk', 12, 0.3, '', 1, 1);
    await s.wait(200);
    for (const [x, y] of [
      [11, 1.5],
      [10, 3],
      [9, 4.6],
    ]) {
      s.move(code, x, y);
      await s.wait(220);
    }
    code.remove();
    s.set(9, GROUND, 'seam');
    await s.wait(300);
    s.set(9, GROUND, 'play');
    chip(s, 'value', 8.2, 4.3, 'val');
  },

  async reload(s) {
    for (let x = 9; x <= 13; x++) {
      s.set(x, GROUND, 'code');
      await s.wait(60);
    }
    await s.wait(220);
    for (let x = 9; x <= 13; x++) {
      s.set(x, GROUND, 'seam');
      await s.wait(60);
    }
    for (let x = 9; x <= 13; x++) s.set(x, GROUND, 'play');
    chip(s, '不重启游戏', 9, 7.4, 'ok');
    const p = player(s, 8);
    s.pulse(p);
  },

  async project(s) {
    dependencyNode(s, 1, '商店玩法');
  },

  async add(s) {
    await dependencyLink(s, 4, '经济组件');
  },

  async resolve(s) {
    await dependencyLink(s, 7, 'QuMod');
  },

  async lock(s) {
    chip(s, '固定提交', 0.6, 4.1, 'dim');
    for (const row of [4, 7]) {
      s.put('lock', 5.5, row + 0.1, '');
      await s.wait(400);
    }
  },

  async sync(s) {
    const cache = s.put('cache', 0.6, 0.4, '队友同步', 4, 1);
    for (const row of [1, 4, 7]) {
      const label = s.find(`dep-label-${row}`);
      if (label) s.pulse(label);
      for (const x of [7, 8]) s.set(x, row, 'seam');
      await s.wait(300);
      for (const x of [7, 8]) s.set(x, row, 'code');
    }
    s.pulse(cache);
  },

  async zip(s) {
    for (const x of [7, 8])
      for (const y of [1, 4, 7]) {
        if (s.get(x, y) === 'code') s.set(x, y, 'seam');
      }
    await s.wait(300);
    s.clear();
    const bp = s.put('pack bp', 3, 3, '_bp', 3, 2);
    const rp = s.put('pack rp', 7, 3, '_rp', 3, 2);
    await s.wait(500);
    s.move(bp, 5.5, 3);
    s.move(rp, 6.5, 3);
    await s.wait(350);
    bp.remove();
    rp.remove();
    s.put('zipbox', 5, 2.4, 'ZIP', 4, 3);
    chip(s, 'dist/&lt;name&gt;-&lt;version&gt;.zip', 4.4, 6.2, 'ok');
  },

  async hooks(s) {
    const names = ['before_build', 'before_package', 'before_run', 'before_archive'];
    for (let i = 0; i < names.length; i++) {
      chip(s, names[i], 0.6 + (i % 2) * 7.6, 1 + Math.floor(i / 2) * 1.6, 'hook');
      await s.wait(160);
    }
    chip(s, '串行执行 · 失败即中断', 0.6, 4.6, 'dim');
  },

  async hook(s) {
    s.clear();
    const steps = ['before_build', '组装', '构建产物'];
    steps.forEach((t, i) => s.put('tl', 1 + i * 5, 0.3, t, 4, 1));
    const tl = s.layer.querySelectorAll<HTMLElement>('.tl');
    const sheet = s.put('sheet', 1.4, 3, '<i></i><i></i><i></i>', 2, 2);
    s.put('shop', 6.5, 2.6, '脚本', 3, 2.8);
    tl[0].dataset.on = '';
    await s.wait(500);
    s.move(sheet, 7, 3);
    await s.wait(500);
    sheet.remove();
    const json = s.put('json', 7.3, 3.2, '{ }', 2, 2);
    await s.wait(300);
    tl[1].dataset.on = '';
    s.move(json, 11.5, 3.2);
    await s.wait(450);
    json.remove();
    for (let x = 11; x <= 14; x++) for (let y = 4; y <= 6; y++) s.set(x, y, y === 4 ? 'play' : 'dirt');
    tl[2].dataset.on = '';
    chip(s, '脚本失败会中断本次构建', 0.6, 7.4, 'dim');
  },

  async connect(s) {
    s.put('server', 11, 1, 'Nukkit', 3, 5);
    const a = s.put('client c1', 1, 1, '<em>&gt;_</em>client1', 3, 2);
    const b = s.put('client c2', 1, 4.5, '<em>&gt;_</em>client2', 3, 2);
    await s.wait(300);
    for (const [el, y] of [
      [a, 2],
      [b, 5.5],
    ] as const) {
      const beam = s.put('beam', 4, y, '', 7, 0.18);
      await s.wait(350);
      beam.dataset.on = '';
      s.pulse(el);
    }
  },

  async group(s) {
    s.layer.querySelectorAll<HTMLElement>('.beam').forEach((b) => (b.dataset.ok = ''));
    await s.wait(300);
    chip(s, 'connection_verified=true', 4.2, 7.4, 'ok');
  },

};
