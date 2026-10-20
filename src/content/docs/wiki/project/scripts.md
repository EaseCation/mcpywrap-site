---
title: 项目脚本
description: 在 pyproject.toml 中定义宿主机脚本，并在构建、打包或本地启动前自动执行。
sidebar:
  order: 3
---

> 适用于 mcpywrap 0.5.4。

项目脚本是在 `pyproject.toml` 中定义的有限时宿主机任务，可以在构建、游戏 ZIP 打包或本地世界启动前执行，例如把策划表生成 JSON。任务运行在工具所在的电脑上，不在游戏 Python 环境中，也不会传到远程 Windows 服务端执行。

## 快速上手

先确认 CLI 支持该功能：

```sh
mcpy script --help
mcpy --local doctor --capabilities --json
```

`local_capabilities` 中包含 `project-scripts` 时可用。不能只凭版本号判断，旧 CLI 可能直接忽略新配置。

然后在 `pyproject.toml` 中定义任务和触发时机：

```toml
[tool.mcpywrap.scripts.assets]
python = "tools/assets.py"
args = ["--quality", "development"]
env = { ASSET_MODE = "development" }
timeout = 120

[tool.mcpywrap.scripts.check]
cmd = ["node", "tools/check.mjs"]
timeout = 30

[tool.mcpywrap.hooks]
before_build = ["assets"]
before_package = ["assets", "check"]
before_run = ["assets"]
```

这是项目工具配置，与 `[project.scripts]` 的 Python 安装入口无关。

## 任务字段

每个任务在 `python` 与 `cmd` 中二选一：

| 字段 | 说明 |
|---|---|
| `python` | 项目根目录内的相对脚本路径，用 mcpy 自己的 Python 解释器执行 |
| `args` | 配合 `python` 使用的固定参数数组 |
| `cmd` | 完整 argv 数组，含程序名和参数；不支持另加 `args` |
| `env` | 覆盖继承的环境变量，键值必须是字符串 |
| `timeout` | 秒数，默认 120；须大于 0 且不超过 86400 |

补充说明：

- uv tool 安装的 mcpy 使用隔离的工具环境，不会自动读取项目 `.venv`。需要 Pillow 等库时，先在选定的工具环境中准备好，或用 `cmd` 明确调用其他已经准备好的环境。
- `cmd` 的程序名从继承的 PATH 查找；带路径的程序相对项目根解析。
- 工作目录始终是 `--project` 指向的项目根，不受终端当前目录影响。
- `env` 不能覆盖工具自己的 `MCPY_*` / `_MCPY_*` 字段。
- 每个任务分别计时，列表中的任务串行运行。失败、超时或取消会立即中断后续任务和本次构建或启动。

:::caution
不解释通配符、变量替换、`&&`、管道或重定向，复杂逻辑请写进 Python 或 Node 程序。Windows 的 `.cmd` / `.bat` 包装器不能直接作为 `cmd` 的程序，需要时显式调用 `cmd.exe /c` 或 PowerShell。GUI 启动时 PATH 可能与终端不同，缺少工具会明确报错，不会自动安装或切换 shell。
:::

## 手动执行

```sh
mcpy --project <项目> script list --json
mcpy --project <项目> script run --json assets -- --quality release
```

- `list` 只读，不执行任务，也不创建日志。
- `run` 只执行指定任务，不触发任何生命周期。
- `--` 之后的参数原样追加到固定 argv。子脚本的 `--json` / `--help` 不影响父命令的输出模式。

## 自动执行时机

| 操作 | 执行 |
|---|---|
| `build` | `before_build` 一次，然后组装 |
| `package` | `before_package` 一次，然后组装并压缩；不额外运行 `before_build` |
| `dev` | 首次构建前 `before_build` 一次；后续文件事件不重复执行 |
| 本地 `run`、Qt 启动、单会话 restart | 真正准备新游戏进程时 `before_run` 一次，在部署指纹和资源组装前 |
| 本地主客机组 | 主机准备时一次；补齐或重试客机不执行 |
| 接管已运行世界、查询、GUI 依赖刷新 | 不执行 |
| `runtime reload` / `watch` | 不执行 |
| 网络 run/connect、远程 run | 不执行本地启动钩子 |
| add/remove/sync、edit、publish | 不执行 |

同一事件按数组顺序运行。无变化的新启动仍会执行 `before_run`，若生成的包内容相同则复用现有部署。接管已有游戏不会执行生成。

hooks 只执行当前根项目的任务，不递归执行依赖的 hooks。依赖可以另外声明资源准备入口，见 [依赖的资源准备](/wiki/project/consumer-prepare/)。

## 编写脚本

原始素材和宿主代码放在包外，只有业务输出放在包内。脚本可以读取这些环境变量：

| 变量 | 含义 |
|---|---|
| `MCPY_PROJECT_ROOT` | 项目根目录 |
| `MCPY_EVENT` | `manual` 或具体的 hook 名 |
| `MCPY_OPERATION` | `script` / `build` / `package` / `run` |

脚本必须能独立完成：stdin 已关闭，不能等待输入、启动脱离管理的后台服务，也不能当作常驻 watch。需要持续生成时，直接在终端运行生成器自己的 watch，例如 `python tools/assets.py --watch`。脚本内不应递归调用 mcpy 的构建、启动或依赖写操作，只读查询可以使用。

示例：`data/items.csv` 生成到行为包中的 JSON，先完成生成与校验，再原子替换最终文件：

```python
import csv
import json
import os
from pathlib import Path
import tempfile

root = Path(os.environ["MCPY_PROJECT_ROOT"])
with (root / "data/items.csv").open(encoding="utf-8", newline="") as stream:
    rows = list(csv.DictReader(stream))
items = {row["id"]: int(row["value"]) for row in rows}
if len(items) != len(rows):
    raise ValueError("重复的物品 ID")

# 临时文件不放进游戏包
target = root / "behavior_pack/MyMod/generated/items.json"
target.parent.mkdir(parents=True, exist_ok=True)
scratch = root / ".mcpy/asset-temp"
scratch.mkdir(parents=True, exist_ok=True)
fd, name = tempfile.mkstemp(dir=scratch, suffix=".json")
try:
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
        json.dump(items, stream, ensure_ascii=False, sort_keys=True)
        stream.write("\n")
    os.replace(name, target)
finally:
    Path(name).unlink(missing_ok=True)
```

对应任务只需 `python = "tools/assets.py"`；除非脚本实现了参数解析，否则不要照抄上文的 `--quality` 参数。生成多个文件时，由脚本负责删除不再需要的旧输出。生成的游戏业务代码仍须兼容目标引擎，不能依赖临时调试用的 `mcpy.*`。

## 日志与取消

每次任务的日志和结果位于 `.mcpy/scripts/<操作 ID>/output.log` 和 `result.json`。JSON 输出中包含脚本记录或 `script` / `script_log` / `script_exit_code` 等失败详情；任务输出送往 stderr。Qt 在准备阶段显示任务，并提供"取消准备"。

Ctrl+C、任务超时或 stop 请求会取消任务并回收子进程。如果无法确认进程已经结束，会报告 `script_recovery_required`，此时查看 `script_state` 中的进程身份和日志，不要按进程名批量杀进程。

## 限制与注意

:::danger
脚本对源码的写入不会自动回滚。脚本失败会阻止本次构建或启动，但源码中的半成品可能被下一次构建或已开启的 watcher 读取。批量生成时请暂停 watcher；多个文件的替换不构成事务。
:::

- 项目和包的骨架必须已存在。脚本用于生成包内内容，不用于修改 pyproject、依赖锁、manifest、包身份或世界配置；执行期间这些配置变化会使本次操作失败。
- 不要让脚本写入 `.mcpy/runtime`、`.runtime`、依赖缓存、全局游戏包或世界数据库。
- 首版不提供输入图、产物挂载、任务缓存或目标引擎推断；需要固定引擎格式时由项目明确传入参数。
- 合作锁只避免工具发起的同项目并发写入，不是文件系统沙箱。
