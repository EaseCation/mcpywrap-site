---
title: 本地世界
description: 在 Windows/macOS 本机启动、复用、更新和停止测试世界，并设置新世界的种子、地形与游戏规则。
sidebar:
  order: 1
---

> 适用于 mcpywrap 0.5.4。

本地世界是在本机运行游戏、加载当前项目 Addon 的测试世界，Windows 和 macOS 使用同一套命令。本页覆盖单人世界的启动、找回、代码更新、世界设置和停止。两名玩家联调见 [双客户端](/wiki/network/dual-clients/)，连接外部服务器见 [连接服务器](/wiki/network/server/)。

## 快速上手

```sh
# 启动（后台运行，输出 JSON）
mcpy --local --project <项目> --non-interactive run --no-gui --detach --json

# 查询状态、读日志、查会话能力
mcpy --local --project <项目> --non-interactive status --session <sid> --json
mcpy --local --project <项目> --non-interactive logs --session <sid> --source game --tail 100 --json
mcpy --local --project <项目> --non-interactive runtime capabilities --session <sid> --json

# 停止
mcpy --local --project <项目> --non-interactive stop --session <sid> --json
```

启动后先记下返回的 session、instance、config_path 和日志路径。`logs --source` 可选 `game`、`engine`、`worker`；准备脚本的输出在 worker 日志及其 script_log 中。

三个概念要分清：

- 实例（instance）是世界本身；
- session 是一次进程运行；
- group 是联调时的成员关系。

## 判断是否就绪

`status` 返回的 `running` 只代表进程阶段。`world_ready` 表示已经观察到世界就绪；在 macOS 上它表示已观察到 HUD。Mod 是否正常加载，还要看双端日志或业务探针。

`world_ready` 还没到时继续有界地查询。连接可用和脚本系统完成初始化不是同一个状态。要在游戏里执行 Python 或热更，见 [运行时调试](/wiki/runtime/debug/)。

`--no-gui` 只是不打开辅助窗口，游戏本身仍然需要图形会话和 GPU。人工执行 `run` 时默认会出现日志小窗，完整项目页用 `ui` 打开，见 [图形界面](/wiki/local/gui/)。关闭管理窗口或调试窗口不代表游戏已经退出。

## 常见操作

| 想做什么 | 用法与结果 |
|---|---|
| 打开默认世界 | `run`；默认按创建顺序选择可用实例，创建失败的实例不会悄悄变成默认 |
| 打开已有世界 | `run <实例ID前缀> --no-gui --detach --json` |
| 列出世界实例 | `run --list --json`；它和 `status --list --json` 的会话/组列表不同 |
| 新建世界 | `run --new`，参数见下文「新建世界的设置」 |
| 复用已在运行的世界 | 返回 `already_running`，不会重新部署，也不运行 `before_run`；检查 `source_matches` / `hint` |
| 让项目代码重新生效 | 停止相关会话后再 `run` 原实例，或 `restart --session <sid> --json` |
| 启动响应丢失 | 对同一项目用 `status --list` 找回，不要马上再 `--new` 一个 |
| 删除世界 | `run --delete <前缀> --force --json`；只在确实要删除时使用，不是修复启动的手段 |

`restart` 会产生新的 session，世界 ID 保持不变。需要 MCS 身份的会话按提示重新 `run` 并提供本次身份。旧 session 仍可查历史，但不能再向它发送输入。

## 代码部署与世界进度

世界保存的是游戏进度，每次运行使用的是当前项目代码；`--new` 也不会保存旧代码快照。不论依赖有多少，Addon 都会先组装，再通过受控部署交给游戏读取，所以修改源码不等于正在运行的游戏马上能看到新内容。

| 情况 | 怎么做 |
|---|---|
| 没改代码，想开另一个独立世界 | 可以共享同一版部署；同一个实际世界路径仍然独占 |
| 改了代码，但 `run` 接管了已有会话 | 看 `source_matches` / `hint` 判断当前包文件是否一致；接管不会应用新源码 |
| 修改了已加载的 Python 模块 | 按端侧使用 `runtime reload` / `runtime watch`，见 [运行时调试](/wiki/runtime/debug/) |
| 增删依赖、包身份或结构变化 | 停止相关读者后重新 `run`；需要恢复依赖时先 `sync` |
| 另一个世界仍在读同一份部署 | 普通换版或单会话热更可能被拒绝；不能用 `--new`、改 UUID 或清锁来绕过 |
| 运行输出被外部改写、恢复未完成 | 保留文件和诊断信息，先查 `status` / `logs`，见 [故障排查](/wiki/reference/troubleshooting/) |

:::caution
本机世界不会自动保留多个版本做 A/B 部署。独立目录也不代表 Windows 引擎会按相同 UUID 加载不同版本，不要靠手工链接或改 UUID 构造未经支持的隔离。
:::

根项目的 `before_run` 和 [依赖的资源准备](/wiki/project/consumer-prepare/) 都只在真正准备本地进程时执行。`source_matches=true` 只比较当前可组装的文件，不能证明包外素材已经生成。相关配置见 [项目脚本](/wiki/project/scripts/)。

## 新建世界的设置

世界设置属于实例，不写进 `pyproject.toml`，也不需要先建世界再改文件。所有创建参数都要配合 `--new`；之后用 `run <实例ID前缀>` 打开原世界时不必再传。

```sh
mcpy --local --project /path/to/addon --non-interactive run --new --no-gui --detach \
  --world-name flat-test --world-type flat --game-type creative --difficulty peaceful \
  --seed 12345 --show-coordinates --no-mob-spawn --random-tick-speed 4 --json

mcpy --local --project /path/to/addon --non-interactive run --new --no-gui --detach \
  --world-name survival-test --world-type infinite --game-type survival --difficulty hard \
  --seed 67890 --no-cheats --no-keep-inventory --bonus-items --start-with-map --json
```

省略的参数使用默认值：无限地形、创造模式、普通难度、开启作弊，种子留空由游戏生成。使用前先看本机 `run --help`。macOS 的新运行包还必须支持 `cppconfig_protocol=1`，可通过 `mcpy --local engine doctor --json` 查看。

| 创建参数 | 取值 |
|---|---|
| `--world-name` / `--seed` | 字符串；种子按字符串传，`--seed 0` 是有效种子 |
| `--world-type` | `infinite` / `flat` |
| `--game-type` | `survival` / `creative` / `adventure` |
| `--difficulty` | `peaceful` / `easy` / `normal` / `hard` |
| `--permission-level` | `visitor` / `member` / `operator` |
| `--cheats` / `--no-cheats` | 开关作弊 |
| `--start-with-map` / `--no-start-with-map` | 初始地图 |
| `--bonus-items` / `--no-bonus-items` | 奖励箱 |
| `--random-tick-speed` | 非负 32 位整数 |

下列游戏规则都有 `--名称` / `--no-名称` 两个开关：

`pvp`、`show-coordinates`、`always-day`、`daylight-cycle`、`fire-spreads`、`tnt-explodes`、`keep-inventory`、`mob-spawn`、`natural-regeneration`、`mob-loot`、`mob-griefing`、`tile-drops`、`entities-drop-loot`、`weather-cycle`、`command-blocks-enabled`、`experimental-holiday`、`experimental-biomes`、`fancy-bubbles`。

:::caution
macOS 暂不支持启用最后三项（`experimental-holiday`、`experimental-biomes`、`fancy-bubbles`），显式启用会失败。不要绕过这一限制，也不要把默认的 false 当成已验证支持。
:::

### 从模板导入

可选 `--cppconfig /path/to/template.cppconfig` 导入已有的 `world_info`，再用上面的参数覆盖个别值。优先级为：显式命令参数 > 模板字段 > 默认值。模板只导入世界设置，不复用世界 ID、引擎版本、身份凭据或旧 pack 路径。旧实例的 cppconfig 也可以作为新世界模板。

### 确认实际设置

返回 `running` 只证明进程已启动。用同一个 session 的 `status` / `logs` / `runtime py` 等待世界就绪，再读取实际设置确认效果。

cppconfig 保存的是创建配方。在游戏里修改过的当前设置保存在存档中，重开世界不会重新应用创建配方，因此不能从 cppconfig 的初始 difficulty 推断当前难度。

图形界面使用同一入口：新建确认框默认收起世界设置，直接确认即采用默认值，展开后可以修改所有已建模的选项。

## 停止与保存

停止 `watch` 只结束监控，不退出游戏。`stop` 在准备阶段请求取消，在游戏阶段按已有后端退出；它只取消本次拥有的启动，等待别人的启动超时不会获得停止权限。

重要存档请先在游戏中正常保存。macOS 后端会请求保存退出；Windows 上进程退出本身不等于已验证世界保存。测试结束后确认自己的会话已经 `exited`。组内成员的停止和重启规则见 [双客户端](/wiki/network/dual-clients/)，不要单独 stop 一个还有活动客机的主机。

## 一次性自动验收

需要「新建独立测试世界、双端探针、收集日志并清理」时，可以使用 Skill 自带的辅助脚本：

```sh
python <skill>/scripts/smoke.py --command <本机mcpy命令> --project <项目> --local --game --client-file <客户端验收.py> --server-file <服务端验收.py> --expect-log <加载标记> --timeout 90
```

smoke 会 package、创建新世界、等待就绪、在两端各执行一次探针，并清理本次创建的会话。只想打包就省略 `--game`。只想保留或复用游戏时不要用它。

## 限制与注意

- 没有业务标记或探针的结果不能当作业务验收。
- 含预处理的项目，`package` 和 `run` 各自执行自己的 hook，是两次操作，不保证生成器只执行一次。
- 遇到退出未确认或 `recovery_required`，保留占用和现场，不要手动删锁、改 PID 或批量杀进程。
- macOS 的旧实例固定旧运行包，更新 CLI 不会升级它，详见 [macOS 平台](/wiki/local/macos/)。
