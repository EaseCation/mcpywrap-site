---
title: VS Code 插件
description: 在 VS Code 中准备 ModSDK 补全，管理测试世界，查看原生日志，并在游戏中执行 Python 与热更模块。
sidebar:
  order: 3
---

[mcpywrap — 游戏测试工作区](https://marketplace.visualstudio.com/items?itemName=easecation.mcpywrap-vscode)把项目、测试世界、游戏日志和运行时 Python 接进 VS Code。扩展调用独立安装的 mcpy CLI，使用同一套项目与游戏会话。

## 安装与准备

1. 按[安装指南](/wiki/start/install/)安装 mcpywrap，确认 `mcpy --help` 可用。
2. 从 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=easecation.mcpywrap-vscode)安装扩展，标识为 `easecation.mcpywrap-vscode`。也可以运行：

   ```sh
   code --install-extension easecation.mcpywrap-vscode
   ```

3. 安装并启用 Microsoft Python 和 Pylance，它们负责普通 Python 文件的语言服务。
4. 打开一个已由 mcpy 初始化、在 `pyproject.toml` 中声明了 `[tool.mcpywrap]` 的项目，并信任该工作区。

扩展会自动识别多根工作区和嵌套项目。打开项目内文件后，编辑器右上角出现“运行测试”和“游戏测试”菜单；左侧活动栏提供“游戏测试”工作区。

若 VS Code 找不到 mcpy，执行“mcpy: 配置 CLI 路径”，填写 mcpy 可执行文件的完整路径。版本兼容要求以[扩展说明](https://github.com/EaseCation/mcpywrap-vscode#readme)为准；功能提示 CLI 过旧时升级 mcpy 后重试。

## 准备 ModSDK 自动补全

打开普通项目 `.py` 文件，使用 Microsoft Python 的“选择解释器”选定开发环境，再点击状态栏的 **ModSDK**，或选择“游戏测试 → Python 开发环境与补全”。

扩展会显示当前文件实际使用的解释器、环境位置及已安装的 SDK。选择“安装 / 切换 ModSDK 补全库”，再选择与目标游戏匹配的 SDK 版本，确认安装目标。安装完成后，扩展会核验补全库是否位于该环境中。

- 支持项目虚拟环境，包括尚未安装 pip 的虚拟环境。
- 缺少补全库时会提示准备；安装和版本选择由你确认。
- 普通 Python 文件的 API 补全和代码跳转由 Pylance 提供。如果未刷新，可在管理菜单中选择“刷新 Python 补全服务”。
- 多项目的解释器作用域以 Microsoft Python 的实际选择为准；嵌套项目不一定各自使用独立环境。

:::note[开发环境与游戏环境]
补全库安装到 VS Code 使用的宿主 Python。游戏仍使用引擎内置 Python；补全库不会被打包进游戏，也不会改变游戏的 Python 版本。
:::

## 管理项目与测试世界

“游戏测试”侧栏展示项目下的世界、会话及联调组：

| 对象 | 用途 |
| --- | --- |
| 项目 | 当前源码及其 mcpy 配置；可直接运行测试 |
| 世界 | 保留进度的测试存档；从世界节点启动指定世界 |
| 会话 | 一次游戏运行；可连接日志、执行 Python 或停止测试 |
| 联调组 | 双客户端的成员集合；可查看成员并停止整组 |

从编辑器右上角点击“运行测试”使用当前项目的默认世界；“游戏测试”菜单还提供“新建测试世界”和“双客户端测试”。本地双客户端的支持范围以平台能力为准，客机可能需要手动从局域网列表加入。

如果运行操作复用了已有游戏进程，新修改的源码不会因此自动部署。修改模块可使用下文的手动热更；涉及入口、依赖或资源结构的变化，按[本地世界](/wiki/local/worlds/)说明重新部署。

## 在原生输出面板看日志

启动测试后，准备信息立即进入 **mcpy · 引擎** 输出通道。取得游戏会话后，扩展订阅持续日志，默认展示 **mcpy · 脚本系统**。

在 VS Code 输出面板的来源下拉框切换通道，或使用“切换引擎 / 脚本系统”。搜索、复制、清空和滚动锁定均沿用 VS Code 原生交互，日志按类型染色。“切换协议详情”可以展开或收起协议回显。

对已经运行的会话，使用“连接会话日志”接入；需要一次性查询时使用“查看日志快照”。关闭输出面板或断开日志订阅会保留游戏。

## 执行游戏内 Python

可以在项目 Python 文件中选中代码，右键选择“在游戏中执行 Python 选区”；也可以使用独立草稿：

1. 启动测试或连接已有会话日志。
2. 执行“新建运行时 Python 片段”，选择具体会话和可用端侧：`client` 或 `server`。
3. 在“游戏内 Python (mcpy)”编辑器中写代码。
4. 点击顶部“在游戏执行（无需保存）”，或按 **Ctrl+Enter / macOS ⌘+Enter**。存在选区时执行选区，否则执行整个草稿的当前内容。
5. 在脚本系统输出中查看执行目标、输出、错误和游戏回执。

草稿存放在扩展专用目录，不写进业务项目。它目前提供语法高亮和基本编辑支持；完整的 Pylance 补全用于普通 Python 文件。

例如，在已就绪的本地世界中，选择客户端执行下面的只读查询：

```python
import mod.client.extraClientApi as clientApi

player_id = clientApi.GetLocalPlayerId()
factory = clientApi.GetEngineCompFactory()
position = factory.CreatePos(player_id).GetPos()
print("Player position: {}".format(position))
```

代码在所选游戏会话内执行，受目标引擎的 Python 和 ModSDK 约束。服务端执行仅在会话确实提供该能力时出现；外部服务器连接不意味着可以执行服务器代码。

## 手动热更模块

保存项目 Python 文件，点击编辑器右上角的热更按钮，或执行“mcpy: 热更当前 Python 模块”。选择会话和端侧后，扩展请求 mcpy 更新模块；联调组成员的更新通过组入口协调。

热更不会重建已有对象、替换已注册回调或撤销之前的副作用。事件注册、类结构和入口变化可能需要重新运行。详细边界见[运行时调试](/wiki/runtime/debug/)。

:::note[执行与验证]
执行完成表示游戏返回了该请求的完成回执，玩法效果仍需观察。结果未知或超时时，先检查原会话与日志，避免重复执行有副作用的代码。
:::

## 支持范围

当前面向 Windows 和 Apple Silicon macOS 的本机桌面工作区，游戏需要图形会话和 GPU。Remote SSH / WSL 的游戏操作尚未接入。

扩展目前提供手动运行、代码执行和模块热更；保存后自动热更、Test Explorer、断点调试与完整项目配置编辑器尚未实现。明确结束测试时使用停止命令；关闭编辑器不会自动结束游戏。

[插件源码与反馈](https://github.com/EaseCation/mcpywrap-vscode) · [离线 VSIX 下载](https://github.com/EaseCation/mcpywrap-vscode/releases)
