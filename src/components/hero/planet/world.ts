// 星球的程序化数据：方块壳、开发/游玩分区、交界线。固定种子，每次生成相同。
export const R = 7; // 半径（格）；直径约 14 格
export type SeamShape = 'line' | 's';

export interface Voxel {
  x: number;
  y: number;
  z: number;
  /** 单位法向（从球心指向方块） */
  n: [number, number, number];
  /** 有符号距离：<0 开发侧，>0 游玩侧，0 附近是交界线 */
  d: number;
  /** 0..1 固定随机数 */
  seed: number;
  /** 开发侧方块浮起的高度（格） */
  hover: number;
  /** 游玩侧的小山丘 */
  hill: boolean;
}

// 简单可复现的哈希
export function hash(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * 交界线：单位方向 → 有符号距离（弧度近似）。
 * line：经线晨昏线（x=0 平面）；s：太极式 S 形，并在两极各放一颗异色"眼"。
 */
/** S 形交界线在 (y, z) 处的 x 偏移；直线为 0 */
export function seamX(y: number, z: number, shape: SeamShape) {
  return shape === 's' ? 0.45 * Math.sin(y * Math.PI) * (z > -0.2 ? 1 : 0.6) : 0;
}

export function seamDistance(n: [number, number, number], shape: SeamShape) {
  const [x, y, z] = n;
  if (shape === 'line') return x;
  // 曲线随高度左右摆动
  let d = x - seamX(y, z, shape);
  // 太极之"眼"：两个小圆反转分区
  const eye = (cx: number, cy: number, cz: number) => Math.hypot(x - cx, y - cy, z - cz) < 0.28;
  if (eye(-0.38, 0.62, 0.68)) d = 0.3;
  if (eye(0.38, -0.62, 0.68)) d = -0.3;
  return d;
}

export function buildWorld(shape: SeamShape): Voxel[] {
  const out: Voxel[] = [];
  const r = R + 0.5;
  for (let x = -R - 1; x <= R + 1; x++)
    for (let y = -R - 1; y <= R + 1; y++)
      for (let z = -R - 1; z <= R + 1; z++) {
        const len = Math.hypot(x, y, z);
        if (len > r || len < r - 1.6) continue;
        const n: [number, number, number] = [x / len, y / len, z / len];
        const d = seamDistance(n, shape);
        const seed = hash(x, y, z);
        out.push({
          x,
          y,
          z,
          n,
          d,
          seed,
          hover: seed > 0.72 ? 0.35 + (seed - 0.72) * 2.4 : 0,
          hill: false,
        });
      }
  // 游玩侧加几座方块山丘（只在外层上方加一格），保持抽象、数量少
  const extra: Voxel[] = [];
  for (const v of out) {
    const len = Math.hypot(v.x, v.y, v.z);
    if (len < r - 0.9 || v.d < 0.25) continue;
    if (hash(v.x + 31, v.y - 17, v.z + 5) > 0.86) {
      const nx = Math.round(v.x + v.n[0]);
      const ny = Math.round(v.y + v.n[1]);
      const nz = Math.round(v.z + v.n[2]);
      if (Math.hypot(nx, ny, nz) > r) extra.push({ ...v, x: nx, y: ny, z: nz, hill: true, hover: 0, seed: hash(nx, ny, nz) });
    }
  }
  const seen = new Set(out.map((v) => `${v.x},${v.y},${v.z}`));
  for (const v of extra) {
    const k = `${v.x},${v.y},${v.z}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

/** 在交界线上取点：返回单位向量，t 为 0..1 的环参数 */
export function seamPoint(t: number, shape: SeamShape): [number, number, number] {
  const a = t * Math.PI * 2;
  // 交界线大致是 x≈0 的大圆，用 y/z 参数化后再按 S 形偏移
  const y = Math.sin(a);
  const z = Math.cos(a);
  const x = seamX(y, z, shape);
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
