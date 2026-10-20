---
title: 远程执行
description: 在一台 Windows 上运行 mcpy 服务，从另一台机器远程启动网络会话并调试游戏。
sidebar:
  order: 3
---

> 适用于 mcpywrap 0.5.4。

远程执行让游戏跑在一台 Windows 上，而命令从另一台机器（例如 macOS 开发机）发出。Windows 端运行 `mcpy serve` 提供 HTTP 服务，调用端用 `--remote <endpoint>` 路由命令。

如果只是在本机连接游戏服务器，不需要本页，直接看 [连接服务器](/wiki/network/server/)。

:::caution
远程只支持网络单会话。不支持本地世界和实例管理、双客户端、Qt / MCEditor、服务端 Python、本地资源部署或 reload / watch。它也不是另一台机器的文件同步工具。
:::

## 快速上手

1. 两端各自安装 CLI 和完整 Skill（命令路径不通用），见 [安装](/wiki/start/install/)。
2. 两端设置相同的 `MCPY_REMOTE_TOKEN`。
3. 在 Windows 上启动服务：

   ```sh
   mcpy --local serve
   ```

4. 在调用端检查连通性：

   ```sh
   mcpy --remote http://192.168.1.20:18765 --non-interactive doctor --capabilities --json
   ```

5. 按 [连接服务器](/wiki/network/server/) 启动网络会话，每条命令都带 `--remote`。

## Windows 端准备

Windows 需要满足：

- 已登录、未锁屏的图形桌面；
- 有匹配的 MC Studio 引擎。

服务不会自动注册后台任务，也不会修改防火墙。启动前可以先检查：

```sh
mcpy --local doctor --capabilities --json
mcpy --local doctor --json
mcpy --local serve
```

`serve` 是持续运行的前台命令，不加 `--json`。默认监听 `0.0.0.0:18765`，调用端要使用 Windows 的实际 IP，不能连接 `0.0.0.0`。可以用 `--host`、`--port`、`--data-dir` 修改；游戏 EXE 和下载目录的覆盖也在服务端配置，调用端不直接覆盖。

服务会话保存在 data-dir，默认位于用户目录下的 `.local/share/mcpywrap/remote`。

### 访问令牌

默认需要在 Windows 与调用端设置相同的 `MCPY_REMOTE_TOKEN`。只有在你明确选择无认证服务时才使用：

```sh
mcpy --local serve --no-token
```

:::caution
`--no-token` 会忽略已有令牌，启动输出会标明无认证模式。此时任何能访问该端口的设备都可以执行客户端 Python，只应在可信网络中使用。
:::

HTTP 令牌不是 MCS 游戏身份；游戏登录流程见 [连接服务器](/wiki/network/server/#使用-mc-studio-登录身份)。

Git 或可编辑安装可能缺少 CI 生成的原生组件，按 `doctor` 的实际诊断处理，不要为此改装旧版本而丢失当前功能。

## 调用端检查

调用端不需要运行 Windows 游戏，也不会用本机桌面操作代替远端。跨机命令不需要打开 Qt。

```sh
uv run --no-project --python 3.12 "<skill>/scripts/bootstrap.py" --remote http://192.168.1.20:18765 --require-capability remote-client --require-capability network-sessions --require-capability py
mcpy --remote http://192.168.1.20:18765 --non-interactive doctor --capabilities --json
```

- 需要输入或截图时再追加 `unified-input`、`screenshot` 能力要求，单纯看日志的任务不必强加无关能力。
- `bootstrap --remote` 只做检测，不保存路由。每次独立调用都明确带 `--remote`，或确认当前进程继承了 `MCPY_REMOTE`。
- 路由优先级：显式 `--local` / `--remote` → `MCPY_REMOTE` → 项目 `[tool.mcpywrap].remote_url`。
- `remote.ok=false` 时先处理服务问题。远端失败不会回退到本机。

游戏服务器必须从 Windows 可达。例如调用端的 `localhost` 不会自动变成 Windows 上的服务器地址。

### 哪些在调用端，哪些在 Windows

`init`、`add`、`build`、`package`、`script` 等项目命令始终在调用端执行，不会因为配置了 remote 而上传项目。返回结果里的路径要分清归属：

| 路径 / 标识 | 含义 |
|---|---|
| `bootstrap.command` | 调用端 mcpy 路径，辅助脚本的 `--command` 使用它 |
| `endpoint` + `session` | 远程会话身份，后续命令保持同一组合 |
| `project` | 调用端已有目录；项目命令和脚本仍在这里运行 |
| `remote_project`、`executable`、`log_path` | Windows 路径，不在调用端打开或执行；日志通过 `logs` 获取 |
| `image`、`video`、`images` | 下载完成后的调用端路径，可以直接查看 |

## 观察与恢复

游戏输入见 [统一输入](/wiki/runtime/input/)，Windows 截图和录制见 [截图与录屏](/wiki/runtime/capture/)。所有操作都要绑定同一服务和同一 session；失败时不会转用调用端的键鼠或桌面截图。

- 响应丢失：先对同一 endpoint 执行 `status --list` 找回。
- 服务异常退出：用原 data-dir 重新启动服务，可以找回所属会话。无法核对 PID 身份时，不要按进程名批量终止。
- 输入结果为 `unknown`：查原 `operation_id`。HTTP 请求超时不能说明操作没有执行。

## 限制与注意

- Windows 上 `serve` 退出时会处理它所属的游戏；调用端命令结束不会自动停止远程会话。需要持续服务时，保持服务进程和图形会话不退出。
- Windows 本地世界和 macOS 本地 Addon 都各自用 `--local` 运行，不通过远程接口操作。
- 远程不支持 MCEditor（`edit` 只在 Windows 本机）。
- 常见网络错误码（`unauthorized`、`remote_unavailable` 等）的处理见 [故障排查](/wiki/reference/troubleshooting/#网络与登录)。
