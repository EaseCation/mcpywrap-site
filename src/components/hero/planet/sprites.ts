// 字符画 → 像素贴图。用于漂浮的抽象元素（花括号、锁、ZIP、心、准星）。
import * as THREE from 'three';

const PALETTE: Record<string, string> = {
  m: '#70eac0', // 薄荷
  t: '#28b7a6',
  a: '#7dff6a', // 亮绿
  w: '#f1fff9',
  r: '#e8504f', // 心
  k: '#0a1420',
  y: '#f2c94c',
};

export const SPRITES = {
  braces: [
    '.mm....mm.',
    '.m......m.',
    '.m......m.',
    'm........m',
    '.m......m.',
    '.m......m.',
    '.mm....mm.',
  ],
  lock: ['..ttt..', '.t...t.', '.t...t.', 'mmmmmmm', 'mmmkmmm', 'mmmkmmm', 'mmmmmmm'],
  zip: ['wwww.www.www.', '...w..w..w..w', '..w...w..www.', '.w....w..w...', 'wwww.www.w...'],
  heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  crosshair: ['...w...', '...w...', '.......', 'ww...ww', '.......', '...w...', '...w...'],
  pip: ['aaa.', 'a..a', 'aaa.', 'a...', 'a...'],
} as const;

export type SpriteName = keyof typeof SPRITES;

const cache = new Map<SpriteName, THREE.CanvasTexture>();

export function spriteTexture(name: SpriteName) {
  const hit = cache.get(name);
  if (hit) return hit;
  const rows = SPRITES[name];
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = PALETTE[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(name, tex);
  return tex;
}

export function spriteAspect(name: SpriteName) {
  const rows = SPRITES[name];
  return Math.max(...rows.map((r) => r.length)) / rows.length;
}
