// 点击方块时在点击处弹出的命令：按点击位置属于哪一侧挑选。均为 mcpywrap 0.5.4 的真实命令（简写，省略 --project 等全局参数）。
const DEV = ['mcpy build', 'mcpy package', 'mcpy sync', 'mcpy add --qumod', 'mcpy script list'];
const SEAM = ['mcpy runtime reload python --module <模块>', 'mcpy runtime watch --side both', 'mcpy run --no-gui --detach'];
const PLAY = ['mcpy screenshot --background-only', 'mcpy runtime input observe', 'mcpy runtime input run --file plan.json', 'mcpy runtime py --side server'];

const counters = { dev: 0, seam: 0, play: 0 };

/** d：方块到交界线的有符号距离（<0 开发侧，>0 游玩侧） */
export function commandFor(d: number) {
  const side = d < -0.12 ? 'dev' : d > 0.12 ? 'play' : 'seam';
  const pool = side === 'dev' ? DEV : side === 'play' ? PLAY : SEAM;
  return { side, text: pool[counters[side]++ % pool.length] } as const;
}
