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

  /** 清空舞台，并取消正在进行的动画 */
  reset() {
    this.token++;
    this.clear();
  }

  /** 只清空画面（场景内部换景用） */
  clear() {
    this.cells.forEach((c) => (c.dataset.s = 'empty'));
    this.layer.replaceChildren();
  }

  set(x: number, y: number, s: Cell) {
    const c = this.cells[y * COLS + x];
    if (c) c.dataset.s = s;
  }

  get(x: number, y: number) {
    return this.cells[y * COLS + x]?.dataset.s as Cell | undefined;
  }

  /** 等待；被新的播放打断时抛出，瞬间模式直接返回 */
  async wait(ms: number) {
    if (this.instant) return;
    const t = this.token;
    await new Promise((r) => setTimeout(r, ms));
    if (t !== this.token) throw new Error('cancelled');
  }

  /** 在格子坐标处放一个叠加元素 */
  put(cls: string, x: number, y: number, html = '', w = 1, h = 1) {
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
    el.style.setProperty('--x', String(x));
    el.style.setProperty('--y', String(y));
  }

  find(cls: string) {
    return this.layer.querySelector<HTMLElement>(`.${cls}`);
  }

  /** 短暂闪光一个元素或格子 */
  pulse(el: HTMLElement) {
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

/** 开发侧小项目：主项目方块组 */
function project(s: Stage) {
  for (const [x, y] of [
    [2, 4],
    [3, 4],
    [2, 5],
    [3, 5],
    [2, 6],
    [3, 6],
  ])
    s.set(x, y, 'code');
  if (!s.find('lbl-main')) chip(s, '主项目', 1.6, 7.3, 'lbl-main dim');
}

async function dep(s: Stage, x: number, name: string, cls: string) {
  for (let y = 0; y <= 5; y++) {
    if (y > 0) s.set(x, y - 1, 'empty');
    s.set(x, y, 'code');
    await s.wait(55);
  }
  s.set(x, 6, 'code');
  s.put(`pipe ${cls}`, 4, 5.4, '', x - 4, 0.2);
  chip(s, name, x - 0.6, 7.3, `${cls} dim`);
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

  async add(s) {
    project(s);
    await s.wait(150);
    await dep(s, 7, 'QuMod', 'p1');
  },

  async lock(s) {
    await dep(s, 11, 'shared', 'p2');
    s.put('lock', 11.6, 4.1, '');
    chip(s, 'SHA', 12.2, 3.2, 'dim');
  },

  async sync(s) {
    for (const x of [7, 11]) for (let y = 0; y <= 6; y++) s.set(x, y, 'empty');
    s.layer.querySelectorAll('.pipe').forEach((e) => e.classList.add('off'));
    const cache = s.put('cache', 8, 0.2, '缓存', 3, 1);
    await s.wait(500);
    s.layer.querySelectorAll('.pipe').forEach((e) => e.remove());
    s.layer.querySelectorAll('.chip.p1, .chip.p2').forEach((e) => e.remove());
    s.layer.querySelectorAll('.lock').forEach((e) => e.classList.add('settle'));
    await Promise.all([dep(s, 7, 'QuMod', 'p1'), dep(s, 11, 'shared', 'p2')]);
    s.pulse(cache);
  },

  async zip(s) {
    const cols = [2, 3, 7, 11];
    for (const x of cols)
      for (let y = 4; y <= 6; y++) {
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
    chip(s, '0.5.0+ · before_archive 0.5.3+', 0.6, 4.6, 'dim');
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

  async twin(s) {
    s.put('win', 0.2, 0.2, '<em>Windows</em>', 7.4, 8.6);
    s.put('win', 8.4, 0.2, '<em>Apple Silicon macOS</em>', 7.4, 8.6);
    await Promise.all([buildGround(s, 1, 6), buildGround(s, 9, 14)]);
    s.put('player', 3, GROUND - 2, '<b></b><b></b><b></b>', 1, 2);
    s.put('player', 11, GROUND - 2, '<b></b><b></b><b></b>', 1, 2);
  },
};
