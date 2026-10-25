---
title: mcpy Android
description: 在 Android 手机上创建作品、编辑源码、构建真实游戏测试并查看日志。
sidebar:
  order: 3
---

import { Image } from 'astro:assets';
import code from '../../../assets/captures/android/01-code-and-live-game.png';
import logs from '../../../assets/captures/android/02-search-logs-and-live-game.png';
import tools from '../../../assets/captures/android/03-tools-and-live-game.png';
import projects from '../../../assets/captures/android/04-projects-and-test-controls.png';

mcpy Android 是面向《我的世界》中国版模组开发的手机源码工作台。你可以在手机上创建或导入作品，编辑 Python / JSON 文件，构建并启动真实游戏测试；游戏以小窗显示，开发界面继续可用。

[下载 Android 预览版](https://github.com/EaseCation/mcpywrap-android/releases/download/nightly/mcpywrap-android-nightly-arm64.apk) · [打开 Nightly 发布页](https://github.com/EaseCation/mcpywrap-android/releases/tag/nightly) · [Android 项目源码](https://github.com/EaseCation/mcpywrap-android)

下载按钮使用 GitHub Release 的固定地址。当前是 Nightly 预发布，适用于 Android 11+、ARM64；Android 13+ 且设备支持时，加载阶段即可使用画中画。首次使用需要在 App 内安装游戏运行环境，建议预留约 7 GB 可用空间。

## 一次完整流程

1. 下载并安装 App，授权公共工作目录。
2. 新建标准作品或欢迎语示例，也可以导入 ZIP、mcpack、mcaddon、文件夹或公开 HTTPS Git 仓库。
3. 在 App 内编辑源码，保存后从作品入口运行测试实例。
4. 通过游戏小窗观察效果，在日志页搜索客户端、服务端、游戏或引擎输出。
5. 修改代码后重新测试；运行中的作品会先保存退出，再构建并启动同一测试实例。

<Image src={code} alt="mcpy Android 编辑 Python 源码，右下角显示真实游戏小窗。" />

图中展示手机编辑器、源码路径和真实游戏画面同时出现。源码保存在公共工作目录 `/sdcard/mcpy` 下，手机内外的工具都可以继续访问同一份文件。

## 作品与测试实例

作品是开发入口，测试实例归属于作品。作品页可以新建、导入、重命名、导出、回收和恢复；运行中的作品卡片提供查看日志、重新测试、返回游戏和保存退出。

<Image src={projects} alt="mcpy Android 作品页，显示新建作品、导入、当前运行实例、查看日志和重新测试。" />

这套关系避免用户另外维护一套与源码无关的世界列表。重新测试沿用同一作品和测试实例的关联；涉及依赖、入口或资源结构的变化时，按实际运行结果决定是否需要完整重载。

## 日志与调试

日志页连续显示真实输出，可以在全部、客户端、服务端和游戏来源之间切换，按关键词搜索、匹配高亮、过滤级别、暂停更新或回到最新记录。

<Image src={logs} alt="mcpy Android 运行日志页，搜索 alive 并高亮匹配日志，同时显示真实游戏小窗。" />

日志着色和搜索用于定位信息，不自动判断 Mod 是否健康，也不能替代对游戏现象的观察。通过标准 CLI / 接口还可以查询会话、执行受支持的客户端或服务端 Python、进行源码热更和获取完整画面截图，具体能力以当前运行环境为准。

## 用自己的工具继续开发

你可以直接在 App 内开发，也可以搭配 Minis、Termux、其他编辑器或 AI Agent：

<Image src={tools} alt="mcpy Android 开发页，说明外部工具编辑共享作品目录、mcpy 构建启动并在游戏小窗显示结果。" />

外部工具负责编辑源码和发出标准开发命令，mcpy Android 内的共享核心负责工程解析、构建、资源组装和游戏启动。配对连接需要用户确认；Minis 是推荐选项，不是协议依赖，AI 也不是使用 App 的前置条件。

## 文件、环境与边界

- 源码、测试实例、导出和日志位于公共工作目录，不锁在 App 私有数据中。
- App 内的构建核心与游戏运行环境分开管理；构建核心可独立检查、安装和回滚已适配的版本。
- App 不包含官方游戏 APK 或资源；运行环境在 App 内另行下载并校验。
- 当前围绕 Addon / 模组开发，不宣传地图工程、多客户端同时联调或任意 Android 机型后台无感启动。
- 厂商后台限制可能影响画中画、通知或后台进程，按 App 的权限和恢复提示操作。

更多资料：[Android 项目 CI 与下载](https://github.com/EaseCation/mcpywrap-android/blob/main/docs/ci.md) · [本机接入协议](https://github.com/EaseCation/mcpywrap-android/blob/main/docs/local-host-api.md) · [mcpy Python 项目](https://github.com/EaseCation/mcpywrap)
