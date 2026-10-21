---
title: 截图与录屏
description: 后台截取游戏画面，在 Windows 会话上录制视频、下载 MP4 并按帧提取 PNG。
sidebar:
  order: 3
---

mcpywrap 可以在不占用前台的情况下截取游戏画面，Windows 与 macOS 使用同一条命令。视频录制和逐帧提取只在 Windows 会话上可用，Mac 可以作为调用端通过远程使用。

## 快速上手

```sh
mcpy --local --project <项目> --non-interactive screenshot --session <sid> --background-only --output <新的PNG路径> --json
```

远程会话把 `--local` 换成 `--remote <Windows HTTP endpoint>`，返回的 `image` 是调用端路径。截图是游戏内容区的物理像素，不含系统标题栏。在联调组内操作时，请明确选择成员的 session。

## 截图

### 保持后台

不占用前台的任务请保留 `--background-only`。Windows 默认截图可能从 WGC 后台捕获回退到可见窗口；后台捕获失败时，不要去掉该参数、激活游戏，或用前台截图冒充后台结果。

### macOS 要求

macOS 需要目标实例的运行包支持 `screenshot_protocol=1`，可通过 `runtime capabilities --session <sid> --json` 中的 screenshot 状态检查。旧包返回 `capability_missing`；更新 CLI 或 Skill 不会升级实例绑定的运行包，需要按 [macOS 平台](/wiki/local/macos/) 选择支持该协议的运行包并新建实例。

macOS 截图的特点：

- 从 Launcher 按需读取下一帧，不需要屏幕录制授权，也不需要 `runtime install`；
- 返回 `capture=launcher-framebuffer`、`coordinate_space=game-content`；
- 图像去掉 Launcher 菜单栏及工具浮层，不含系统光标或桌面；
- 两种 background-only 设置都不抢前台，也不回退到桌面采集；
- 每个会话同时只处理一个请求，等待渲染最多约 5 秒，像素上限 16 MiPixels。

返回 busy 时请等待；返回 `capture_timeout` 时确认游戏是否仍在渲染。窗口最小化、锁屏或暂停渲染时不保证有新帧。

:::tip
不要用高频截图循环来模拟录像，需要视频请使用下面的录制功能。
:::

## 视频录制

:::caution
macOS 本地不支持录屏和视频提帧。Mac 可以作为客户端调用远程 Windows 会话。
:::

录制前先检查执行端是否有 `record` 和 `record-frames` 能力；bootstrap 可以重复传入 `--require-capability`。新版 Skill 不代表旧 CLI 或旧原生组件支持录制。视频在 Windows 临时目录中持续写入，再下载到调用端，不需要安装 FFmpeg。

一个典型流程：录制 10 秒，同时让玩家前进，然后下载视频并提取两帧。

```sh
mcpy --remote <endpoint> --project "<调用端项目>" --non-interactive record start --session <sid> --duration 10 --fps 30 --json
mcpy --remote <endpoint> --project "<调用端项目>" --non-interactive runtime input run --session <sid> --file <移动计划.json> --json
mcpy --remote <endpoint> --project "<调用端项目>" --non-interactive record status --session <sid> --recording <rid> --json
mcpy --remote <endpoint> --project "<调用端项目>" --non-interactive record download --session <sid> --recording <rid> --output ./captures/clip.mp4 --json
mcpy --remote <endpoint> --project "<调用端项目>" --non-interactive record frames --session <sid> --recording <rid> --frame 0 --frame 30 --output ./captures/frames --json
```

移动计划：

```json
{
  "schema_version": 1,
  "steps": [{"action": "player.move", "forward": 1, "duration_ms": 2000}]
}
```

要点：

- 先完成 `runtime install`，再用 `runtime input observe` 确认处于 HUD 和玩家状态，输入用法见 [统一输入](/wiki/runtime/input/)。
- 保存 `start` 返回的 `recording` 作为 `<rid>`，后续保持同一个 endpoint、project 和 session。
- `start` 在首帧写入后返回，之后可以同时执行运行时动作。
- 用 `record status` 查询到 `completed` 后再下载或提帧。返回的 `video` / `images` / `manifest` 都是调用端路径。
- 在 Windows 本机执行时，把全局路由换成 `--local --project "<Windows项目>"`，其余参数不变。

### 参数与输出

| 项目 | 规则 |
|---|---|
| `--duration` | 整数 1–300 秒，默认 10 |
| `--fps` | 整数 1–60，默认 30 |
| 音频 | 无 |
| 并发 | 每个会话同时一次录制 |

固定帧率的视频可能重复源画面，也可能跳过游戏呈现的画面，不能保证完整捕获每一帧；PNG 是编码后的画面。判断时请检查清单中的 `frame` / `time` / `source_time` / `repeated`，查看下载的 PNG，再结合日志。

`time` 是视频内的秒数；`source_time` 是 Windows 单调时钟秒数，不是 Unix 时间，原始值保存在 `source_time_100ns`。

高分辨率或高帧率可能超出机器的编码能力。遇到 `encoder_too_slow` 时降低帧率或使用较小的游戏窗口。

### 提取帧

- `--frame` 从 0 开始，可重复，单次最多 100 个。
- 也可以重复使用 `--at <秒>`，取 `floor(秒 × fps)` 对应的帧；`--frame` 与 `--at` 互斥。
- 输出目录和 MP4 路径都必须不存在。
- 需要连续分析时分批选择帧，避免一次提取全部图片。

## 录制的生命周期

| 状态 | 能否下载 |
|---|---|
| `starting` / `recording` / `finalizing` | 不能 |
| `completed` | 可以 |
| `failed` / `interrupted` / `cancelled` | 没有可发布的视频 |
| `expired` / `deleted` | 没有产物 |

- 提前结束用 `record stop`，不会停止游戏；游戏结束也会结束录制。短片如果成功封装仍可下载，请检查 `truncated` / `end_reason`。
- `start` 超时时先用 `record status --session <sid> --list` 找回，不要盲目重录；显式传 `--request-id <32位小写hex>` 可以找回同一请求。
- MP4 和提帧 ZIP 下载校验后才发布到调用端。断线可以重试到一个尚不存在的目标路径，不支持断点续传。
- 执行端产物完成后保留 24 小时，过期文件在后续命令或服务启动时清理；游戏退出后仍可下载。
- 文件下载完成后可以执行 `record delete --session <sid> --recording <rid>`，它只删除执行端的产物。

服务只接受归属该会话的录制 ID。

## 限制与注意

- 窗口最小化、锁屏、关闭、尺寸变化，或持续采集不到帧，都可能结束录制，且不会自动回退到桌面捕获；正常遮挡也可能因游戏暂停渲染而结束录制。
- 远程服务的配置见 [远程执行](/wiki/network/remote/)，录制异常的排查见 [故障排查](/wiki/reference/troubleshooting/)。
- 日常 UI 和玩家操作请使用 [统一输入](/wiki/runtime/input/)。
