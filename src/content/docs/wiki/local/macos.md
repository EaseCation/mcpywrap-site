---
title: macOS 平台
description: Apple Silicon macOS 上的运行资源安装、实例版本固定、升级方式与平台能力边界。
sidebar:
  order: 2
---

mcpywrap 在 Apple Silicon macOS 上提供原生本地后端，可以运行离线 Addon 世界。日常的启动、世界复用和部署规则与 Windows 相同，见 [本地世界](/wiki/local/worlds/)；本页只说明资源安装、版本升级和平台差异。

## 快速上手

全新安装直接 `run` 即可：首次运行发现资源缺失时会自动安装原生运行包和官方 APK，不需要提供 catalog 或 APK。

```sh
mcpy --local --project <项目> --non-interactive run --no-gui --detach --json
```

需要提前检查或准备时：

```sh
mcpy --local doctor --capabilities --json
mcpy --local engine doctor --json
mcpy --local --non-interactive engine install --json
```

`doctor --capabilities` 中需要有 `macos-local-worlds` 能力。`engine install` 是可选的提前准备。

## 系统要求

- Apple Silicon Mac。Intel Mac 不支持原生本地后端；Apple Silicon 上的 Rosetta Python 可以启动 arm64 游戏。
- 最低声明 macOS 13.0。实测过的系统与开发包版本见 [更新记录](https://github.com/EaseCation/mcpywrap/blob/main/CHANGELOG.md)。
- 运行包采用 ad-hoc 签名，未公证，因此不能保证最低系统版本和 Gatekeeper 检查全部通过。
- 不需要 Wine、Homebrew 游戏环境、MPay 账号，也不需要另装一套 Launcher。

## 资源来源与存放位置

默认通过固定的 HTTPS 启动器发行源，以及网易 pe 渠道动态发现开发者 APK。以下来源优先于默认值：显式 `--catalog`、环境变量 `MCPY_RUNTIME_CATALOG` 或已保存的来源。`--apk` 只用于离线导入一个已有的匹配 APK。下载和提取进度写到 stderr，stdout 的 JSON 保持独立。

资源默认位于 `~/Library/Application Support/mcpy`，可以用 `MCPY_ENGINE_HOME` 隔离测试环境。

:::note
官方动态 APK 初次下载时没有预发布的可信摘要。工具在完成来源、下载一致性、归档和结构检查后记录实际摘要。这是缓存校验，不等于官方签名身份背书。
:::

网络、校验、空间或结构检查失败时按原错误处理，不要猜测 CDN 版本路径，也不要关闭系统保护。

## 实例固定版本与升级

每个世界实例固定自己的运行包与 APK。`engine install` 不会迁移已有世界：旧实例继续使用旧资源，新能力通常要升级后 `run --new` 才能用。想保留旧世界时，先弄清它绑定的版本和能力限制，不要删除重建，也不要直接改旧实例的版本号。

检查更新：

```sh
mcpy --local engine check-updates --json
```

这个命令只查询网易 pe/pe_old 的真实版本和 URL，不下载、不替换实例。返回 `compatibility=not_checked` 不代表可以运行。首次安装已经会查询 pe，普通启动不需要先检查更新。

新版 CLI 默认使用随之发布的运行包。已有安装会保留所选来源，升级资源时需要用 `--catalog` 明确指定新运行包的 catalog（地址见 [mcpelauncher-manifest 发布页](https://github.com/EaseCation/mcpelauncher-manifest/releases)）：

```sh
mcpy --local --non-interactive engine install --catalog <运行包 catalog.json 地址> --json
```

catalog 仍按其来源规则发现 APK，并不等于固定旧 APK。旧版本如果已不在官方频道，就无法下载，此时报告缺失，不要猜 URL。更新 CLI/Skill 或重新 `runtime install` 都不能替换原生包。

## 平台能力边界

| 能力 | 当前情况 |
|---|---|
| 本地世界 | 支持 Addon；Map 尚未接入。Map 需要 Windows 本地运行，远程服务不提供世界实例 |
| 世界参数 | 运行包需 `cppconfig_protocol=1`，选项见 [本地世界](/wiki/local/worlds/) |
| 游戏 Python | 本地 client/server；客户端队列需 `python.client_queue`，见 [运行时调试](/wiki/runtime/debug/) |
| 无认证网络 | 运行包需 `network_connect_protocol=1`；服务器须允许开发客户端 |
| 本地主客机 | 尚不支持；缺少 `local-dual-client-manual` 时启动前即拒绝 |
| 双外服客户端 | 需要支持独立开发身份协议的原生包；以实例诊断为准，不能凭候选实验推断已具备 |
| MCS 身份 / MCEditor | macOS 不支持；MCS 网络身份可由 Windows 服务提供，编辑器必须在 Windows 本机 |
| 游戏截图 | 实例运行包需 `screenshot_protocol=1`，见 [截图与录屏](/wiki/runtime/capture/) |
| 录屏 / 视频提帧 / 原始设备输入 | macOS 本地不支持；可通过远程针对 Windows 会话使用 |

网络连接需要 CLI 与运行包都支持网络协议，旧运行包要显式升级。网络会话只支持客户端调试，不装配本地 Mod，使用方法见 [连接服务器](/wiki/network/server/)。

:::caution
进服验证是在本机允许无认证的 Nemisys/SynapseAPI/Nukkit 测试栈上做的，不能推及公开服务器。当前网络运行包对外 HTTP 资源包下载尚未完成验收，需要这类分发时不能视为完整支持。
:::

具体能力以所选运行包和当前实例的诊断为准。

## 游戏输入与资源重载

- 统一输入需要运行包提供单调时钟，目标会话应报告 `clock_source=launcher.steady_clock`。旧包返回 `missing_monotonic_clock` 时需要明确升级并新建实例，不能换成 CPU/墙钟或旧输入协议。输入用法见 [统一输入](/wiki/runtime/input/)。
- 输入与重载在哪些开发包版本上做过实测，见 [更新记录](https://github.com/EaseCation/mcpywrap/blob/main/CHANGELOG.md)；未列出的版本以实例诊断和实际观察为准。
- JSON UI 重载需要 `json_ui_reload_protocol=1`，旧包上 Ctrl+R 无效。重载后要重新创建业务界面和回调，不能依赖 `UiInitFinished` 自动重建。新文件和复杂继承需要单独确认。
- 已有的微软粒子文件更新后，检查新建的发射器；新增粒子可能需要重开世界。Material/Metal Shader 当前返回 `unsupported`，不要通过宽泛的资源刷新接口绕过。
- 原生结构预检失败返回 `unsupported_engine_structure`；JSON UI 局部定位失败时可以只关闭该能力。发现新 APK 不会自动启用未验证的资源接口。

重载结果的含义见 [运行时调试](/wiki/runtime/debug/)，`triggered` 不等于画面已经生效。

## 用户偏好与运行文件

画面、音量、GUI 缩放和输入偏好由 worker 按用户保存在资源根目录的 `preferences/macos` 下，新会话启动时导入。它们不是 cppconfig 世界设置，正在运行的其他实例不会即时跟随。请正常退出游戏，以便原生配置写回。

`addon_link_protocol=1` 的运行包直接读取实例的 assembled 目录，旧包走复制兼容流程。不要修改内部链接、直接写 assembled 目录或开启额外监听器。

## 游戏图标

安装 APK 时，工具从 APK 中解析应用图标，在每个引擎的 `game` 同级 `icons` 目录保存透明 PNG 和多尺寸 ICNS，并在启动前创建带中文应用名和图标的本地 `Minecraft China.app` 副本（重新 ad-hoc 签名）。原始运行包的文件和签名不变。图标缺失或转换、签名失败都不会阻止游戏启动。

已有安装在下次启动时可从匹配的 APK 缓存自动补全图标。缓存已删除时可以执行：

```sh
mcpy engine install --apk <匹配的原 APK>
```

## 限制与注意

- Map 本地运行、MCEditor、MCS 身份、本地主客机双客户端、录屏与视频提帧、原始桌面键鼠输入在 macOS 上都不支持。
- 更新 CLI 或 Skill 不会升级已有实例绑定的运行包；需要新能力时升级资源并新建实例。
- `backend` 字段只用于诊断，判断功能请看 capability 和公共状态。
