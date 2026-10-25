# 当前实机素材

`macos-weapon-demo.png` 用于首页 macOS 区块，替换双平台示意动画。

- 采集日期：2026-10-21。
- 项目：`netease-addons/ec-weapon-demo`，通过本机 mcpywrap 启动。
- 场景：新建无限世界，种子 `12345`，自然生成的雪山与针叶林，第一人称持枪。
- 来源：用户手动截取的 macOS 窗口，最终指定文件 `codex-clipboard-18f198aa-ce7e-41d0-a1c2-a7ea650cbeb9.png`。
- 原图：1664 × 1248，保留透明通道、原生窗口标题栏、红绿灯及阴影；按原始字节保存，不裁剪、不拼接、不重绘。
- 网页：直接引用原始 PNG，不转为有损格式；桌面最大显示宽度为原图一半（832 CSS 像素），保留原生 2× 分辨率。窄屏按容器缩小，直接使用原图的窗口外框和阴影，不叠加模拟窗口。

## VS Code 工作区

- `vscode-hello-addon.png`：用户于 2026-10-21 手动提供的 Hello Addon 实机截图，保留原始 PNG、macOS 红绿灯和窗口投影，未重绘或替换界面内容。
- 图中为独立 VS Code 展示环境：Python、Pylance、mcpywrap 与对应语言/环境支持扩展；项目 ModSDK 补全库已安装并由插件识别。
- 画面展示项目源码、原生脚本系统输出及世界/会话管理。截图本身不作为代码补全弹窗或运行时执行回执的证据。
- 演示项目及隔离编辑器位于忽略的 `.local/vscode-showcase/`，不进入公开网站仓库。

## mcpy Android

- `android/01-code-and-live-game.png` 至 `04-projects-and-test-controls.png`：来自 `mcpy-android-web-handoff-20261025.zip` 的真实 Android 截图，展示源码编辑、日志搜索、外部工具协作及作品/测试实例管理。
- 图片保留手机状态栏和右下角游戏画中画，网页仅等比缩放，不把画面重绘成产品 mockup。
- 下载入口固定指向 GitHub Release 的 `nightly` APK；页面文案使用 Nightly 预发布、Android 11+、ARM64 和首次安装运行环境等交接包已核对信息。

## Wiki 图解（2026-10-21）

`wiki/raw/` 保存实机原始采集。`src/data/wiki-captures.json` 记录裁剪范围、高亮区域与编号说明，`node scripts/annotate-captures.mjs` 生成 `public/wiki-images/` 下的无损 WebP。只裁剪和叠加编号框，不重绘控件、不伪造日志；点击文档中的图片可打开原分辨率标注图。

- `ui-*.png`：Computer Use 采集本机 mcpy ui；使用 Hello Addon 项目，接入已有会话。窗口总览、Git/QuMod 表单、世界设置、日志搜索、Python 查询及运行环境对话框均来自实际界面。世界创建和安装对话框只查看并取消，没有创建额外世界或重装运行资源。
- `ui-python.png`：通过 GUI 的 client 控制台执行示例组件的 `player_position()`，收到实际坐标和 completed。
- `vscode-environment.png`：独立 VS Code 展示环境的 ModSDK 菜单，读取实际已安装的项目虚拟环境。
- `vscode-runtime.png`：在独立游戏内草稿中执行同一只读查询，展示 client 目标、真实游戏回执和坐标。截图中尚未保存的草稿不属于业务项目。
- `vscode-workspace.png`：沿用用户提供的原始 Hello Addon 工作区截图，派生工作区导览与项目结构局部图。
- Qt 采集使用独立 Python / PySide6 环境。较新的 Qt Cocoa 无障碍层在自动读取时崩溃，改用兼容 Qt 采集；同时修复了 `SessionController.connect` 遮蔽 `QObject.connect` 的命名冲突。此修改不改变 GUI 布局或服务器连接语义。
- 画面中的版本、会话 ID、时间及路径只记录采集现场，不作为文档要求或需要照抄的参数。
