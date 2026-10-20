---
title: 双客户端
description: 在本机同时启动两个客户端，联调同一本地世界或同一外部服务器上的两名玩家。
sidebar:
  order: 2
---

> 适用于 mcpywrap 0.5.4。

双客户端用于在 Windows 或 Apple Silicon macOS 本机联调两名玩家。两个客户端组成一个"组"，可以统一查询状态、看日志、热更代码和停止。

动手前先确认已安装的 CLI 真的支持：查看 `doctor --capabilities` 和命令帮助里是否有 `--clients`、`--group`。不要只凭文档或 Skill 版本推断。

## 选择任务

| 想做的事 | 用法 |
|---|---|
| 同一个本地世界里两名玩家 | `run --clients 2`。第一名玩家是主机，第二个客户端加入主机。加 `--new` 表示新建世界 |
| 两个客户端进入同一外服 | `connect <host> --port <port> --clients 2`。服务器须允许无认证开发客户端；工具不部署或修改外部服务器的 Mod |
| 两个独立世界 | 分别运行指定实例。同一份代码可以共享，运行中改了依赖要先退出相关世界再重新运行 |

`run --clients 2` 得到的不是两个独立世界，也不是历史代码快照。

### 平台支持

- 本地主客机需要 `local-dual-client-manual` 能力，目前由 Windows 后端提供。macOS 运行包尚未完成同等适配，会在启动前拒绝本地双客户端。
- 外服双客户端按运行包的独立身份能力判断，不由本地主客机是否支持来推断。macOS 双外服需要支持独立开发身份的原生运行包，旧运行包会明确拒绝。

:::caution
双客户端入口仅用于 `--local`。`--remote` 仍只支持单会话，不支持时不会回退到本机。双客户端暂不提供两个真实账号登录，也不要反复复用同一 MCS 身份去绕过服务器的登录限制。
:::

## 快速上手

全局参数都放在子命令之前：

```sh
# 本地世界：主机 + 客机
mcpy --local --project <项目目录> --non-interactive run --clients 2 --no-gui --detach --json

# 同一外服：两个客户端
mcpy --local --project <会话目录> --non-interactive connect <服务器> --port 19132 --clients 2 --detach --json
```

先保存返回的 `group` 和 `members`，再看 `ok`。部分失败时主机可能已经启动，不要丢掉它的会话 ID 或重新创建另一个世界。

### 组角色

| 组类型 | 角色 | 能力 |
|---|---|---|
| 本地组 | `host`、`guest` | 主机还有服务端执行能力；客机只有客户端能力 |
| 外服组 | `client1`、`client2` | 只有客户端能力 |

每个成员都有自己的 `session`。不同客户端的实体 ID 可能重复，选择操作对象时按组角色、会话 ID 和返回的玩家名称，不要跨客户端复用实体 ID。

## 本地主客机：手动加入

本地主客机采用手动加入。工具启动主机和客户端 2 后返回 `waiting_for_join`，这不是启动失败，而是在等你操作：

1. 在客户端 2 选择"开始游戏"。首次菜单若只有"开始"和"更多选项"，先选"更多选项"进入正常菜单。
2. 点击提示中目标名称的"局域网世界"卡片，不要打开同名的本地存档。
3. 按需下载资源后加入。

工具会自动核验加入结果。没点卡片不需要重启客户端；加入了错误的世界时，先退出该世界，再选择指定主机。不要猜测本地联机端口，也不要另开独立世界来代替第二名玩家。

## 确认联机成功

```sh
mcpy --local --project <项目目录> status --group <组ID> --json
mcpy --local --project <项目目录> runtime capabilities --group <组ID> --json
mcpy --local --project <项目目录> logs --group <组ID> --source game --tail 100 --json
```

`running` 只说明进程阶段。只有 `connection_verified=true` 才表示已确认两个不同玩家加入同一世界，但这仍不证明玩法正确。建议在两个客户端分别执行一次验收脚本，并在主机服务端核对玩家列表或权威状态。两个窗口、两张 HUD 截图不能代替联机验证。

冷启动等待超时后，游戏可能仍在加载。先用 `status --group` 重新核验；两名玩家已经就绪的话不必重开。

:::tip
用 `scripts/smoke.py --game --clients 2` 验收时仍需人工点击卡片，可以用 `--timeout` 留出操作和加载时间，例如 600 秒。验收脚本结束会清理本次创建的游戏；日常需要保留会话时使用普通的 run / status 流程。
:::

## 明确操作对象

Python、输入、截图等操作都要指定具体成员的 `--session`，不会自动广播：

```sh
mcpy --local --project <项目目录> runtime py --session <主机会话> --side server --file <服务端验收.py> --json
mcpy --local --project <项目目录> runtime py --session <客机会话> --side client --file <客户端验收.py> --json
```

执行前查询目标成员的能力，不要对客机发送服务端脚本。切换玩家后使用新的会话 ID。结果与未知请求的处理见 [运行时调试](/wiki/runtime/debug/)，玩家与 UI 动作见 [统一输入](/wiki/runtime/input/)，画面采集见 [截图与录屏](/wiki/runtime/capture/)。

## 更新代码

普通源码变化可以按组热更：

```sh
mcpy --local --project <项目目录> runtime reload python --group <组ID> --module MyMod.client.logic --side client --json
mcpy --local --project <项目目录> runtime reload python --group <组ID> --module MyMod.server.logic --side server --json
mcpy --local --project <项目目录> runtime watch --group <组ID> --side client
```

- `client` 更新两名玩家的客户端；`server` 只更新主机服务端一次。
- `both` 只用于确认可在两端执行的公共模块，不要用它来猜端侧。
- 逐项检查每个成员、每个端侧的结果。部分失败或未知不等于整组成功，也不要自动重复执行有副作用的脚本。
- 依赖增删、包身份或目录结构改变后，保存进度并重新运行整组。
- 停止 watch 只停止监控，不退出游戏；关闭管理面板也会保留游戏。`runtime watch` / `reload` 不执行项目预处理，脚本的执行时机见 [项目脚本](/wiki/project/scripts/)。

:::caution
当前组资源热更明确不支持（`resource_sync_unverified`）。UI、粒子等资源不能通过主机单会话入口绕过；需要应用资源时重启整组并重新加入。外服组不管理服务器提供的代码和资源，不要对它使用本地组热更。
:::

## 重试与退出

```sh
mcpy --local --project <项目目录> restart --session <失败客机会话> --json
mcpy --local --project <项目目录> restart --group <组ID> --json
mcpy --local --project <项目目录> stop --session <客机会话> --json
mcpy --local --project <项目目录> stop --group <组ID> --json
```

- 重启后重新保存返回的会话 ID，旧 ID 只用于查历史。
- 客机失败时优先重试客机，不必重建主机世界。主机有关联客机时，停止或重启整个组；工具会先处理客机，再处理主机。
- 同一联调组的玩家身份会保留。主机代码或依赖改变后，客机重新加入时可能需要再次下载资源；不要手动清理全局包或修改运行记录。
- 客机重试会加入主机当前已加载的版本，源码改动是否已应用要另看提示；要应用依赖变化就重启整个组。

## 限制与注意

- 只结束自己启动或用户明确指定的会话。接管已有组用于观察，并不自动获得退出其中所有游戏的授权。
- 重要世界先在游戏里保存。Windows 上进程退出本身不保证新增内容已存档。
- 响应丢失时先用 `status --list --json` 找回组与成员；脚本结果为 `unknown` 时先检查原请求和日志，不要盲目重发。
- 常见错误码（`waiting_for_join`、`group_not_ready`、`partial` 等）的处理见 [故障排查](/wiki/reference/troubleshooting/)。
