---
title: 图形界面
description: Windows/macOS 共用的 Qt6 项目管理页与调试小窗：日志查看、Python 控制台、热更与重载世界。
sidebar:
  order: 3
---

mcpywrap 在 Windows 和 macOS 上提供同一套基于 Qt6 的图形界面：完整的项目管理页，以及游戏启动后弹出的紧凑调试小窗。它们和命令行共用同一套会话服务，适合人工开发时使用；AI 和脚本继续使用纯命令入口。

## 快速上手

```sh
# 打开完整项目管理页
mcpy --local --project /path/to/addon ui

# 在终端准备资源，游戏启动后只打开紧凑调试小窗
mcpy --local --project /path/to/addon run

# AI 或纯终端操作，不打开任何窗口
mcpy --local --project /path/to/addon --non-interactive run --no-gui --detach --json
```

`--no-gui`、`--detach`、`--json`、`--non-interactive` 都会抑制调试小窗。

## 安装与依赖

安装 mcpywrap 时会自动安装 PySide6-Essentials（Qt6），只用到 QtCore、QtGui、QtWidgets，不需要 PyQt 或 PySide6-Addons。包管理器会根据 Python 和系统版本选择兼容的 wheel，无需手工配置插件路径。命令行会延迟导入 Qt，不打开界面时不受影响。

Qt GUI 的最低系统要求以实际 wheel 为准，不能用原生游戏组件的编译目标来推断。

## 项目管理页

`mcpy ui` 沿用原有的项目/依赖布局，支持：

- 添加本地、包、Git 依赖，以及框架快捷添加；
- Mod 模板；
- 实例的创建、选择和删除；
- 运行环境安装；
- 保存退出、重新部署并重载世界。

在 macOS 上首次启动时，`mcpy ui` 会自动准备运行资源并显示进度，完成后继续启动。高级来源和本地 APK 导入默认折叠，与 CLI 使用同一个安装服务，详见 [macOS 平台](/wiki/local/macos/)。

新建世界的确认框默认收起世界设置，直接确认即采用默认值，展开后可以修改全部已建模选项，参数含义见 [本地世界](/wiki/local/worlds/)。

:::note
macOS 上会明确显示并禁用「MCEditor（不支持）」；Windows 继续使用 MC Studio Editor。
:::

## 调试小窗

游戏启动后会自动显示一个可折叠、可置顶的小窗，主界面的「打开日志小窗」可以重新打开同一个窗口。

- 收起时宽 320 个逻辑像素，只保留状态、日志开关、操作菜单与置顶；长状态会省略显示，悬停可看完整内容。
- 展开默认 540×340，可调整大小，本次再展开时恢复上一次尺寸。
- 热更文件、重载世界、保存退出、自动热更和端侧选择收在操作菜单中。
- 使用工具窗样式且不主动激活，尽量不打断游戏。

关闭小窗只是隐藏视图，游戏和监控继续运行；重新打开不会新建接收器或监控线程。会话自然退出时小窗会关闭，完整日志仍可在主界面查看。

## 日志查看

主界面的 Debug 日志页和小窗共用一次读取、同一份缓存和同一个日志控件，沿用原 Studio 的染色规则：

| 内容 | 颜色 |
|---|---|
| 时间戳 | 灰色 |
| ERROR | 红色 |
| WARN | 黄色 |
| Engine | 蓝色 |
| 自定义 Mod 标签 | 洋红色 |

每个视图可以独立选择来源 `game`、`engine`、`worker`、`operations`，以及是否显示协议详情；切换时从共享缓冲回放，不重新打开日志文件。搜索用额外选区高亮，提供「上条/下条」跳转，清除搜索后恢复颜色。完整日志始终保留在项目的 `.runtime/sessions` 中。

## Python 控制台

Python 控制台需要显式选择 client 或 server。macOS 客户端走 JNI 通道，服务端仍使用原有的 Safaia。对应的命令行用法见 [运行时调试](/wiki/runtime/debug/)。

## 热更与重载世界

界面和 CLI 共用同一个监控器：组装成功后防抖，再把最新源码发送到指定端侧。默认端侧是 client；server 用于服务端模块；both 只适合可以安全重复执行的公共模块。未加载的模块会明确跳过。停止监控不会关闭游戏。

对应的命令：

```sh
mcpy --local --project /path/to/addon runtime reload python --session <id> --file /path/to/module.py --side client --json
mcpy --local --project /path/to/addon runtime watch --session <id> --side server
```

Python 模块热更只更新模块命名空间，不会重建已有对象、替换已注册的回调或撤销之前的副作用。以下情况请用「重新部署并重载世界」：修改事件注册、类结构，新增入口，删除模块，或改动不支持动态加载的资源。这个按钮会保存退出、重新组装、重开同一个世界，不会新建或丢弃存档。

资源热更按后端实际能力处理：当前 macOS 开发包支持已知粒子文件更新；支持原生 JSON UI 重载协议的运行包可以重载定义，之后要重新注册/创建界面并绑定回调。缺少该协议的运行包，以及当前的材质和 Shader，会返回 `unsupported`。资源回执为 `triggered` 时仍要检查实际效果。

### 软链接部署

声明 `addon_link_protocol=1` 的新原生运行包使用 `--link-source-addons`：游戏的行为包/资源包目录软链接到实例的 assembled 目录，监控直接更新组装目录，无需再复制运行副本。原始项目和依赖不会被移动或删除。旧实例固定旧运行包，继续使用复制兼容路径；升级运行包后新建的实例才启用新协议。

## 关闭窗口时会发生什么

| 情况 | 行为 |
|---|---|
| 关闭小窗 | 只隐藏视图，游戏与监控继续 |
| 点击「保存退出」或在终端按 Ctrl+C | 调用同一个停止接口，显式停止游戏 |
| 关闭启动了游戏的管理器 | 确认后保存退出自己启动的游戏并关闭小窗，后台线程完成后才销毁窗口 |
| 关闭附加到已有会话的管理器 | 停止本 GUI 创建的监控，保留外部游戏 |
| 停止失败 | 保留会话身份以便重试，不会假报退出或强杀存档 |

界面只会自动关闭本窗口启动的会话，复用的既有会话不会因关闭管理页而停止。

## 限制与注意

- MCEditor、MCS 身份、Windows 桌面输入和录制不属于 macOS 功能。
- 旧的 `studio_server_ui.py --port` 入口仅作为旧 Studio TCP 协议的适配层保留，新的 Windows/macOS 托管会话都不使用它。
- 界面图标的应用名为 mcpy；直接运行 Python 时，macOS 的 LaunchServices 仍可能把进程名显示为 Python。已打开的小窗需要重新启动后才会应用新图标。
- mcpy 自身使用 MIT 许可；GUI 依赖的 PySide6-Essentials 和 Shiboken6 作为独立动态依赖安装，走 LGPLv3 许可路线，第三方声明随 wheel 携带于 `THIRD_PARTY_NOTICES.md`。
