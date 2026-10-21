---
title: 构建与发布
description: 构建项目、持续离线构建、生成游戏分发 ZIP，以及 Python 包发布。
sidebar:
  order: 1
---

`build`、`package`、`dev` 把项目和依赖组装成离线产物。它们都在调用端执行，即使项目配置了 remote 也不会在服务端运行。

## 快速上手

```sh
mcpy build
mcpy package
mcpy dev
```

在脚本或 CI 中建议使用显式参数，有限命令加 `--json`：

```sh
mcpy --project <项目> --non-interactive build --json
mcpy --project <项目> --non-interactive package --json
```

## 命令一览

| 需求 | 命令 | 注意 |
|---|---|---|
| 构建工程 | `build`，地图可加 `--merge` | 需要配置 `tool.mcpywrap.target_dir`，且不能指向受管运行目录 |
| 持续离线构建 | `dev` | 仅 Addon；持续输出文本，不加 `--json`；不是游戏热更 |
| 游戏分发 ZIP | `package`，地图可加 `--merge` | 返回 `artifact`；无需 `target_dir` |
| Python 分发 | `publish --yes` | 使用 Twine 凭据上传 Python 包，不是游戏 ZIP 上传 |
| 人工项目页 / MCEditor | `ui` / Windows `edit --detach` | MCEditor 使用独立准备目录，原生保存回源码仍须验收 |

## 游戏 ZIP

`package` 生成 `dist/<project.name>-<project.version>.zip`：

- Addon：ZIP 内为实际存在的 `<name>_bp/`、`<name>_rp/`。
- Map：根目录包含世界数据及包。默认保留独立包，`--merge` 合并依赖资源。
- 纯开发依赖不进入 ZIP。

请使用 `package` 导出，不要自行重新压缩或修改包名。检查返回的 `artifact` 和实际 ZIP 内容。行为包中的 `entities/` 空目录会被保留，纯脚本项目不需要虚构实体。

新 ZIP 成功生成后才会替换同名产物；失败时保留旧 ZIP。

:::caution
保留旧 ZIP 不代表项目脚本对源码的写入也会回滚。见 [项目脚本](/wiki/project/scripts/)。
:::

游戏 ZIP 与 Python/PyPI 分发是两件事。`publish` 只在你确实要上传 Python 包时使用。

## 合并规则

构建时主项目优先于依赖；同级依赖按声明顺序处理，后者覆盖重复内容。这只是构建产物的合并规则，不代表游戏运行时的资源包优先级。

修改依赖声明后，需要获取时重新 `sync`，并重启 `mcpy dev`。

## 本地 Addon 依赖与原生文件

本地 Addon 可以直接作为依赖参与构建，见 [依赖与 QuMod](/wiki/project/dependencies/)。构建前会检查游戏包内容：

- 游戏包内的 `.pyd`、`.dll`、`.so`、版本化 `.so.*`、`.dylib` 会在构建、打包、运行和编辑前报错，不再静默过滤。
- `dev` 检测到这类文件时保留原输出，移除问题文件后可恢复更新。
- 开发工具可以使用二进制包，只要这些文件不放在游戏包中。

当前校验不会分析所有 Python import，仍需检查 ZIP 内容和实际游戏日志。

:::tip
验收解包产物时，避免同时加载相同 manifest UUID 的源码包与产物，防止游戏选中旧内容。
:::

## 构建前的宿主脚本

项目声明了 hooks 时，`build`、`package` 和 `dev` 的初次构建会执行相应的宿主脚本；支持资源准备的依赖还会在根任务之后处理素材。

支持该能力的 CLI 可以查看完整计划：

```sh
mcpy --project <项目> script list --effective --json
```

需要检查返回中的 `complete` 和 `ready`。只查看根任务用 `script list --json`。配置方法见 [项目脚本](/wiki/project/scripts/) 和 [依赖的资源准备](/wiki/project/consumer-prepare/)。不要从 Python 的 `[project.scripts]` 推断构建生命周期。

## dev 与游戏运行部署

`dev` 只维护配置的离线构建目录，源码变化不会因此自动注入游戏。要更新正在运行的游戏，使用 `runtime reload` / `runtime watch`，见 [运行时调试](/wiki/runtime/debug/)。

:::caution
不要把 `target_dir` 改成 `.mcpy/runtime` 或 `.runtime` 来绕过部署保护。
:::

build/package 产物、当前运行部署和世界存档是三种不同的对象。离线打包不应删除或重建测试世界。共享部署占用、重新启动和失败处理见 [本地世界](/wiki/local/worlds/)。

## 游戏运行边界

工具的 Python 环境与游戏内 Python 相互独立。`add`、`sync --install`、`modsdk` 不会让游戏读取 `site-packages`。原生扩展或未适配的 Python 代码，不能仅凭 pip 安装成功就当作游戏依赖。

## 限制与注意

- 产物完整、游戏加载和网易平台验收需要分别确认。构建成功或上传响应成功不能证明正式玩法正确，也不能替代平台自测。
- 具体玩法的 API、事件和 JSON 组件要查目标网易 ModSDK 版本。mcpywrap 只负责工程与测试流程，不证明业务 API 兼容。
