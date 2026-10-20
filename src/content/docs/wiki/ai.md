---
title: AI 接入
description: 为 AI Agent 安装 mcpywrap Skill，让它通过公开 CLI 完成项目开发与验收。
---

> 适用于 mcpywrap 0.5.4。

mcpywrap 仓库自带一份完整的 Skill，供 AI Agent 操作 mcpywrap。Skill 告诉 Agent 按当前任务查阅哪一篇参考、如何调用 CLI，以及哪些结果不能当作验收证据。

## 快速上手

安装仓库内的 [mcpywrap Skill](https://github.com/EaseCation/mcpywrap/blob/main/skills/mcpywrap/SKILL.md)。有两种方式：

- 让 Agent 安装 `EaseCation/mcpywrap` 的 `skills/mcpywrap` 目录；
- 或者把整个 `skills/mcpywrap` 文件夹复制到 Agent 的技能目录。

:::caution
CLI 与 Skill 分别安装。安装 Python 包不会自动注册 Skill；更新 Skill 也不会更新 CLI、正在运行的 worker 或 macOS 原生运行包。
:::

安装后，直接用自然语言描述任务即可，例如：

- "为这个 Addon 添加 QuMod，并生成分发 ZIP。"
- "运行前把策划表生成 JSON，检查游戏加载结果。"
- "保留原世界，用两个客户端验证同步，只重试失败的客机。"

## Skill 的工作方式

Skill 按当前任务选择参考，不要求 AI 通读产品文档，也不把仓库设计草案当作现行用法。实际安装是否支持某项能力，以 CLI 帮助和能力查询为准。

| 任务 | 对应主题 |
|---|---|
| 安装 CLI、检查环境、分清本机/远端 | [安装](/wiki/start/install/) |
| 新建项目、构建、打包、编辑器、PyPI 分发 | [构建与发布](/wiki/project/build/) |
| Python / 本地 / Git 依赖、QuMod、克隆恢复 | [依赖与 QuMod](/wiki/project/dependencies/) |
| 项目自己的脚本和根 hooks | [项目脚本](/wiki/project/scripts/) |
| 用依赖框架处理本项目素材 | [依赖的资源准备](/wiki/project/consumer-prepare/) |
| 启动、重开、停止本地世界 | [本地世界](/wiki/local/worlds/) |
| 已有会话执行 Python、热更、runtime watch | [运行时调试](/wiki/runtime/debug/) |
| 移动、攻击、操作 UI | [统一输入](/wiki/runtime/input/) |
| 截图、录屏 | [截图与录屏](/wiki/runtime/capture/) |
| 两名玩家联调 | [双客户端](/wiki/network/dual-clients/) |
| 连接外部服务器 | [连接服务器](/wiki/network/server/) |
| Windows HTTP 远程服务 | [远程执行](/wiki/network/remote/) |
| 已有明确错误 | [故障排查](/wiki/reference/troubleshooting/) |

## 让 Agent 找到 CLI

Skill 附带 bootstrap 脚本，用于首次接入、缺少命令、升级或切换机器：

```sh
uv run --no-project --python 3.12 "<skill>/scripts/bootstrap.py"
```

Windows 也可以运行 `scripts/bootstrap.ps1`。bootstrap 返回的 `command` 属于本机，Agent 后续使用它。默认复用已有安装；明确更换来源时加 `--upgrade`，并选择 `--version`、`--git-ref <可获取的完整SHA>` 或 `--editable-path <本机源码目录>`。本地未推送的改动只能用本机源码安装。

需要特定能力时可以要求 bootstrap 检查，例如 `--require-capability project-scripts`。已经确认命令和目标后，不必每次运行 bootstrap。

## 调用约定

Skill 约定 Agent 这样调用 CLI：

- 全局参数放在子命令之前：

  ```sh
  mcpy --local --project <已有绝对目录> --non-interactive <命令>
  ```

  远程操作明确换成 `--remote <Windows服务HTTP地址>`，失败不回退本机。
- 有限命令加 `--json`，并检查退出码和 `ok` / `error` / `code` / `hint`。`dev`、`runtime watch`、`serve` 是持续命令，不加 `--json`。脚本的尾参数放在 `--` 之后。
- 启动本地游戏用 `run --no-gui --detach --json`，不操作 Qt 或 TUI 界面。游戏仍需要图形会话和 GPU。
- 保存返回的 session / group、项目及远程 endpoint，后续不更换目标。

## 业务代码与 mcpy.*

:::danger
业务代码禁止依赖 `mcpy.*`。`mcpy.input`、`mcpy.ui`、`mcpy.player`、`mcpy.api` 仅由 `runtime install` 临时注入调试会话，不是 ModSDK，也不是可分发依赖。
:::

宿主生成脚本使用工具的 Python 3；游戏代码仍受游戏内置 Python 和目标 ModSDK 的约束。业务 API 仍需查目标版本的 ModSDK。

## 结果判读

- `running`、请求 `completed` / `triggered` 不等于玩法效果已验证。
- 只结束自己创建或用户指定的会话。
- 结果为 unknown 时不盲目重发；遇到 busy 时不清锁、不杀无关进程。
- 查询与 GUI 依赖刷新是只读的；关闭管理或调试窗口会保留游戏。取消准备与停止已经启动的游戏是不同操作。

## 几条关键规则

- 世界保存进度，部署决定代码。`--new` 只创建世界；再次 `run` 若接管已有会话，不会应用新代码，也不执行预处理。
- 普通 `build` / `dev` 不写运行目录；运行资源由受控部署发布。
- 两名玩家使用组：输入、Python、截图选具体 session；组热更与停止选 group。本地 `waiting_for_join` 需要用户点击局域网卡片，不是启动失败。
- 项目自己的宿主任务用 scripts / hooks；依赖提供的资源处理用 consumer_prepare；`runtime py` 在游戏内执行。

## 限制与注意

- 新的输入任务统一使用 `runtime input`，见 [统一输入](/wiki/runtime/input/)。
- 截图、录制和逐帧检查见 [截图与录屏](/wiki/runtime/capture/)。
- Skill 文本不能替代 CLI 能力查询；候选功能未发布时，需使用包含该功能的源码或构建，不能假定 PyPI 已具备。
