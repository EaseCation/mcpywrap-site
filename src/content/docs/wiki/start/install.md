---
title: 安装
description: 安装 mcpywrap 命令行工具，检查本机环境与可用能力。
sidebar:
  order: 1
---

mcpywrap 提供 `mcpy` 命令，用于管理《我的世界》中国版 Addon 和地图项目。本页说明如何安装、确认命令可用，以及在需要时检查游戏引擎和功能支持情况。

## 环境要求

- Python 3.9 或更高版本。
- Windows：使用 MC Studio 引擎。
- macOS：Apple Silicon、macOS 13.0 及以上，使用预构建启动器和开发者 APK，支持离线 Addon 世界。

两个平台共用 PySide6 项目界面；MCEditor 仅支持 Windows。macOS 的详细情况见 [macOS 平台](/wiki/local/macos/)，图形界面见 [图形界面](/wiki/local/gui/)。

## 快速上手

推荐通过 [uv](https://docs.astral.sh/uv/) 安装：

```sh
uv tool install mcpywrap
```

也可以使用 pip：

```sh
pip install mcpywrap
```

安装完成后查看命令列表：

```sh
mcpy --help
```

每个子命令都可以用 `mcpy <命令> --help` 查看自己的选项。

## 从源码安装（Windows）

正式发布包由 CI 编译并附带原生组件，普通安装无需本机编译。如果要从 Windows 源码检出安装：

1. 安装 Visual Studio 的 x86/x64 C++ 构建工具。
2. 运行 `python scripts/build_all_native.py`，一次编译全部原生组件。
3. 执行 `pip install -e .`。

:::note
Git 或源码安装可能缺少发布构建附带的原生组件。遇到问题时按实际诊断处理，不要用旧版本替换新功能来"修复"。
:::

## 检查游戏引擎

只做离线构建和打包时不需要安装游戏，也不需要启动任何服务。要在本机运行游戏时再检查引擎：

```sh
mcpy --local doctor --json
```

Windows 上 doctor 会检查 MC Studio 引擎，缺失时请在 MC Studio 中准备。需要登录身份的任务还要检查：

```sh
mcpy --local doctor --mcs-auth --json
```

macOS 首次 `run` 可以自动准备资源；安装、版本固定和升级见 [macOS 平台](/wiki/local/macos/)。

### Windows 引擎发现与覆盖

默认优先使用 MC Studio 登记的安装，再搜索标准下载目录，并跳过不完整的版本。编辑器缺失不等于游戏不可运行。

需要指定下载目录或引擎版本时：

```sh
mcpy --local doctor --mcs-download-path <下载目录> --json
mcpy --local --project <项目> --non-interactive run --engine-version <引擎版本号> --no-gui --detach --json
```

需要直接指定游戏 EXE 时使用 `--game-executable <路径>`。注意：

- 必须填写真实存在的完整引擎版本号，不能用简写匹配一系列版本。
- 独立 EXE 仍需要资源目录与用户数据。
- EXE 不在标准版本目录时，还需明确 `engine_version`；该声明不会验证二进制内部版本。
- 不要同时指向两套不同的标准安装。

这三项也可以写在项目配置或环境变量中：

| `[tool.mcpywrap]` 项目字段 | 本机环境变量 |
|---|---|
| `game_executable_path` | `MCPY_GAME_EXECUTABLE` |
| `mcs_download_path` | `MCPY_MCS_DOWNLOAD_PATH` |
| `engine_version` | `MCPY_ENGINE_VERSION` |

优先级为：命令行参数 > 环境变量 > 项目配置。项目配置中的相对路径按项目根解析，命令行和环境变量中的相对路径按调用目录解析。团队通常只提交版本号，本机路径放在环境变量里。

:::caution
macOS 的运行包与引擎绑定规则不同，不能套用 Windows 的 EXE 规则。远程执行时这些路径由 Windows 服务端配置，调用端不能直接覆盖。
:::

## 检查功能支持

不同版本的 CLI 支持的能力不同，不能只凭版本号判断。可以查询本机能力：

```sh
mcpy --local doctor --capabilities --json
```

返回中的 `capabilities` 描述后端能力，`local_capabilities` 列出仅限本机的能力（例如 `project-scripts`、`consumer-prepare`）。能力存在不等于资源已安装、已登录或游戏已就绪。

常用能力名称：

| 功能 | 能力名称 / 检查方式 |
|---|---|
| Git 依赖 / QuMod 快捷添加 | `git-dependencies` / `framework-presets`，或查看 `mcpy add --help` |
| 宿主项目脚本 | `project-scripts`；`mcpy script --help` |
| 依赖的资源准备 | `consumer-prepare`；`mcpy script list --effective --json` |
| 本地 macOS 世界 | `macos-local-worlds`，再运行 `engine doctor --json` |
| Windows 服务 | `serve` |

游戏启动后还有会话级能力，需要用 `runtime capabilities --session <sid>` 查询，输入动作另用 `runtime input capabilities`。

## 命令在哪里执行

mcpy 可以在本机执行，也可以连接远程 Windows 服务执行游戏。路由优先级为：显式 `--local` / `--remote` → 环境变量 `MCPY_REMOTE` → 项目 `[tool.mcpywrap].remote_url`。远端失败时不会回退到本机。

`init`、`add`、`remove`、`mod`、`modsdk`、`sync`、`build`、`package`、`dev`、`publish`、`script` 始终在调用端执行，不会因为配置了 remote 而上传项目。远程使用方式见 [远程执行](/wiki/network/remote/)。

## 限制与注意

- `mcpy add`、`sync --install` 和 ModSDK 安装都只作用于 mcpy 工具所在的 Python 环境，不会向游戏安装模块。详见 [依赖与 QuMod](/wiki/project/dependencies/)。
- `serve` 与 `edit` 仅限 Windows 本机；`edit` 不支持远程 MCEditor。
- 如果要让 AI Agent 操作 mcpywrap，CLI 与 Skill 需要分别安装，见 [AI 接入](/wiki/ai/)。

下一步：[第一个项目](/wiki/start/first-project/)。
