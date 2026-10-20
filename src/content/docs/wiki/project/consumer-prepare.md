---
title: 依赖的资源准备
description: 让依赖的框架工具处理当前项目的素材，以及框架作者如何导出准备入口。
sidebar:
  order: 4
---

> 适用于 mcpywrap 0.5.4。

玩法项目依赖某个框架时，可以由框架自带的工具处理玩法自己的素材，这个机制叫消费者准备（consumer_prepare）。框架工具与运行库来自同一个依赖版本；素材、业务配置和生成结果属于消费项目。当前能力适用于 Addon 根项目。

## 快速上手

先确认 CLI 支持：`mcpy --local doctor --capabilities --json` 的 `local_capabilities` 包含 `consumer-prepare`。

新依赖按 [依赖与 QuMod](/wiki/project/dependencies/) 使用 `add --path` 或 `add --git` 添加；已有依赖只需恢复，不要重复 add。消费项目无需复制启动器、登记 provider ID 或添加 hooks。

```sh
mcpy --local --project <项目绝对目录> --non-interactive sync --json
mcpy --local --project <项目绝对目录> --non-interactive package --json
```

两步之间，按 add/sync 返回的 `preparation.consumer_prepare[].example` 或 diagnostics 填写业务配置。使用依赖作者实际给出的表名和字段，不要把其他框架的配置当作通用格式。

:::note
`sync` 只恢复依赖和准备环境，不执行资源生成。它可能返回 `ok=true` 但 `preparation.ready=false`：环境可用，但业务配置还缺项，修配置即可，不必重建环境。
:::

## 工具环境

默认使用消费项目的 `.venv`。环境不存在时，`sync` 会从本机已有 Python 中选择满足全部启用入口要求的版本来创建，优先最高兼容版本。返回中的 `environment.python` / `version` / `state` 描述环境，新建时还有 `created_with`。

- 已有环境不兼容时停止，不自动删除或重建；缺少兼容 Python 时按错误提示安装后再 sync。
- 不会下载解释器，也不会安装框架所需的第三方库；`build` / `run` 不创建环境或回退到其他解释器。
- `sync` 失败但 `sources_synced=true` 时，依赖已经恢复，继续按 error/code/hint 修复准备问题。

框架需要第三方库时，用 `environment.python` 指向的解释器安装：

```sh
<environment.python> -m pip install <作者要求的发行包>
```

:::caution
`mcpy add <包名>` 和 `sync --install` 操作的是 mcpy 工具环境，不是项目 `.venv`，不能据此判断项目环境已有该库。两者都不会把库装进游戏。
:::

## 执行时机

| 操作 | 资源准备行为 |
|---|---|
| build / package | 根项目的 `before_*` 任务先执行，再执行依赖准备；package 不连带执行 before_build |
| dev | 仅首次准备；之后修改原始素材需要重新构建并应用 |
| 本地 run、Qt 启动、restart | 真正准备新游戏进程时执行，在最终资源指纹和组装前 |
| 本地主客机组 | 主机一次；补齐或重试客机不执行 |
| 接管已有会话 | 不准备、不重新部署；需重启会话或 stop 后重新 run |
| runtime reload/watch、网络连接、远程 run | 不执行 |
| add/sync/remove、查询、edit/publish | 不执行入口；sync 可创建工具环境 |

`package` 后再 `run` 是两个操作，各执行一次。普通依赖自己的 hooks 不会递归执行，根项目任务见 [项目脚本](/wiki/project/scripts/)。

## 查询与诊断

```sh
mcpy --local --project <项目绝对目录> --non-interactive script list --effective --json
```

`ok=true` 只表示查询成功，还要看 `complete`、`ready` 和 `diagnostics`。`consumer_prepare` 列出来源、配置示例和状态，`execution_order` 给出各事件的执行顺序。查询不会执行入口、恢复依赖或创建环境。旧的 `script list --json` 只返回根任务，不能用它判断没有依赖准备。

| 现象 | 处理 |
|---|---|
| Git 工具源码缓存缺失 | 显式 sync；依赖本身未交付入口文件时，修复依赖版本或交由作者处理 |
| `prepare_environment_unavailable` / `prepare_python_unavailable` | 查看 environment 的实际路径、版本要求与来源 |
| `consumer_config_invalid` | 按 issues 中的 TOML 路径和依赖示例修配置；schema 不会自动补默认值 |
| `not_transitive` | 间接依赖没有导出传递准备；按实际关系决定是否直接引用 |
| `disabled` | 项目显式停用了此来源 |
| `script_config_changed` | 配置、身份或工具源码在本次操作中变化；稳定后重试 |
| `script_failed` / `script_timeout` / `script_cancelled` | 查看 `script_log`；源码写入不会自动回滚 |

日志位于 `.mcpy/scripts/<操作 ID>/`，任务记录含 `kind=consumer_prepare` 和来源。单独验证生成请用 `build`；`script run <name>` 只执行根项目的命名任务。

## 可选覆盖

使用已有的外部环境（相对消费项目根或绝对路径；Windows 用对应的 `Scripts/python.exe`）：

```toml
[tool.mcpywrap.prepare]
python = ".tools/bin/python"
```

只使用运行库或自行维护生成物时，可以停用来源，运行库依赖仍保留：

```toml
[tool.mcpywrap.prepare]
disabled = [
    { path = "../local-framework" },
    { git = "https://example.org/team/framework.git", subdir = "." },
]
```

不要为了掩盖缺配置或脚本失败而添加停用项。

## 框架作者：导出入口

在依赖的 `pyproject.toml` 中声明一个可直接执行的 Python 文件入口，最小声明如下：

```toml
[tool.mcpywrap.consumer_prepare]
format = 1
python = "build_tools/prepare.py"
requires_python = ">=3.9"
```

可选字段写在同一张表中：`config_key`、`config_schema`（JSON Schema Draft 2020-12）、`config_example`、`timeout`（默认 120，大于 0 且不超过 86400）、`transitive`（默认 false，仅直接消费者执行）。`requires_python` 描述宿主处理工具所需的 Python，不是游戏内 Python 版本。每个依赖最多一个入口。

入口的工作目录为消费根，通过环境变量取得上下文：

| 环境变量 | 含义 |
|---|---|
| `MCPY_PROJECT_ROOT` | 最终消费项目的绝对根，素材与生成结果属于它 |
| `MCPY_DEPENDENCY_ROOT` | 当前依赖的原始描述根，只读 |
| `MCPY_CONSUMER_CONFIG` | 临时 UTF-8 JSON 文件路径，只含本入口对应的配置表 |
| `MCPY_PROVIDER_ID` | 日志归属身份 |
| `MCPY_EVENT` | `before_build`、`before_package` 或 `before_run` |
| `MCPY_OPERATION` | `build`、`package` 或 `run` |

退出码 0 表示成功；业务错误应说明具体源文件和修法并返回非零。入口不能等待交互、成为后台服务或递归调用 mcpy 写操作，也不得修改依赖源码、pyproject、依赖锁、包身份、世界数据库或受管运行目录。

框架仓库不是自身的消费者，请用另一个声明该依赖的 Addon 验证。完整协议和可复制模板见 [作者接入参考](https://github.com/EaseCation/mcpywrap/blob/main/skills/mcpywrap/references/consumer-prepare-author.md)。

## 限制与注意

- mcpy 统一执行、取消和阻断后续操作，但不提供文件访问沙箱或源码回滚；需要多文件一致性时由生成器自行设计。
- 独立打包、游戏启动和玩法效果需要分别验证。
