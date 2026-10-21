---
title: 统一输入
description: 用一份 JSON 计划在游戏内模拟按键、玩家动作和 UI 交互，并查询、取消与清理输入操作。
sidebar:
  order: 2
---

统一输入让你用一份 JSON 计划驱动游戏：单键、组合键、串行步骤和重叠输入都写在同一个 `steps` 列表里，通过 `runtime input run` 提交。默认在游戏内执行，不抢系统焦点。

## 快速上手

游戏加载后，先显式执行一次 `runtime install`，安装或更新输入、UI 和玩家适配。能力查询和观察不会自动安装。

```sh
mcpy --local --project <项目> runtime install --session <sid> --json
mcpy --local --project <项目> runtime input capabilities --session <sid> --json
mcpy --local --project <项目> runtime input observe --session <sid> --json
```

写一份计划 `plan.json`：

```json
{
  "schema_version": 1,
  "steps": [
    {"action": "key_down", "key": "W", "at_ms": 0},
    {"action": "player.attack", "at_ms": 200},
    {"action": "key_down", "key": "SPACE", "at_ms": 300},
    {"action": "key_up", "key": "SPACE", "at_ms": 450},
    {"action": "key_up", "key": "W", "at_ms": 600}
  ]
}
```

提交、查询、取消和停止：

```sh
mcpy --local --project <项目> runtime input run --session <sid> --file <plan.json> --request-id <32位小写hex> --json
mcpy --local --project <项目> runtime input status --session <sid> --operation <operation_id> --details --json
mcpy --local --project <项目> runtime input cancel --session <sid> --operation <operation_id> --json
mcpy --local --project <项目> runtime input stop --session <sid> --json
```

计划顶层必须包含 `"schema_version": 1` 和 `steps`。远程执行时把全局路由换成 `--remote <Windows endpoint>`，计划文件仍在调用端读取。

## 观察游戏状态

`capabilities` 返回动作注册表：每个动作的参数 schema、默认值、完成方式以及 supported/reason；`keys` 列出当前引擎可表达的键。不要只按 CLI 版本推断运行包能力。计划中有不支持的动作时，整份计划在预检阶段就被拒绝，前面合法的步骤也不会执行。

`observe` 的返回内容取决于当前界面：

- 在 HUD：玩家位置、方向、物品、准星目标及快照；
- 在菜单：紧凑的语义 UI 树、节点和快照。

可以用 `--view player|ui` 显式选择；UI 视图支持 `--query`、`--limit`、`--offset`、`--details`。快照中的有效目标、节点角色和 `allowed_actions` 可以帮助构造计划。HBUI 的节点不可读，此时可用键盘导航，或用 [截图](/wiki/runtime/capture/) 观察。

## 动作一览

完整字段以 `capabilities` 返回的注册表为准，常用动作如下：

| 动作 | 参数 | 完成语义 |
|---|---|---|
| `key` | `keys:["CTRL","W"]`、`duration_ms:500` | 按数组顺序按下，保持实际时长后逆序释放，再继续 |
| `key_down` / `key_up` | `key:"W"` | 提交一个边沿后继续；键由整个计划持有，必须配对 |
| `wait` | `duration_ms:100` | 实际执行到该步骤后开始等待 |
| `player.move` | forward/right、sprint、duration_ms | 锁定移动向量，完成后确认释放；不能与已持有的方向键争用同一输入 |
| `player.look` / `look_at` | pitch/yaw 或 x/y/z | 修改并核对朝向，不是原始鼠标移动 |
| `player.select_slot` | `slot:1`（1–9） | 选择快捷栏，不是数字键或滚轮事件 |
| `player.jump` / `sneak` | jump 无持续参数；sneak 有 duration_ms | 语义跳跃或潜行，不是 SPACE/SHIFT 边沿 |
| `player.attack` / `dig` | attack 瞬时；dig 有 duration_ms | 每步重新观察准星与距离，走真实客户端动作路径 |
| `player.use_item` / `eat` / `shoot` | mode 与 duration_ms | 保留目标/物品守卫及实际使用、释放流程 |
| `ui.click` / `slide` | node、snapshot；click 可带 keys；slide 用 fraction | 针对当前快照中单个节点的交互，按角色预检，自动抬起 |
| `ui.scroll` | node、snapshot、percent | 设置滚动容器百分比，不是原始滚轮边沿 |
| `ui.set_control_value` | node、snapshot、value | 只给控件赋值，不代表键入、IME 或提交 |
| `pointer.down/up/move/relative/wheel` | button、x/y、dx/dy 或 delta | 原始设备输入，首版仅显式的 `windows-sendinput` 后端支持 |

步骤统一使用 `action`、`at_ms`、`delay_ms`、`duration_ms` 字段。JSON 中组合键必须写成有序数组；只有命令行快捷方式允许 `CTRL+W` 这样的字符串：

```sh
mcpy runtime input key "CTRL+W" --duration-ms 500 --session <sid> --json
```

它生成的计划与 `{"action":"key","keys":["CTRL","W"],"duration_ms":500}` 相同，走同一个 run。修饰键不会自动排序，`["W","CTRL"]` 和 `["CTRL","W"]` 的提交顺序不同。同一时刻的多个步骤严格按列表顺序执行，不保证原子性。

## 时间规则

- 省略 `at_ms` 时，步骤开始于前一步的**计划结束**时刻加上 `delay_ms`（默认 0）。
- 显式 `at_ms` 不能早于前一步的计划结束；`at_ms` 和 `delay_ms` 在同一步互斥。规范化后只保留 `at_ms`。
- 每个动作的 `duration_ms` 计入计划预留；瞬时边沿的名义时长为 0，持键区间不会阻塞其他边沿或语义步骤。

实际执行时，一个步骤要同时满足计划时刻和前一步已完成。完成型 `key` 的持续时间从实际按下后计算，`wait` 从实际执行时计算。前一步迟到可能抵消计划中的空隙，所以 `delay_ms` 不能保证实际停顿，需要真实等待时请插入 `wait`。原始 `key_down` / `key_up` 迟到可能压缩持键时长，结果会记录实际时间。

默认后端 `game` 从首个可用的客户端调度点起算，使用经过确认的单调毫秒时钟，没有 tick 模式。`max_lateness_ms` 默认为 null，迟到继续执行；设为非负整数时，超限即中止。

## 目标断言与 UI 计划

玩家步骤可以附带断言，执行到该步时重新观察并核对：

```json
{"expect": {"selected_slot": 1, "item": "minecraft:bow", "target": {"type": "Entity", "entityId": "..."}}}
```

攻击和物品动作会自动绑定当前快照，不提交陈旧的观察对象。

首版每份 UI 计划只能有一个 `ui.*` 节点动作，绑定刚取得的 node/snapshot；页面变化后要重新 `observe`，不支持跨页选择器或条件脚本。`ui.click` 可以带 CTRL/SHIFT/ALT 修饰键，按数组顺序按下，节点动作完成后逆序释放。

页面变化是单个 UI 交互允许的结果；而普通键盘/玩家计划遇到页面变化会停止后续步骤并清理输入（包括打开聊天或菜单的键）。菜单页面允许键盘操作，`player.*` 只能在 HUD 使用。

## 操作 ID 与结果

- `operation_id` 标识一次输入操作；你传入的 `request_id` 用于幂等，目前与 `operation_id` 同值。
- 未传 `request_id` 会自动生成并返回。超时时返回原 ID，请用它查询，不要换新 ID 盲目重发。
- 相同 ID 加相同的规范化计划返回原操作；相同 ID 加不同计划会被拒绝。
- `transport.request_id` 是传输层 ID，不能用来查询输入操作。
- 历史只保留最近 64 条，找不到记录不代表从未执行。

`status` 默认返回摘要；`--details` 返回规范化计划、每步实际开始/结束时间、输入事件和清理事件。`completed` / `accepted` 只说明控制流程完成，结果中始终是 `effect_verified=false`，位置、伤害、物品消耗或 UI 变化需要再观察确认。按键释放也不证明潜行或疾跑状态已改变。

## 并发、取消与清理

每份计划独占会话的写操作，等待期间也保持 busy，但允许 `observe` 和 `status`。无法可靠识别人工同时按住的键，验收应在没有人同时操作的专用会话中进行。

取消、失败、世界或界面失效、卸载和超时时，系统都会尝试释放子动作和本计划持有的输入。释放失败时返回 `unknown` 和 `unconfirmed_release_keys`，并保持 busy；排除问题后用 `runtime input stop` 重试，不要重放计划。`runtime input stop` 不会退出游戏，顶层 `mcpy stop` 才结束会话。

游戏不推进或调试通道无法处理命令时，查询、取消和释放可能延后，返回 `unknown` / `unavailable`。Windows worker 的 cancel/stop 可能先返回 `cancel_requested`，请继续查询原操作直到终态。

## Windows 设备后端

需要原始设备输入时，在计划顶层显式设置 `"backend": "windows-sendinput"`，仍使用同一套 run/status/cancel 协议。它支持 `key`、边沿、`wait` 和 `pointer.*`，不执行 `player.*` 或 `ui.*`。执行器由目标会话的 worker 持有，远程时不会在调用端操作设备。

- 原始指针计划需提供 `width` / `height` 作为参考客户区；移动、滚轮和点击会核验窗口尺寸和焦点/遮挡。
- 该后端会激活并占用游戏前台，不承诺 0–20ms 硬实时。
- 普通 `game` 后端不会把 RCTRL 悄悄映射为 CTRL，也不会把 NUMPAD_ENTER 映射为 ENTER；具体支持的键以 `capabilities` 为准。

## 在游戏内 Python 中调用

临时调试时，可以在 `runtime py` 中调用对应方法：

```python
observation = mcpy.input.observe()
operation = mcpy.input.run(plan, request_id=request_id)
result = mcpy.input.status(operation['operation_id'], details=True)
```

`mcpy.input.key(keys, duration_ms=80)` 只是生成并运行计划。游戏内 Python 方法会拒绝 Windows 设备后端。注入的 `mcpy.*` 仅用于临时调试，业务 Addon 不能依赖它。

## 限制与注意

- 首版上限：最多 256 步、计划 120 秒、执行 125 秒、规范化 JSON 16KiB。
- 单个 game 持续动作 20–10000ms，`wait` 0–10000ms。
- 计划结束时所有边沿必须配对，重复持有同一个键会被拒绝。
- 日志总预算 64KiB，丢失情况由 `logs_truncated` 和每类 dropped 计数报告；日志不完整时不能视为精确验证通过。
- macOS 使用同一游戏协议，时钟能力取决于实例固定的原生包。出现 `missing_monotonic_clock` 时按 [macOS 平台](/wiki/local/macos/) 升级并新建实例；pointer/text 缺能力时会明确拒绝。
- 计划字段不使用 `events`、`type`、`at`、`clock`、`hold_ms`，JSON 中也不接受 `keys:"CTRL+W"`。
