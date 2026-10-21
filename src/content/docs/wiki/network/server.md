---
title: 连接服务器
description: 让中国版开发客户端连接外部基岩版游戏服务器，并按需使用 MC Studio 登录身份。
sidebar:
  order: 1
---

`mcpy connect` 让开发客户端直接进入一台外部游戏服务器，用来调试服务器上的玩法，而不是创建本地世界。如果你在开发 Nukkit 这类基岩版服务端，可以用它快速拉起客户端进服、跑客户端 Python 探针、抓日志，测完再一键结束。

:::note
网络会话不部署本地 Mod，只提供客户端 Python。服务端 Python、本地 Mod 热更和外服服务端部署都不属于网络会话的能力。
:::

## 快速上手

在本机连接服务器：

```sh
mcpy --local --project <会话目录> --non-interactive connect <游戏服务器> --port 19132 --detach --json
```

通过另一台 Windows 上的远程服务连接（首次使用先看 [远程执行](/wiki/network/remote/)）：

```sh
mcpy --remote <Windows服务HTTP地址> --project <调用端目录> --non-interactive connect <游戏服务器> --port 19132 --detach --json
```

几点说明：

- `connect` 只用项目目录存放和定位会话，不要求先 `init`，也不读取项目里的 server 目标等配置。
- 远端调用必须加 `--detach`；本机由脚本或 AI 调用时也建议使用 `--detach`。
- 游戏服务器的地址和 UDP 端口，与 Windows 远程服务的 HTTP endpoint 是两个不同的地址。调用端的 `localhost` 并不代表远程 Windows 上的 `localhost`，服务器必须从执行游戏的那台机器可达。

## 为项目固定服务器目标

如果项目长期连接同一台服务器，可以在 `pyproject.toml` 里配置：

```toml
[tool.mcpywrap.server]
host = "127.0.0.1"
port = 19132
```

之后用 `run` 即可进服：

```sh
mcpy --local --project <项目> --non-interactive run --no-gui --detach --json
```

远端把 `--local` 换成 `--remote <endpoint>`，并保留 `--detach`。

配置了 server 的 `run` 会校验本机项目和依赖，但不会装配、上传或安装本地 Mod，也不会执行 `before_run`。网络模式不接受 Map、`--new`、世界创建选项或实例 ID。

## 平台与身份

| 执行端 | 能力边界 |
|---|---|
| Windows 本机或 HTTP 服务 | 网络会话；可按需显式传 `--mcs-auth` |
| Apple Silicon macOS | 只能连接允许无认证开发客户端的服务器；运行包须支持网络协议，见 [macOS 平台](/wiki/local/macos/) |
| 两个本机客户端 | 见 [双客户端](/wiki/network/dual-clients/)，不能靠复制单会话参数或同一账号来模拟多玩家 |

macOS 的实例运行包需要支持 `network_connect_protocol=1`。mcpywrap 曾在 macOS 上通过本机 Nemisys + SynapseAPI + Nukkit 测试栈验证 connect、项目 run、Python 与失败清理（具体环境见 [更新记录](https://github.com/EaseCation/mcpywrap/blob/main/CHANGELOG.md)）；这次验证不包含 MCS/MPay 登录、外部 HTTP 资源包或统一输入，也不能推及公开服务器。

:::caution
公开服务器是否接受开发客户端，取决于它自己的认证和协议。工具启动成功不代表服务器会放行。当前网络运行包的外部 HTTP 资源包下载尚未完成验收，需要这类分发时不能视为完整支持。
:::

## 使用 MC Studio 登录身份

登录始终由 MC Studio 完成。`--mcs-auth` 只在本次启动时读取已登录的身份，不代填密码，默认不启用，失败时也不会悄悄改用匿名身份。

```sh
mcpy connect 192.168.31.101 --port 19132 --mcs-auth
mcpy run --mcs-auth
mcpy ui --mcs-auth
```

- `--mcs-auth` 是每次启动的选择，不写入 `server.auth`，配置文件也不能自动启用它。
- 使用前由用户在 Windows 上登录 MC Studio，并先用 `mcpy doctor --mcs-auth --json` 检查组件与策略。这个检查只读组件文件，不读取身份、不写缓存、不修改证书。
- 网络目标用 CLI；GUI 登录只支持单人项目。macOS 不支持 MCS 身份，可由 Windows 服务提供。
- `MCPY_REMOTE_TOKEN` 只保护远程 HTTP 服务的访问，与游戏身份无关。

几种状态要分开理解：组件存在不等于已登录，`identity_provided` 不等于服务器已接受认证。身份过期后重新获取并新建会话；目前没有自动刷新，也不要通过复制账户文件或修改设备身份来解决。MCS 必须保持运行，重新登录后应重新启动测试。

### 你可能看到的提示

- MCS 未运行或未完成登录：先打开并登录；普通测试可以去掉 `--mcs-auth`。
- 组件可以正常启用：直接继续，无需安装证书。
- 组件被阻止，且完整签名只缺根信任：交互模式下会提供"信任此发布者并重试"，默认选择取消。确认前会展示用途、信任范围、发布者、指纹与有效期。
- 安装证书后仍失败：停止重试。系统或组织策略可能仍在阻止组件，工具不会关闭 Windows 安全保护。
- 使用 `--non-interactive` 或 `--json` 时，不弹对话框、不读取确认输入、不安装证书。JSON 包含 `ok`、`error`、`hint`，身份失败还有 `code`，例如 `studio_unavailable`、`component_blocked`。

### 证书与隐私

登录组件使用项目自签名证书，不是公共 CA 认证的发布者。证书只在你明确同意后加入当前用户的"受信任的根证书颁发机构"，不写入整机证书库。同一证书签署的其他代码也可能因此获得信任；它也不能覆盖 Smart App Control 或企业应用控制。

登录信息通过当前用户专用的一次性命名管道返回，不放进命令行或会话记录。游戏需要的身份只写入本次运行配置，退出后删除；日志写入磁盘前会脱敏。

不再使用时，去掉 `--mcs-auth` 即可。若曾安装证书，可以打开 `certmgr.msc`，在当前用户的"受信任的根证书颁发机构 → 证书"中找到 `mcpywrap Project Code Signing`，核对指纹后移除，不要移除其他证书。证书指纹与文件 SHA-256 记录在 [manifest.json](https://github.com/EaseCation/mcpywrap/blob/main/mcpywrap/mcstudio/bridge_payload/manifest.json) 中。

## 查询、调试与退出

保存好 endpoint、project 和 session，后续都用同一组目标：

```sh
mcpy --local --project <会话目录> status --list --json
mcpy --local --project <会话目录> logs --source game --json
mcpy --local --project <会话目录> stop --session <sid> --json
```

`logs --source` 可选 `game`、`engine`、`worker`。在网络会话里执行客户端 Python：

```sh
mcpy --local --project <会话目录> runtime py --session <sid> --side client --file <本机探针.py> --json
```

结果处理见 [运行时调试](/wiki/runtime/debug/)，游戏输入见 [统一输入](/wiki/runtime/input/)。

判断是否真的进服：进程 `running` 不证明已进服，要结合日志、HUD 和业务状态核验。macOS 单会话的 `connection_verified` 只表示曾观察到 HUD，不是持续的在线探活，也不是身份认证。

### 一次性冒烟测试

只需要连接、执行探针、检查日志并自动结束时，可以使用 Skill 目录下的 [scripts/smoke.py](https://github.com/EaseCation/mcpywrap/blob/main/skills/mcpywrap/scripts/smoke.py)：

```sh
scripts/smoke.py --project <目录> --command <本机mcpy> --local --connect <服务器> --port 19132 --expect-log <标记>
```

远程把 `--local` 换成 `--remote`。这个模式不执行 package，不验证本地资源分发；没有日志标记或探针时，只能证明进程启动过。

## 限制与注意

- 响应丢失时先用 `status --list` 找回，不要重复创建会话。有 `request_id` 时按原请求和相同参数查询或重试，不要换新 ID 盲目重发有副作用的操作。
- 一次性测试结束后停止自己创建的会话；需要保留时记下目标信息。
- 远程 EXE 和下载目录由 Windows `serve` 配置；调用端可以按帮助覆盖完整 engine-version，但不要把 Windows 文件路径当成本机项目路径。
- 两名玩家同时进服见 [双客户端](/wiki/network/dual-clients/)。
