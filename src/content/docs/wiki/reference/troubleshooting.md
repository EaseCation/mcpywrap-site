---
title: 故障排查
description: 按错误码或现象定位问题，找到下一步处理方式，而不是重跑整条流程。
sidebar:
  order: 1
---

> 适用于 mcpywrap 0.5.4。

遇到问题时，按错误码或现象在下面的表里找到对应处理，不必从头重跑整条流程。

## 先记录现场

动手前先保存：

- 目标：project、endpoint、session、group；
- 退出码，以及返回里的 `error`、`code`、`hint`；
- 日志位置。

两条通用原则：查询状态不会触发构建或预处理；结果为 `unknown` 不代表操作没有执行。

## 准备、部署与生命周期

| 错误或现象 | 下一步 |
|---|---|
| 缺少命令、选项或能力 | 核对实际安装的 CLI 和目标 worker / 运行包，见 [安装](/wiki/start/install/)。不要靠更新 Skill 猜测支持 |
| `init` 拒绝已有配置 | 继续使用原项目；需要恢复依赖时执行 `sync`，不要删配置 |
| 计划 `ok=true`，但 `ready=false` / `complete=false` | 查询成功不代表可以构建，按 diagnostics 修复。旧的 `script list --json` 不含依赖任务，见 [依赖的资源准备](/wiki/project/consumer-prepare/) |
| `prepare_environment_unavailable` / `prepare_python_unavailable` | 核对计划中的解释器及来源要求。`sync` 可以创建缺失的环境，但不会重建已有环境或下载 Python |
| `consumer_config_invalid` / 依赖任务未执行 | 查看配置 issues 和 enabled / disabled / not_transitive 状态，按 [依赖的资源准备](/wiki/project/consumer-prepare/) 处理。不要自动补旧 hooks 或停用失败任务 |
| `source_matches=true`，但修改的表格没生效 | 这只比较当前包文件；接管的会话没有执行预处理，见 [项目脚本](/wiki/project/scripts/) |
| `already_running` | 已接管现有会话，不是重启或重新部署。按 [本地世界](/wiki/local/worlds/) 选择更新方式 |
| `busy` / `deployment_in_use` / `world_in_use` | 对同一项目执行 `status --list` 查看真实的占用者；只停止自己拥有或用户指定的目标，不要清锁 |
| `managed_output` | build / dev 指向了运行目录。改用独立构建目录，游戏更新走 runtime 或重新 run |
| `restart_required` | 依赖、身份、布局等变化无法热更。停止相关读者后重开原世界，不要用 `--new` 绕过 |
| `source_changed` | 装配期间输入发生了变化。停止持续写入，稳定后重新发起，不要无限重试 |
| `deployment_modified` | 运行产物被外部改写。保留现场，核对改动和所属会话，不要清空全局包 |
| `recovery_required` | 进程身份、退出状态或事务恢复无法确认。保留恢复路径与日志，先查 status / worker / engine，不要删记录或按进程名杀进程 |
| `instance_not_ready` | 创建失败的实例不是可用世界。按提示显式重试该实例；确实需要新世界时用 `--new` |
| 游戏启动超时 / 响应丢失 | 用 `status --list` 找回。观察者超时不代表有权取消别人发起的启动 |
| PID 身份不匹配 | 不要操作这个 PID。确认旧会话是否已结束，不能把被复用的 PID 当成原游戏 |
| 已退出但担心存档 | Windows 进程退出不保证世界已保存，重要世界应先在游戏内正常保存 |

## 双客户端与项目脚本

| 错误或现象 | 下一步 |
|---|---|
| `waiting_for_join` | 客机在等你点击指定的局域网卡片，不要重开第二个独立世界 |
| `group_not_ready` / 玩家未确认 | 用 `status --group` 查看成员与加入目标，有限等待，保留仍然成功的主机 |
| `group_required` | 用 group 更新，单个 session 不能绕过组协调 |
| `resource_sync_unverified` | 当前不支持组资源热更。重开整组并重新加入，不要只更新主机 |
| `partial` / 某成员失败 | 逐个成员、逐个端侧核验；只重试合适的失败成员，不能宣称整组回滚或整组成功 |
| `script_failed` / `script_timeout` / `script_cancelled` | 查看 `script`、`script_exit_code`、`script_log`。本次后续流程没有继续，但源码可能已被修改 |
| `script_config_invalid` / `script_not_found` | 核对主项目任务表、命令路径与工具解释器，不要向游戏环境 `pip install` |
| `script_config_changed` | 配置、锁、包身份、世界配置或准备工具源码在操作期间发生变化。按具体错误稳定输入后再显式重发 |
| `script_recursion` | 不要在脚本里递归调用 mcpy 写操作，把组合逻辑放进脚本语言 |
| `script_recovery_required` | 按 `script_state` 核对本次脚本进程及其子进程；未确认退出前不要删 active / 锁记录 |

用法分别见 [双客户端](/wiki/network/dual-clients/) 和 [项目脚本](/wiki/project/scripts/)。

:::caution
外部生成器或已开启的 watcher 可能读到脚本写到一半的源码。批量处理前先暂停监控；源码不会自动回滚。
:::

## 依赖与环境

- 只在开发环境可用、游戏里 import 失败：检查实际组装的内容、入口和游戏解释器，这不是反复 pip 安装的理由。Git / QuMod、跨平台锁与源码缓存问题见 [依赖与 QuMod](/wiki/project/dependencies/)。
- 已执行 `mcpy add`，但依赖的资源准备仍缺库：准备环境与项目 `.venv` 不是同一个环境。按 [依赖的资源准备](/wiki/project/consumer-prepare/) 中的实际解释器修复，不要重复装到 mcpy 环境。
- 游戏包里有原生二进制：把工具依赖移出包，使用适配游戏的实现，不要绕过校验。
- uv 的 Python 链接失效：`bootstrap.py` 用 `--python <本机解释器>`，PowerShell 用 `-Python <路径>`。
- 找不到引擎或皮肤：本机执行 `doctor`；远程时在 Windows 服务端准备资源和路径。macOS 原生资源错误见 [macOS 平台](/wiki/local/macos/)。

## 网络与登录

| 错误或现象 | 下一步 |
|---|---|
| `unauthorized` | 检查 HTTP 服务两端的 `MCPY_REMOTE_TOKEN`，这不是 MCS 登录问题 |
| `remote_unavailable` / `protocol_mismatch` / `capability_missing` | 检查 endpoint 和相应端的版本，不会回退本机。见 [远程执行](/wiki/network/remote/) |
| `component_unavailable` | 确认当前构建包含 Windows 原生登录组件。普通用户不需要源码，只有明确的源码开发任务才去仓库开发文档构建 |
| `studio_unavailable` | 由用户登录 MC Studio；有多个实例时需明确目标 |
| `component_blocked` | 按策略错误报告，不会自动安装证书或关闭系统保护 |

`identity_provided`、`authenticated`、`connection_verified` 属于不同的验证阶段，不要把其中任何一个当成业务全部成功。详见 [连接服务器](/wiki/network/server/)。

## 输入与截图

- 新输入返回 `unknown`、`busy` 或释放失败：按 [统一输入](/wiki/runtime/input/) 查原 `operation_id`，修复后用 `input stop` 重试释放，不要重发整个计划。
- 后台截图失败：按 [截图与录屏](/wiki/runtime/capture/) 报告限制，不会自动抢前台或替换后端。
- macOS 截图 `capability_missing`：检查实例的运行包，而不是去授予屏幕录制权限。
- macOS `capture_timeout`：没有及时取得有效的渲染帧。
- 录屏和视频提帧在 macOS 本地始终不支持。
- 原始设备操作确实允许前台时，才需要处理焦点、窗口尺寸或遮挡；调用端的桌面工具无法恢复不可见的远端窗口。

## 录制与提帧

| 错误或现象 | 下一步 |
|---|---|
| `capability_missing` | 检查执行端的 media / 原生组件。安装 FFmpeg 不能修复 Windows 系统录制能力 |
| `busy` | 同一会话已有录像或产物在处理，先查原任务。录制不占用输入操作锁 |
| `recording_timeout` | 用错误返回的 ID 或 `record status --session <sid> --list` 找回，不要立刻再录 |
| `truncated` | 核对 `end_reason`。短片封装完成不代表业务完成 |
| `invalid_response` | 校验失败，目标未发布。检查两端后重试到新目标 |
| `expired` / `deleted` | 源产物已被清理 |

完整操作与保留期见 [截图与录屏](/wiki/runtime/capture/)。

## Windows 编码

- JSON 中的 ASCII 转义用 `json.loads` 或 `ConvertFrom-Json` 还原，不要直接在原始 JSON 文本里搜中文。
- 脚本读写时明确使用 UTF-8，并接受 BOM；`bootstrap.ps1` 保留 UTF-8 BOM 和管道编码。
- PowerShell 5.1 的 `>` / `Out-File` 默认可能生成 UTF-16，写 JSON 时明确加 `-Encoding utf8`。
- SDK 和引擎日志兼容 UTF-8、GBK / GB18030 输入，CLI 统一保存为 UTF-8。
