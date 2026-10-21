---
title: 依赖与 QuMod
description: 添加 Python 包、本地 Addon 与 Git 依赖，一键接入 QuMod，克隆后恢复与升级回退。
sidebar:
  order: 2
---

mcpywrap 支持三类依赖：mcpy 工具环境里的 Python 包、本机已有的 Addon 目录，以及 Git 仓库。QuMod 是 Git 依赖的一个预设。

## 快速上手

| 需求 | 命令 |
|---|---|
| 刚克隆项目，准备依赖 | `mcpy sync` |
| 给 Addon 加入 QuMod | `mcpy add --qumod --script-dir MyMod` |
| 从某个仓库加入依赖 | `mcpy add --git <URL>` |
| 引用本机已有 Addon | `mcpy add --path <Addon根目录>` |
| 安装宿主 Python 开发依赖 | `mcpy add "package>=version"` |
| 升级 / 回退 Git 依赖 | 对同一来源和别名再次 `add`，明确传 `--ref` |
| 移除 | `mcpy remove <包名>` / `remove --path <目录>` / `remove --git <name>` |

不带参数运行 `mcpy add` / `mcpy remove` 可以进入选择向导。图形界面 `mcpy ui` 中也有"Git 依赖"表单，见 [图形界面](/wiki/local/gui/)。

## Python 包：只进工具环境

```sh
mcpy add package-name
mcpy remove package-name
```

:::caution[不会进入游戏]
`mcpy add "pkg"` 把 Python 包安装到 mcpy 所在的工具环境并记录声明，只服务于开发工具，不会进入游戏。测试和正式游戏都使用游戏内置 Python，不读取 `dependencies`，也不继承工具环境的 `site-packages`。`add`、`sync --install` 和 ModSDK 安装都不向游戏安装模块。
:::

游戏需要的代码和资源必须随 Addon 携带，或由用户加载相应 Mod。纯 Python 库也不会自动复制，仍需适配游戏解释器、标准库和 ModSDK。原生扩展以及依赖外部安装步骤或系统环境的库不能直接用于游戏。

普通 PyPI 包或 wheel 安装成功不代表能参与组装。工具通过包的本地安装来源识别 Addon，未识别到 Addon 内容的包会标记为"仅开发环境"。版本约束与环境标记检查的是工具 Python，不代表游戏兼容性。

## 本地 Addon

已有 Addon 可以直接引用，不需要先初始化或安装，MCS 导出的目录也可以：

```sh
mcpy add --path "../shared-addon"
mcpy remove --path "../shared-addon"
```

请选择 Addon 根目录，例如：

```text
shared-addon/
  behavior_pack/manifest.json
  resource_pack/manifest.json
```

- 可以只有行为包或资源包；目录名也支持 `BehaviorPack*`、`ResourcePack*` 等可识别名称。
- 不支持直接引用单个包目录、地图、普通源码目录，或同一 Addon 中的多个同类型包。
- 引用保存在 `tool.mcpywrap.local_dependencies`，相对路径以声明它的项目为基准。
- 已有 mcpywrap 项目的子依赖会一并解析；循环依赖或失效路径会报错。
- 移除引用不会删除源目录。

本地路径适合同机开发，不会自动转换为可分发的包依赖；共享项目时需要同步这些目录。

## Git 依赖

```sh
# 自动识别 Addon，或读取仓库的导出描述
mcpy add --git https://example.com/team/shared-addon.git --ref <标签或完整SHA>

# 没有项目描述的纯源码目录：显式补充布局
mcpy add --git https://example.com/team/shared-code.git --kind code --subdir src --target MyMod/SharedLib

# 固定提交、别名、monorepo 子目录
mcpy add --git https://example.com/team/modules.git --ref <完整SHA> --dep-name combat --subdir projects/combat

mcpy remove --git combat
```

- 支持 HTTPS 与 `file://` 本地 Git 仓库，访问权限交给 Git 凭据机制。
- 首次省略 `--ref` 会读取当时的 HEAD 并锁成完整 SHA；之后 `sync` 不会追踪 HEAD。
- 对同一来源重复 `add` 默认保留既有提交和布局。显式 `--ref` 用于更新或回退，不自动选最新版本，也不做版本范围求解。
- `--subdir` 是仓库内的项目或源码目录；`--target` 是最终行为包内的安装位置。Addon 导出不填 target。
- 移除时用声明中的 `name`，不要用仓库 URL 或 Python 包名代替。移除只删声明，不删缓存或入口。

声明保存在消费者的 `pyproject.toml` 中，一般让 `add` 生成：

```toml
[[tool.mcpywrap.git_dependencies]]
name = "shared"
git = "https://example.com/team/shared.git"
rev = "0123456789abcdef0123456789abcdef01234567"
subdir = "."  # 可选：项目描述所在目录
kind = "auto" # 可选：auto / addon / code
# target = "MyMod/SharedLib" # code 安装位置，可覆盖上游 export.target
```

发布者可以在自己的 `pyproject.toml` 中声明导出：

```toml
[tool.mcpywrap.export]
kind = "code"
path = "src"
target = "MyMod/SharedLib"
```

`export.path` 相对项目描述所在目录，`target` 相对最终行为包。有效 Addon 可以省略 export。无法识别时会明确报错，工具不会猜测安装结构，也不会运行 setup.py、构建脚本或 EXE。

远端可以声明同样的 Git 子依赖。仓库内的 `local_dependencies` 必须位于同一 Git 快照内。工具会递归解析、检测循环、去重，并拒绝与手写内容或其他依赖重叠的安装位置；不会推断未声明的 import，不安装 Git 子模块，不执行依赖自身的 hooks。

## QuMod

为 Addon 一键准备 QuMod：

```sh
mcpy --project <项目> --non-interactive init --name demo --type addon --json
mcpy --project <项目> --non-interactive add --qumod --script-dir DemoScript --json
mcpy --project <项目> --non-interactive package --json
```

快捷命令为新脚本目录生成 `modMain.py`、`Server.py`、`Client.py` 及初始化文件，并声明、同步框架。无需先执行 `mod --name`；已有入口不会被自动改成 QuMod。

- 省略 `--script-dir` 时：只有一个 Mod 则自动选择；没有入口则创建 `MyScript`；有多个 Mod 会报错，需要明确选择。
- `add --qumod` 与 `add --framework qumod` 是同一预设，不要同时传。
- 也可以用 `mod --framework qumod --name MyMod --script-dir MyMod`，但目标目录必须尚不存在。
- 可加 `--source gitee` 选择来源。已有声明切换来源会保留固定提交。
- 命令返回实际锁定的提交；源码版本字段不表示存在同名官方 Release。已有项目不会随工具升级自动更换依赖版本。

QuMod 运行库安装到各自 Mod 的脚本目录，系统名和通信通道保持各自作用域，独立 Mod 需要各自的框架作用域。QuMod 源码不进入你的仓库。

## 克隆后恢复

```sh
mcpy sync
mcpy package
```

恢复不需要重新选择框架版本，也不需要重复添加预设。`sync --install` 还会在工具环境中可编辑安装项目，仅为恢复游戏代码时不需要加。`synced=true` 只证明依赖准备完成，入口接入和游戏加载仍需验证。

只有 `add` / `sync` 会获取远程内容，`build` / `package` / `run` 不隐式联网。运行中的世界不会因 add/remove 自动换版，见 [本地世界](/wiki/local/worlds/)。

## 缓存与提交

| 层 | 位置 | 内容 |
|---|---|---|
| 共享源码 | Windows `%LOCALAPPDATA%/mcpywrap`；macOS `~/Library/Caches/mcpywrap`；Linux `$XDG_CACHE_HOME/mcpywrap` 或 `~/.cache/mcpywrap` | 按来源和提交保存的不可变快照 |
| 项目锁 | `mcpy-git.lock.json` | 声明、节点、子依赖关系、内容摘要 |
| 项目注册 | `.mcpy/git-projects/` | 项目独立的注册节点 |
| 游戏产物 | `.mcpy/runtime/`、build 目录及 dist | 独立组装结果，不指向共享源码 |

`MCPY_CACHE_DIR` 可覆盖共享缓存根目录，不改变依赖声明或锁文件。

提交配置、`mcpy-git.lock.json`、生成的入口和业务代码、`.gitignore`；忽略 `.mcpy`、`.runtime`、`build` 和 `dist`。Windows 与 macOS 共用同一份锁文件。旧锁摘要不符时，两端更新 CLI 后运行 `sync` 即可按固定提交重算，无需删除锁。

## 限制与注意

- 旧 `code_libraries` 声明仍兼容，移除用 `remove --library <name>`，见 [代码库依赖](https://github.com/EaseCation/mcpywrap/blob/main/docs/code-libraries.md)。
- 获取来源失败时保留现有声明，不会静默换镜像、更新版本或转为 pip 安装。
- 构建成功但游戏导入失败时，检查产物路径、入口和游戏日志；这不是工具 Python 缺包的充分证据。
- 依赖可以导出资源准备入口，见 [依赖的资源准备](/wiki/project/consumer-prepare/)。
