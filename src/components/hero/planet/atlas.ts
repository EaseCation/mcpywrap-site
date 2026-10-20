// 8×8 像素贴图图集，Canvas 现画，NearestFilter、无 mipmap。
// 横向排列：0 草顶 · 1 草侧 · 2 泥土 · 3 代码行 A · 4 代码行 B · 5 提示符 >_ · 6 屏幕脸（Agent）
import * as THREE from 'three';
import { hash } from './world';

export const TILE = 8;
export const TILES = 7;

const C = {
  grass: ['#5fb944', '#4ea338', '#6fca52', '#46922f'],
  dirt: ['#8a5a3b', '#7a4e33', '#9b6844', '#6c432b'],
  navy: '#0e1a28',
  navy2: '#13233a',
  mint: '#70eac0',
  teal: '#28b7a6',
  acid: '#7dff6a',
  prompt: '#f1fff9',
};

type Draw = (ctx: CanvasRenderingContext2D, ox: number) => void;

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
};

const noise = (palette: string[], salt: number): Draw => (ctx, ox) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) px(ctx, ox + x, y, palette[Math.floor(hash(x, y, salt) * palette.length)]);
};

const grassSide: Draw = (ctx, ox) => {
  noise(C.dirt, 2)(ctx, ox);
  for (let x = 0; x < TILE; x++) {
    const h = 2 + (hash(x, 9, 3) > 0.6 ? 1 : 0);
    for (let y = 0; y < h; y++) px(ctx, ox + x, y, C.grass[Math.floor(hash(x, y, 4) * 4)]);
  }
};

// 代码行：深蓝底 + 缩进不同的薄荷色短横
const code = (salt: number): Draw => (ctx, ox) => {
  ctx.fillStyle = C.navy;
  ctx.fillRect(ox, 0, TILE, TILE);
  for (let y = 1; y < TILE; y += 2) {
    const indent = Math.floor(hash(y, salt, 1) * 3);
    const len = 2 + Math.floor(hash(y, salt, 2) * (6 - indent));
    for (let x = 0; x < len && indent + x < TILE - 1; x++)
      px(ctx, ox + 1 + indent + x, y, hash(x, y, salt) > 0.75 ? C.acid : x === 0 ? C.mint : C.teal);
  }
};

const prompt: Draw = (ctx, ox) => {
  ctx.fillStyle = C.navy2;
  ctx.fillRect(ox, 0, TILE, TILE);
  // ">"
  [
    [1, 2],
    [2, 3],
    [1, 4],
  ].forEach(([x, y]) => px(ctx, ox + x, y, C.prompt));
  // "_"
  for (let x = 4; x < 7; x++) px(ctx, ox + x, 5, C.acid);
};

// Agent 的屏幕脸：两只像素眼 + 底部提示符
const face: Draw = (ctx, ox) => {
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(ox, 0, TILE, TILE);
  [
    [2, 2],
    [5, 2],
    [2, 3],
    [5, 3],
  ].forEach(([x, y]) => px(ctx, ox + x, y, C.acid));
  px(ctx, ox + 2, 5, C.mint);
  px(ctx, ox + 3, 6, C.mint);
  for (let x = 4; x < 6; x++) px(ctx, ox + x, 6, C.prompt);
};

const draws: Draw[] = [noise(C.grass, 1), grassSide, noise(C.dirt, 2), code(5), code(11), prompt, face];

export function makeAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * TILES;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  draws.forEach((d, i) => d(ctx, i * TILE));
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 单张贴图（Agent 脸等），裁出图集中的一格 */
export function tileTexture(atlas: THREE.Texture, index: number) {
  const t = atlas.clone();
  t.repeat.set(1 / TILES, 1);
  t.offset.set(index / TILES, 0);
  t.needsUpdate = true;
  return t;
}
