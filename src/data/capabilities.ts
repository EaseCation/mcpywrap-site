// 星球能力徽章：Hero 3D 与静态降级共用。
// 文案出处见 plan/HIGHLIGHTS_BREAKDOWN.md（括号内为章节号）。
export type Side = 'dev' | 'seam' | 'play' | 'sat';

export interface Capability {
  id: string;
  name: string;
  side: Side;
  summary: string;
  command: string;
  /** 首页对应区块锚点 */
  href: string;
}

export const capabilities: Capability[] = [
  // 开发半球
  {
    id: 'cli',
    name: 'CLI / JSON',
    side: 'dev',
    summary: '25 个公开命令，统一 --json 与退出码，AI 可直接调用。', // 2.1
    command: 'mcpy --non-interactive run --no-gui --detach --json',
    href: '#more',
  },
  {
    id: 'deps',
    name: '依赖与 QuMod',
    side: 'dev',
    summary: '在 pyproject.toml 声明依赖，Git 依赖锁定提交，克隆后 sync 即恢复。', // 2.2
    command: 'mcpy add --qumod',
    href: '#deps',
  },
  {
    id: 'scripts',
    name: '生命周期脚本',
    side: 'dev',
    summary: '构建、打包、启动前自动运行项目自己的资源生成脚本（0.5.0+）。', // 2.4
    command: 'mcpy script list',
    href: '#scripts',
  },
  {
    id: 'package',
    name: '构建与打包',
    side: 'dev',
    summary: '主项目与全部依赖按规则合并资源，生成可发布 ZIP。', // 2.3
    command: 'mcpy package',
    href: '#more',
  },
  // 交界线
  {
    id: 'runtime',
    name: '游戏内 Python',
    side: 'seam',
    summary: '不重启游戏，在客户端或服务端执行 ModSDK 代码并热更模块。', // 2.7
    command: 'mcpy runtime py --side server --file check.py --json',
    href: '#ai',
  },
  {
    id: 'input',
    name: '统一输入',
    side: 'seam',
    summary: '观察画面状态，提交 JSON 计划，让 AI 像玩家一样走路、攻击、点 UI。', // 2.8
    command: 'mcpy runtime input observe',
    href: '#ai',
  },
  {
    id: 'capture',
    name: '截图录屏',
    side: 'seam',
    summary: '后台截取游戏画面，被遮挡也能截；Windows 还可录屏和逐帧提取。', // 2.9
    command: 'mcpy screenshot --background-only --output shot.png --json',
    href: '#ai',
  },
  // 游玩半球
  {
    id: 'worlds',
    name: '本地世界',
    side: 'play',
    summary: '世界保留进度，重新运行就用当前代码；多个测试世界可以并存。', // 2.5
    command: 'mcpy run --new --world-type flat --seed 12345',
    href: '#more',
  },
  {
    id: 'server',
    name: '连接服务器',
    side: 'play',
    summary: '连接指定服务器，方便 Nukkit 等服务端开发做自动化验证。', // 2.10
    command: 'mcpy connect <host> --port 19132 --detach --json',
    href: '#server',
  },
  {
    id: 'clients',
    name: '双客户端',
    side: 'play',
    summary: '两名玩家进入同一世界，验证多人同步（0.5.0+）。', // 2.11
    command: 'mcpy connect <host> --port 19132 --clients 2',
    href: '#server',
  },
  // 卫星
  {
    id: 'windows',
    name: 'Windows',
    side: 'sat',
    summary: '自动发现 MC Studio 引擎，可在 MC Studio 编辑器中打开项目。', // 2.5 / 2.14
    command: 'mcpy run',
    href: '#macos',
  },
  {
    id: 'macos',
    name: 'macOS',
    side: 'sat',
    summary: 'Apple Silicon Mac 原生运行本地 Addon 世界，首次运行自动准备资源。', // 2.6
    command: 'mcpy run',
    href: '#macos',
  },
];

export const sideLabel: Record<Side, string> = {
  dev: '开发',
  seam: '连接',
  play: '游玩',
  sat: '平台',
};
