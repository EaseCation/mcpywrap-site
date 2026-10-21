// 命令演示脚本。命令与返回字段均取自 mcpywrap 的 skills/mcpywrap/references（src 标注出处）。
// show：终端里显示的简写；copy：复制按钮复制的完整命令。
// fields：面板上亮起的真实标识（返回字段名、配置键或环境变量），不伪造值。
export type Scene =
  | 'world'
  | 'observe'
  | 'input'
  | 'shot'
  | 'py'
  | 'reload'
  | 'project'
  | 'add'
  | 'resolve'
  | 'lock'
  | 'sync'
  | 'zip'
  | 'hooks'
  | 'hook'
  | 'connect'
  | 'group';

export interface Step {
  tab: string;
  /** 命令处理过程可以拆成多个阶段；后续阶段保留前一条命令。 */
  show?: string;
  copy?: string;
  phase?: string;
  hold?: number;
  note: string;
  fields: string[];
  scene: Scene;
  src: string;
}

export interface Demo {
  id: string;
  title: string;
  steps: Step[];
}

const P = 'mcpy --local --project <项目> --non-interactive';

export const demos: Record<string, Demo> = {
  ai: {
    id: 'ai',
    title: 'AI 自主测试闭环',
    steps: [
      {
        tab: '启动',
        show: 'mcpy run --no-gui --detach --json',
        copy: `${P} run --no-gui --detach --json`,
        note: '启动本地世界并立即返回会话，后续命令复用同一个 session。',
        fields: ['session', 'instance', 'world_ready'],
        scene: 'world',
        src: 'S:local-development',
      },
      {
        tab: '观察',
        show: 'mcpy runtime input observe --session <sid> --json',
        copy: 'mcpy --local --project <项目> runtime input observe --session <sid> --json',
        note: 'HUD 下返回玩家位置、朝向、物品和准星目标；菜单下返回语义 UI 树。',
        fields: ['snapshot', 'allowed_actions'],
        scene: 'observe',
        src: 'S:runtime-input',
      },
      {
        tab: '操作',
        show: 'mcpy runtime input run --session <sid> --file plan.json --json',
        copy: 'mcpy --local --project <项目> runtime input run --session <sid> --file plan.json --json',
        note: '提交 JSON 输入计划：走路、视角、攻击、点 UI。completed 只代表流程完成，效果要再观察。',
        fields: ['operation_id', 'completed', 'effect_verified=false'],
        scene: 'input',
        src: 'S:runtime-input',
      },
      {
        tab: '截图',
        show: 'mcpy screenshot --session <sid> --background-only --output shot.png --json',
        copy: `${P} screenshot --session <sid> --background-only --output shot.png --json`,
        note: '后台截取游戏内容区，不抢前台；窗口被遮挡也能截。',
        fields: ['image', 'capture'],
        scene: 'shot',
        src: 'S:capture',
      },
      {
        tab: '断言',
        show: 'mcpy runtime py --session <sid> --side server --file check.py --json',
        copy: `${P} runtime py --session <sid> --side server --file check.py --json`,
        note: '在游戏服务端执行 ModSDK Python，读回业务状态做断言。',
        fields: ['stdout', 'value', 'error'],
        scene: 'py',
        src: 'S:runtime-debug',
      },
      {
        tab: '热更',
        show: 'mcpy runtime reload python --session <sid> --module MyMod.server.logic --side server --json',
        copy: 'mcpy --local --project <项目> runtime reload python --session <sid> --module MyMod.server.logic --side server --json',
        note: '不重启游戏替换模块；已有对象和回调不会重建，改结构时重新部署并重载世界。',
        fields: ['ok'],
        scene: 'reload',
        src: 'S:runtime-debug',
      },
    ],
  },
  deps: {
    id: 'deps',
    title: '示例：给商店玩法备齐前置',
    steps: [
      {
        tab: '商店玩法',
        phase: '从正在开发的玩法项目开始',
        note: '这是你的商店玩法项目，负责商品和购买流程。接下来为它加入提供金币功能的经济前置组件。',
        fields: [],
        scene: 'project',
        hold: 2200,
        src: 'S:project-dependencies',
      },
      {
        tab: '加入经济组件',
        show: 'mcpy add --git <经济组件仓库URL> --dep-name economy --json',
        copy: 'mcpy --project <项目> --non-interactive add --git "<经济组件仓库URL>" --dep-name economy --json',
        phase: '添加操作 · 加入直接依赖',
        note: '运行这条命令，把已有的经济组件加入商店项目。先看这一层关系：商店玩法依赖经济组件。',
        fields: ['dependency', 'kind', 'target'],
        scene: 'add',
        hold: 2400,
        src: 'S:project-dependencies',
      },
      {
        tab: '解析 QuMod 前置',
        phase: '同一次添加操作 · 继续解析子依赖',
        note: '示例中的经济组件在配置中声明了 QuMod 依赖。mcpywrap 继续准备这一层前置，无需再手动执行一条添加命令。',
        fields: ['dependency'],
        scene: 'resolve',
        hold: 2400,
        src: 'S:project-dependencies',
      },
      {
        tab: '固定依赖',
        phase: '同一次添加操作 · 记录所用提交',
        note: '将经济组件和 QuMod 所用的代码提交记录到依赖锁文件中，后续同步就能恢复同一套依赖。',
        fields: ['rev'],
        scene: 'lock',
        hold: 2200,
        src: 'S:project-dependencies',
      },
      {
        tab: '队友同步',
        show: 'mcpy sync --json',
        copy: 'mcpy --project <项目> --non-interactive sync --json',
        note: '队友拿到商店项目后运行 sync，就能恢复项目里声明的经济组件和 QuMod，不用逐个找仓库、下载和拷贝。',
        fields: ['synced'],
        scene: 'sync',
        hold: 2200,
        src: 'S:project-dependencies',
      },
      {
        tab: '一起打包',
        show: 'mcpy package --json',
        copy: 'mcpy --project <项目> --non-interactive package --json',
        note: '把商店玩法、经济组件和 QuMod 的代码与资源按规则组装成一个 ZIP，不用发布前再手动拼包。',
        fields: ['artifact'],
        scene: 'zip',
        src: 'S:project-workflow',
      },
    ],
  },
  scripts: {
    id: 'scripts',
    title: '生命周期脚本',
    steps: [
      {
        tab: '查看计划',
        show: 'mcpy script list --json',
        copy: 'mcpy --project <项目> script list --json',
        note: '只读列出项目定义的脚本与钩子，不执行任务。',
        fields: ['[tool.mcpywrap.hooks]'],
        scene: 'hooks',
        src: 'S:project-scripts',
      },
      {
        tab: '构建',
        show: 'mcpy build --json',
        copy: 'mcpy --project <项目> --non-interactive build --json',
        note: '构建前先跑 before_build：策划表变成 JSON，再进入组装。脚本失败会中断构建。',
        fields: ['before_build', 'MCPY_EVENT'],
        scene: 'hook',
        src: 'S:project-scripts',
      },
    ],
  },
  server: {
    id: 'server',
    title: '服务器联调',
    steps: [
      {
        tab: '连接',
        show: 'mcpy connect <服务器> --port 19132 --clients 2 --detach --json',
        copy: 'mcpy --local --project <会话目录> --non-interactive connect <服务器> --port 19132 --clients 2 --detach --json',
        note: '启动两个开发客户端连上你的服务器（例如本机 Nukkit）。',
        fields: ['group', 'members', 'session'],
        scene: 'connect',
        src: 'S:network-sessions, S:dual-clients',
      },
      {
        tab: '组状态',
        show: 'mcpy status --group <组ID> --json',
        copy: 'mcpy --local --project <项目目录> status --group <组ID> --json',
        note: 'connection_verified=true 才表示确认两名不同玩家在同一世界。',
        fields: ['connection_verified'],
        scene: 'group',
        src: 'S:dual-clients',
      },
    ],
  },
};
